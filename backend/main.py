# backend/main.py — FastAPI Backend for Prism
# ---------------------------------------------------------------------------
# This is the main entry point for the Prism misinformation-detection API.
#
# It exposes three endpoints:
#   POST /analyze/image  — Accepts an image URL, returns reverse-image-search
#                          style results (oldest source, year, context).
#   POST /analyze/text   — Accepts caption/claim text, returns a fact-check
#                          style response (flag, confidence, summary, sources).
#   POST /analyze/post   — Accepts both image URL and text, returns a combined
#                          analysis merging image and text results. Runs both
#                          analyzers in parallel via asyncio.gather.
#
# All handlers are async. Results are cached in-memory by MD5 hash of the
# input (image URL or text) so repeated requests skip the API calls.
# CORS is configured to allow requests from Chrome extensions (which use
# the chrome-extension:// origin scheme).
#
# Run with:  uvicorn main:app --reload
# Requires:  Python 3.11+
# ---------------------------------------------------------------------------

import asyncio
import hashlib
import logging
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables BEFORE importing services so env vars are
# available even if a service reads them at module-init time.
_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from vision_service import analyze_image_web_detection, VisionAPIError
from text_service import analyze_text_claims, analyze_post_unified, TextAnalysisError

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

# ---- App setup -------------------------------------------------------------

app = FastAPI(
    title="Prism API",
    description="Misinformation detection backend for the Prism Chrome extension",
    version="0.1.0",
)

# ---- CORS ------------------------------------------------------------------
# Chrome extensions make requests from "chrome-extension://<extension-id>"
# origins. We also allow localhost for local development and testing.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",        # any Chrome extension
        "http://localhost",             # local dev
        "http://localhost:5173",        # Vite dev server
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- In-memory cache -------------------------------------------------------
# Keyed by MD5 hex digest of the input (image URL or text string).
# Values are the parsed response dicts. Cleared on server restart.

_image_cache: dict[str, dict] = {}
_text_cache: dict[str, dict] = {}
_unified_cache: dict[str, dict] = {}


def _md5(value: str) -> str:
    """Return the MD5 hex digest of a string."""
    return hashlib.md5(value.encode()).hexdigest()


# ---- Request / Response models ---------------------------------------------


class ImageRequest(BaseModel):
    """Payload for the /analyze/image endpoint."""
    image_url: str


class TextRequest(BaseModel):
    """Payload for the /analyze/text endpoint."""
    text: str


class PostRequest(BaseModel):
    """Payload for the /analyze/post endpoint (image + text + author)."""
    image_url: str | None = None
    text: str | None = None
    author: str | None = None


class ImageAnalysisResponse(BaseModel):
    """Reverse-image-search style result from Google Vision WEB_DETECTION."""
    oldest_source_url: str
    year: int
    context: str
    is_mismatch: bool


class SourceItem(BaseModel):
    """A single search-result source."""
    title: str
    url: str


class TextAnalysisResponse(BaseModel):
    """Fact-check style result."""
    flag: bool
    confidence: str
    summary: str
    sources: list[SourceItem]
    category: str


class ReasoningResponse(BaseModel):
    """Cross-signal reasoning breakdown."""
    image: str | None = None
    text: str | None = None
    author: str | None = None
    consistency: str | None = None


class UnifiedAnalysisResponse(BaseModel):
    """Unified multi-signal analysis result."""
    # REMOVED: UnifiedAnalysisResponse replaced by flat PostAnalysisResponse


class PostAnalysisResponse(BaseModel):
    """Combined analysis of both image and text, plus unified reasoning."""
    flag: bool
    confidence: str
    category: str
    summary: str
    reasoning: ReasoningResponse
    sources: list[SourceItem]
    image_provenance: ImageAnalysisResponse | None = None


# ---- Cached helper functions -----------------------------------------------


