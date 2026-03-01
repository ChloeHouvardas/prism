# backend/text_service.py — Text & Unified Post Analysis for Prism
# ---------------------------------------------------------------------------
# Orchestrates external APIs to fact-check text claims and provide unified
# multi-signal analysis of Instagram posts:
#
#   1. Brave Search API  — retrieves web results for claim grounding and
#      author reputation signals.
#   2. Anthropic Claude  — evaluates claims against search results and
#      performs cross-signal reasoning in unified mode.
#
# Public functions:
#   analyze_text_claims(text: str) -> dict
#       Returns { flag, confidence, summary, sources, category }
#
#   analyze_post_unified(image_result: dict | None, text: str, author: str | None) -> dict
#       Returns { flag, confidence, summary, category, reasoning, sources }
#
# Environment variables required (loaded via python-dotenv in main.py):
#   BRAVE_SEARCH_API_KEY   — https://brave.com/search/api/
#   ANTHROPIC_API_KEY      — https://console.anthropic.com/
# ---------------------------------------------------------------------------

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

# Ensure .env is loaded even if this module is imported standalone
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

import anthropic
import httpx

# ---- Mock mode --------------------------------------------------------------
_MOCK_MODE = os.environ.get("MOCK_MODE", "false").lower() == "true"
if _MOCK_MODE:
    logging.getLogger(__name__).info("MOCK_MODE enabled — Brave/Claude API calls will be skipped")

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------


class TextAnalysisError(Exception):
    """Raised when the text-analysis pipeline fails."""


# ---------------------------------------------------------------------------
# Brave Search
# ---------------------------------------------------------------------------

BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"
BRAVE_MAX_RESULTS = 5  # top-N results to feed Claude


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


# ---------------------------------------------------------------------------
# Source credibility classification
# ---------------------------------------------------------------------------

_SATIRE_DOMAINS = {
    "theonion.com", "babylonbee.com", "clickhole.com", "thebeaverton.com",
    "waterfordwhispersnews.com", "newsthump.com", "thedailymash.co.uk",
    "hard-drive.net", "hardtimes.net", "reductress.com",
    "theshovel.com.au", "chaser.com.au", "private-eye.co.uk",
}

# Social-media handles belonging to known satire outlets
_SATIRE_HANDLES = {
    "theonion", "babylonbee", "clickhole", "thebeaverton",
    "newsthump", "thedailymash", "reductress",
    "theshovel", "hardtimesnews", "harddrivenews", "privateeye",
}

_CREDIBLE_DOMAINS = {
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk",
    "nytimes.com", "washingtonpost.com", "theguardian.com",
    "snopes.com", "factcheck.org", "politifact.com",
    "fullfact.org", "nature.com", "sciencedirect.com",
    "who.int", "cdc.gov", "nih.gov", "nasa.gov",
    "npr.org", "pbs.org",
}


def _classify_source(url: str) -> str:
    """Return 'satire', 'credible', or 'unknown' based on the URL's domain."""
    try:
        domain = (urlparse(url).hostname or "").lower().removeprefix("www.")
    except Exception:
        return "unknown"
    if domain in _SATIRE_DOMAINS:
        return "satire"
    if domain in _CREDIBLE_DOMAINS:
        return "credible"
    return "unknown"


def _classify_author(author: str | None) -> str:
    """Return 'satire' or 'unknown' based on the social-media handle."""
    if not author:
        return "unknown"
    handle = author.strip().lower().lstrip("@")
    if handle in _SATIRE_HANDLES:
        return "satire"
    # Also check if the handle matches the prefix of any satire domain
    if any(handle == d.split(".")[0] for d in _SATIRE_DOMAINS):
        return "satire"
    return "unknown"


