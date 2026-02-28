# backend/text_service.py — Text Claim Analysis for Prism
# ---------------------------------------------------------------------------
# Orchestrates two external APIs to fact-check caption / claim text:
#
#   1. Brave Search API  — retrieves the top web results for the claim so
#      Claude has factual grounding material.
#   2. Anthropic Claude  — evaluates the claim against the search results
#      and returns a structured verdict.
#
# Public function:
#   analyze_text_claims(text: str) -> dict
#       Returns { flag, confidence, summary, sources }
#
# Environment variables required (loaded via python-dotenv in main.py):
#   BRAVE_SEARCH_API_KEY   — https://brave.com/search/api/
#   ANTHROPIC_API_KEY      — https://console.anthropic.com/
# ---------------------------------------------------------------------------

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

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
# Claude analysis
# ---------------------------------------------------------------------------

CLAUDE_MODEL = "claude-sonnet-4-20250514"

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
    "summary": "<1-2 sentence neutral summary>"
  }
- If the search results are insufficient to evaluate the claim, set
  flag=false, confidence="low", and explain in the summary.
"""


def _build_user_prompt(claim: str, sources: list[SearchResult]) -> str:
    """Build the user-message content that includes the claim + sources."""
    source_block = "\n".join(
        f"[{i+1}] {s.title}\n    URL: {s.url}\n    Snippet: {s.snippet}"
        for i, s in enumerate(sources)
    )
    return (
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

    import json

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Claude JSON: %s\nRaw: %s", exc, raw_text)
        raise TextAnalysisError("Claude returned invalid JSON")

    # Validate expected keys
    if not all(k in result for k in ("flag", "confidence", "summary")):
        raise TextAnalysisError(
            f"Claude response missing required keys. Got: {list(result.keys())}"
        )

    return {
        "flag": bool(result["flag"]),
        "confidence": str(result["confidence"]),
        "summary": str(result["summary"]),
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
        }

    # Step 1 — web search
    search_results = await _search_brave(text)

    if not search_results:
        return {
            "flag": False,
            "confidence": "low",
            "summary": "No relevant sources found for this claim.",
            "sources": [],
        }

    # Step 2 — Claude evaluation
    verdict = await _analyze_with_claude(text, search_results)

    # Step 3 — combine
    return {
        "flag": verdict["flag"],
        "confidence": verdict["confidence"],
        "summary": verdict["summary"],
        "sources": [{"title": s.title, "url": s.url} for s in search_results],
    }