async def _analyze_image_cached(image_url: str) -> dict:
    """Return cached image analysis or call the Vision API and cache it."""
    key = _md5(image_url)
    if key in _image_cache:
        logger.info("Image cache HIT: %s", key[:8])
        return _image_cache[key]

    logger.info("Image cache MISS: %s — calling Vision API", key[:8])
    result = await analyze_image_web_detection(image_url)
    _image_cache[key] = result
    return result


async def _analyze_text_cached(text: str) -> dict:
    """Return cached text analysis or call Brave + Claude and cache it."""
    key = _md5(text)
    if key in _text_cache:
        logger.info("Text cache HIT: %s", key[:8])
        return _text_cache[key]

    logger.info("Text cache MISS: %s — calling Brave + Claude", key[:8])
    result = await analyze_text_claims(text)
    _text_cache[key] = result
    return result


# ---- Endpoints -------------------------------------------------------------


@app.post("/analyze/image", response_model=ImageAnalysisResponse)
async def analyze_image(request: ImageRequest):
    """
    Accepts an image URL and returns reverse-image-search style results
    using Google Cloud Vision's WEB_DETECTION feature.
    """
    try:
        result = await _analyze_image_cached(request.image_url)
        return ImageAnalysisResponse(**result)
    except VisionAPIError as exc:
        logger.error("Image analysis failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.error("Unexpected error in /analyze/image: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/analyze/text", response_model=TextAnalysisResponse)
async def analyze_text(request: TextRequest):
    """
    Accepts caption / claim text and returns a fact-check style response
    using Brave Search + Claude.
    """
    try:
        result = await _analyze_text_cached(request.text)
        return TextAnalysisResponse(
            flag=result["flag"],
            confidence=result["confidence"],
            summary=result["summary"],
            sources=[SourceItem(**s) for s in result["sources"]],
            category=result["category"],
        )
    except TextAnalysisError as exc:
        logger.error("Text analysis failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        logger.error("Unexpected error in /analyze/text: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/analyze/post", response_model=PostAnalysisResponse)
async def analyze_post(request: PostRequest):
    """
    Accepts both an image URL and text, returns a combined analysis.
    Runs image and text analysis in parallel via asyncio.gather.
    Results are cached by MD5 hash of the input so repeated calls are instant.
    """

    async def _safe_image(url: str) -> dict | None:
        try:
            logger.info("Analyzing image URL: %s", url[:120])
            data = await _analyze_image_cached(url)
            logger.info("Image analysis result: %s", data)
            return data
        except VisionAPIError as exc:
            logger.warning("Image analysis failed in /analyze/post: %s", exc)
            return {
                "oldest_source_url": "",
                "year": 0,
                "context": f"Image analysis unavailable: {exc}",
                "is_mismatch": False,
            }
        except Exception as exc:
            logger.error("Unexpected error in image analysis: %s", exc, exc_info=True)
            return {
                "oldest_source_url": "",
                "year": 0,
                "context": f"Image analysis error: {exc}",
                "is_mismatch": False,
            }

    # Unified cache helper
    def _unified_cache_key(image_url, text, author):
        key = f"{image_url or ''}|{text or ''}|{author or ''}"
        return _md5(key)

    image_result = None
    if request.image_url:
        image_result = await _safe_image(request.image_url)

    cache_key = _unified_cache_key(request.image_url, request.text, request.author)
    if cache_key in _unified_cache:
        logger.info("Unified cache HIT: %s", cache_key[:8])
        unified_result = _unified_cache[cache_key]
    else:
        logger.info("Unified cache MISS: %s — running unified analysis", cache_key[:8])
        unified_result = await analyze_post_unified(image_result, request.text, request.author)
        _unified_cache[cache_key] = unified_result

    # Compose response
    return PostAnalysisResponse(
        flag=unified_result["flag"],
        confidence=unified_result["confidence"],
        category=unified_result["category"],
        summary=unified_result["summary"],
        reasoning=ReasoningResponse(**unified_result["reasoning"]),
        sources=[SourceItem(**s) for s in unified_result["sources"]],
        image_provenance=ImageAnalysisResponse(**image_result) if image_result else None
    )