async def _search_brave(query: str) -> list[SearchResult]:
    """
    Call Brave Web Search and return the top results as SearchResult objects.
    Raises TextAnalysisError on failure.
    """
    api_key = os.environ.get("BRAVE_SEARCH_API_KEY")
    if not api_key:
        raise TextAnalysisError("BRAVE_SEARCH_API_KEY is not set")

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": api_key,
    }
    params = {
        "q": query,
        "count": BRAVE_MAX_RESULTS,
        "freshness": "pw",  # prefer results from the past week
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(BRAVE_SEARCH_URL, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("Brave Search HTTP error: %s", exc)
        raise TextAnalysisError(f"Brave Search returned {exc.response.status_code}")
    except httpx.RequestError as exc:
        logger.error("Brave Search request error: %s", exc)
        raise TextAnalysisError(f"Brave Search request failed: {exc}")

    results: list[SearchResult] = []
    for item in data.get("web", {}).get("results", []):
        results.append(
            SearchResult(
                title=item.get("title", ""),
                url=item.get("url", ""),
                snippet=item.get("description", ""),
            )
        )

    return results[:BRAVE_MAX_RESULTS]


# ---------------------------------------------------------------------------
# Author reputation lookup
# ---------------------------------------------------------------------------

_REPUTATION_RED_FLAGS = {"misinformation", "fake", "suspended", "banned", "propaganda"}
_AUTHOR_MAX_RESULTS = 3


async def _search_author_reputation(author: str | None) -> dict:
    """
    Query Brave Search for reputation signals about an Instagram author.

    Returns { author, signals, flagged } where *flagged* is True if any
    snippet contains a red-flag keyword.
    """
    empty = {"author": None, "signals": [], "flagged": False}

    if not author or not author.strip():
        return empty

    author = author.strip()

    api_key = os.environ.get("BRAVE_SEARCH_API_KEY")
    if not api_key:
        logger.warning("BRAVE_SEARCH_API_KEY not set — skipping author reputation check")
        return {**empty, "author": author}

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": api_key,
    }

    # Run two queries in parallel for broader coverage
    queries = [
        f"{author} Instagram credibility",
        f"{author} misinformation",
    ]

    snippets: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            responses = await asyncio.gather(
                *(
                    client.get(
                        BRAVE_SEARCH_URL,
                        headers=headers,
                        params={"q": q, "count": _AUTHOR_MAX_RESULTS},
                    )
                    for q in queries
                ),
                return_exceptions=True,
            )

        for resp in responses:
            if isinstance(resp, Exception):
                logger.warning("Author reputation search error: %s", resp)
                continue
            resp.raise_for_status()
            data = resp.json()
            for item in data.get("web", {}).get("results", [])[:_AUTHOR_MAX_RESULTS]:
                snippet = item.get("description", "").strip()
                if snippet:
                    snippets.append(snippet)

    except Exception as exc:
        logger.warning("Author reputation lookup failed: %s", exc)
        return {**empty, "author": author}

    flagged = any(
        keyword in snippet.lower()
        for snippet in snippets
        for keyword in _REPUTATION_RED_FLAGS
    )

    return {
        "author": author,
        "signals": snippets,
        "flagged": flagged,
    }


# ---------------------------------------------------------------------------
# Claude analysis
# ---------------------------------------------------------------------------

CLAUDE_MODEL = "claude-sonnet-4-20250514"

# Valid misinformation categories Claude may assign
MISINFO_CATEGORIES = {
    "fabricated",
    "false_context",
    "manipulated",
    "imposter",
    "false_connection",
    "satire",
    "astroturfing",
    "sponsored_disguised",
    "none",
}

SYSTEM_PROMPT = """\
You are Prism, a neutral misinformation-detection assistant embedded in a \
browser extension. Your job is to evaluate whether a social-media post's \
caption or claim is supported, partially supported, or unsupported by \
recent, credible sources.

RULES:
- Never use the words "fake", "false", "lie", or "hoax" — they are too
  inflammatory for a browser overlay. Instead use phrasing like "not
  supported by recent sources", "additional context available", or "claim
  could not be verified".
- Always cite the sources provided in the SEARCH RESULTS section.
- Return ONLY valid JSON matching this schema (no markdown fences):
  {
    "flag": <bool>,       // true = claim needs attention / additional context
    "confidence": "<low|medium|high>",
    "summary": "<1-2 sentence neutral summary>",
    "category": "<one of the categories below>"
  }

CATEGORY (pick exactly one):
  fabricated          — entirely made-up content with no factual basis
  false_context       — real content shared with false contextual info
  manipulated         — genuine content that has been doctored or altered
  imposter            — content falsely attributed to a real public figure/org
  false_connection    — headlines/captions that don't match the actual content
  satire              — satirical content from a known satire outlet or with
                        clear satirical markers. ALWAYS set flag=true for satire.
  astroturfing        — coordinated inauthentic behaviour / fake grassroots
  sponsored_disguised — paid promotion disguised as organic content
  none                — content appears genuine / no misinformation detected

- If flag is false, you MUST set category to "none".
- If flag is true, pick the single most applicable category.
- If the search results are insufficient to evaluate the claim, set
  flag=false, confidence="low", category="none", and explain in the summary.

SATIRE RULE — satire is NOT "looks OK":
  Content from a known satire outlet (source type = satire, or author type =
  satire) MUST be flagged: set flag=true, category="satire", confidence="high".
  The summary should note that it is satirical content, not real news.
  Do NOT set flag=false for satire — users need to know the content is fictional.

IMAGE MISMATCH RULE:
- If IMAGE PROVENANCE shows "Mismatch: True", the image originates from an
  unrelated source and is being used to dress up the post's claim.
- This is strong positive evidence of false_context. You MUST set flag=true
  and category="false_context" unless a more specific category (e.g. satire)
  applies.
- In the summary, note that the image does not originate from the context it
  is presented in.

SOURCE TYPES — each search result is tagged with a source type:
  satire   — known satire/parody outlet (The Onion, Babylon Bee, etc.).
             If the post's content originates from a satire source, classify
             it as "satire" rather than "fabricated" or any other category.
  credible — established news organisation or fact-checker. Weigh these
             more heavily when corroborating or contradicting a claim.
  unknown  — unclassified source. Use normal editorial judgement.
"""


def _build_user_prompt(claim: str, sources: list[SearchResult]) -> str:
    """Build the user-message content that includes the claim + sources."""
    source_block = "\n".join(
        f"[{i+1}] {s.title}\n    URL: {s.url}\n    Source type: {_classify_source(s.url)}\n    Snippet: {s.snippet}"
        for i, s in enumerate(sources)
    )
    return (
        f"TODAY'S DATE: {date.today().isoformat()}\n\n"
        f"CLAIM:\n{claim}\n\n"
        f"SEARCH RESULTS:\n{source_block}\n\n"
        "Evaluate the claim against the search results and return JSON."
    )


async def _analyze_with_claude(
    claim: str,
    sources: list[SearchResult],
) -> dict:
    """
    Send the claim + Brave search results to Claude and parse the JSON
    verdict. Returns dict with keys: flag, confidence, summary.
    Raises TextAnalysisError on failure.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise TextAnalysisError("ANTHROPIC_API_KEY is not set")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    try:
        message = await client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": _build_user_prompt(claim, sources),
                }
            ],
        )
    except anthropic.APIError as exc:
        logger.error("Claude API error: %s", exc)
        raise TextAnalysisError(f"Claude API error: {exc}")

    # Extract the text block from Claude's response
    raw_text = message.content[0].text.strip()

    # Strip markdown code fences if Claude wraps them despite instructions
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]  # remove opening ```json
    if raw_text.endswith("```"):
        raw_text = raw_text.rsplit("```", 1)[0].strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Claude JSON: %s\nRaw: %s", exc, raw_text)
        raise TextAnalysisError("Claude returned invalid JSON")

    # Validate expected keys
    if not all(k in result for k in ("flag", "confidence", "summary", "category")):
        raise TextAnalysisError(
            f"Claude response missing required keys. Got: {list(result.keys())}"
        )

    flag = bool(result["flag"])
    category = str(result.get("category", "none")).lower()

    # Enforce: flag=false → category must be "none"
    if not flag:
        category = "none"
    # Enforce: flag=true with invalid/missing category → fallback
    elif category not in MISINFO_CATEGORIES or category == "none":
        category = "fabricated"

    return {
        "flag": flag,
        "confidence": str(result["confidence"]),
        "summary": str(result["summary"]),
        "category": category,
    }


# ---------------------------------------------------------------------------
# Public orchestrator
# ---------------------------------------------------------------------------


async def analyze_text_claims(text: str) -> dict:
    """
    End-to-end text claim analysis.

    1. Search Brave for the claim.
    2. Feed claim + sources to Claude for evaluation.
    3. Return { flag, confidence, summary, sources: [{title, url}] }.

    Raises TextAnalysisError on failure.
    """
    if not text or not text.strip():
        return {
            "flag": False,
            "confidence": "low",
            "summary": "No text provided for analysis.",
            "sources": [],
            "category": "none",
        }

    # Mock mode — return template data without hitting any API
    if _MOCK_MODE:
        logger.info("MOCK: returning template text analysis")
        return {
            "flag": True,
            "confidence": "medium",
            "summary": (
                "[MOCK] Simulated text analysis — this claim would require "
                "additional context based on available sources."
            ),
            "sources": [
                {"title": "Mock Source — Reuters", "url": "https://reuters.com/mock"},
                {"title": "Mock Source — AP News", "url": "https://apnews.com/mock"},
            ],
            "category": "false_context",
        }

    # Step 1 — web search
    search_results = await _search_brave(text)

    if not search_results:
        return {
            "flag": False,
            "confidence": "low",
            "summary": "No relevant sources found for this claim.",
            "sources": [],
            "category": "none",
        }

    # Step 2 — Claude evaluation
    verdict = await _analyze_with_claude(text, search_results)

    # Step 3 — combine
    return {
        "flag": verdict["flag"],
        "confidence": verdict["confidence"],
        "summary": verdict["summary"],
        "sources": [{"title": s.title, "url": s.url} for s in search_results],
        "category": verdict["category"],
    }


async def analyze_post_unified(image_result: dict | None, text: str | None, author: str | None) -> dict:
    """
    Runs Brave text search and author reputation search in parallel, then calls Claude with all context.
    Returns flat JSON shape:
    {
      "flag": bool,
      "confidence": "low" | "medium" | "high",
      "category": "fabricated" | "false_context" | "manipulated" | "imposter" | "false_connection" | "satire" | "astroturfing" | "sponsored_disguised" | "none",
      "summary": "2-3 sentence neutral summary",
      "reasoning": {
        "image": "1 sentence",
        "text": "1 sentence",
        "author": "1 sentence",
        "consistency": "1 sentence"
      },
      "sources": [{ "title": string, "url": string }]
    }
    """
    if not text and not image_result:
        return {
            "flag": False,
            "confidence": "low",
            "category": "none",
            "summary": "No post data provided for analysis.",
            "reasoning": {
                "image": "No image provided.",
                "text": "No text provided.",
                "author": "No author provided.",
                "consistency": "No data to compare."
            },
            "sources": []
        }
    if _MOCK_MODE:
        return {
            "flag": True,
            "confidence": "medium",
            "category": "false_context",
            "summary": "[MOCK] Simulated unified analysis — this post would require additional context based on available sources.",
            "reasoning": {
                "image": "[MOCK] Image appears reused.",
                "text": "[MOCK] Text claim is ambiguous.",
                "author": "[MOCK] Author reputation is unclear.",
                "consistency": "[MOCK] Image and text do not fully align."
            },
            "sources": [
                {"title": "Mock Source — Reuters", "url": "https://reuters.com/mock"},
                {"title": "Mock Source — AP News", "url": "https://apnews.com/mock"}
            ]
        }
    # Run Brave search and author reputation search in parallel
    brave_task = _search_brave(text) if text else asyncio.sleep(0, result=[])
    author_task = _search_author_reputation(author)
    brave_results, author_signals = await asyncio.gather(brave_task, author_task)
    # Compose sources for Claude
    sources_block = "\n".join(
        f"[{i+1}] {s.title}\n    URL: {s.url}\n    Source type: {_classify_source(s.url)}\n    Snippet: {getattr(s, 'snippet', '')}"
        for i, s in enumerate(brave_results)
    )
    author_block = "\n".join(f"- {sig}" for sig in author_signals.get("signals", []))
    image_block = "No image provided."
    if image_result:
        image_block = (
            f"Image provenance:\n"
            f"  Oldest source: {image_result.get('oldest_source_url', '')}\n"
            f"  Year: {image_result.get('year', '')}\n"
            f"  Context: {image_result.get('context', '')}\n"
            f"  Mismatch: {image_result.get('is_mismatch', False)}"
        )
    # Unified Claude prompt
    UNIFIED_SYSTEM_PROMPT = """
You are Prism, a neutral misinformation-detection assistant embedded in a browser extension. Your job is to evaluate whether a social-media post's caption or claim is supported, partially supported, or unsupported by recent, credible sources, and to reason across four dimensions: image origin, text credibility, image-text consistency, and author reputation.

RULES:
- Never use the words "fake", "false", "lie", or "hoax" — they are too inflammatory for a browser overlay. Instead use phrasing like "not supported by recent sources", "additional context available", or "claim could not be verified".
- Always cite the sources provided in the SEARCH RESULTS section.
- Return ONLY valid JSON matching this schema (no markdown fences):
  {
    "flag": <bool>,
    "confidence": "<low|medium|high>",
    "category": "<one of the categories below>",
    "summary": "<2-3 sentence neutral summary>",
    "reasoning": {
      "image": "<1 sentence>",
      "text": "<1 sentence>",
      "author": "<1 sentence>",
      "consistency": "<1 sentence>"
    },
    "sources": [{"title": string, "url": string}]
  }

CATEGORY (pick exactly one):
  fabricated          — entirely made-up content with no factual basis
  false_context       — real content shared with false contextual info
  manipulated         — genuine content that has been doctored or altered
  imposter            — content falsely attributed to a real public figure/org
  false_connection    — headlines/captions that don't match the actual content
  satire              — satirical content from a known satire outlet or with clear satirical markers. ALWAYS set flag=true for satire.
  astroturfing        — coordinated inauthentic behaviour / fake grassroots
  sponsored_disguised — paid promotion disguised as organic content
  none                — content appears genuine / no misinformation detected
- If flag is false, you MUST set category to "none".
- If flag is true, pick the single most applicable category.
- If the search results are insufficient to evaluate the claim, set flag=false, confidence="low", category="none", and explain in the summary.

SATIRE RULE (takes priority over the flag-false→none rule above):
- If the post originates from a known satire publication (The Onion, Babylon Bee, Reductress, ClickHole, etc.) OR the Author type is "satire", you MUST return flag=true, category="satire", confidence="high" — even though satire is not malicious misinformation. The purpose is to alert readers that the content is fictional humour and should not be taken literally.

SIGNAL WEIGHTING — not every dimension matters equally for every category.
Use the following guide when deciding which signals to prioritise:
  fabricated      → TEXT is primary (claims unsupported by any source). IMAGE supports if provenance shows reuse.
  false_context   → IMAGE + CONSISTENCY are primary (real image placed in a misleading new context).
  manipulated     → IMAGE is primary (doctored or altered visual content).
  imposter        → AUTHOR is primary (content falsely attributed to someone).
  false_connection → CONSISTENCY is primary (caption/headline contradicts the actual image or linked content).
  satire          → TEXT is primary (tone, source identification, satirical markers).
  astroturfing    → AUTHOR is primary (coordinated inauthentic patterns, red-flag reputation signals).
  sponsored_disguised → TEXT is primary (language patterns suggesting undisclosed paid promotion).

HANDLING ABSENT SIGNALS:
- If IMAGE PROVENANCE data says "No image provided" or is inconclusive, treat the image dimension as NEUTRAL. Do NOT let a missing image pull the verdict toward flagging.
- If no AUTHOR REPUTATION signals are found, treat author as NEUTRAL rather than suspicious.
- Never flag a post solely because a signal is absent. A flag requires positive evidence from at least one primary signal for the chosen category.

IMAGE MISMATCH RULE:
- If IMAGE PROVENANCE shows "Mismatch: True", the image originates from an unrelated source and is being used to dress up the post's claim.
- This is strong positive evidence of false_context. You MUST set flag=true and category="false_context" unless a more specific category (e.g. satire) applies.
- In the summary, note that the image does not originate from the context it is presented in.

SOURCE TYPES — each search result is tagged with a source type:
  satire   — known satire/parody outlet (The Onion, Babylon Bee, etc.).
             If the post's content originates from a satire source, classify
             it as "satire" rather than "fabricated" or any other category.
  credible — established news organisation or fact-checker. Weigh these
             more heavily when corroborating or contradicting a claim.
  unknown  — unclassified source. Use normal editorial judgement.
"""
    author_type = _classify_author(author)
    user_prompt = (
        f"TODAY'S DATE: {date.today().isoformat()}\n\n"
        f"CLAIM:\n{text or ''}\n\n"
        f"IMAGE PROVENANCE:\n{image_block}\n\n"
        f"AUTHOR REPUTATION:\n{author or ''}\nAuthor type: {author_type}\nSignals:\n{author_block}\n\n"
        f"SEARCH RESULTS:\n{sources_block}\n\n"
        "Evaluate the post across all four dimensions and return JSON."
    )
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise TextAnalysisError("ANTHROPIC_API_KEY is not set")
    client = anthropic.AsyncAnthropic(api_key=api_key)
    try:
        message = await client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=700,
            system=UNIFIED_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": user_prompt,
            }],
        )
    except anthropic.APIError as exc:
        logger.error("Claude API error (unified): %s", exc)
        raise TextAnalysisError(f"Claude API error: {exc}")
    raw_text = message.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]
    if raw_text.endswith("```"):
        raw_text = raw_text.rsplit("```", 1)[0].strip()
    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Claude JSON (unified): %s\nRaw: %s", exc, raw_text)
        raise TextAnalysisError("Claude returned invalid JSON (unified)")
    # Validate keys
    required_keys = {"flag", "confidence", "category", "summary", "reasoning", "sources"}
    if not all(k in result for k in required_keys):
        raise TextAnalysisError(f"Claude unified response missing required keys. Got: {list(result.keys())}")
    reasoning_keys = {"image", "text", "author", "consistency"}
    if not isinstance(result["reasoning"], dict) or not all(k in result["reasoning"] for k in reasoning_keys):
        raise TextAnalysisError(f"Claude unified reasoning missing keys. Got: {list(result['reasoning'].keys())}")
    # Normalize category
    flag = bool(result["flag"])
    category = str(result.get("category", "none")).lower()
    if not flag:
        category = "none"
    elif category not in MISINFO_CATEGORIES or category == "none":
        category = "fabricated"
    # Normalize sources
    sources = result["sources"]
    if isinstance(sources, list):
        sources = [
            {"title": s.get("title", ""), "url": s.get("url", "")}
            for s in sources if s.get("url")
        ]
    else:
        sources = []
    return {
        "flag": flag,
        "confidence": str(result["confidence"]),
        "category": category,
        "summary": str(result["summary"]),
        "reasoning": {
            "image": str(result["reasoning"]["image"]),
            "text": str(result["reasoning"]["text"]),
            "author": str(result["reasoning"]["author"]),
            "consistency": str(result["reasoning"]["consistency"]),
        },
        "sources": sources
    }
