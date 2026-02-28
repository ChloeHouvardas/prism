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
#                          analysis merging image and text results.
#
# All handlers are async and currently return dummy/stubbed data.
# CORS is configured to allow requests from Chrome extensions (which use
# the chrome-extension:// origin scheme).
#
# Run with:  uvicorn main:app --reload
# Requires:  Python 3.11+
# ---------------------------------------------------------------------------

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

# ---- Request / Response models ---------------------------------------------


class ImageRequest(BaseModel):
    """Payload for the /analyze/image endpoint."""
    image_url: str


class TextRequest(BaseModel):
    """Payload for the /analyze/text endpoint."""
    text: str


class PostRequest(BaseModel):
    """Payload for the /analyze/post endpoint (image + text combined)."""
    image_url: str | None = None
    text: str | None = None


class ImageAnalysisResponse(BaseModel):
    """Reverse-image-search style result."""
    oldest_source: str
    year: int
    context: str


class TextAnalysisResponse(BaseModel):
    """Fact-check style result."""
    flag: bool
    confidence: str
    summary: str
    sources: list[str]


class PostAnalysisResponse(BaseModel):
    """Combined analysis of both image and text."""
    image: ImageAnalysisResponse | None = None
    text: TextAnalysisResponse | None = None


# ---- Endpoints -------------------------------------------------------------


@app.post("/analyze/image", response_model=ImageAnalysisResponse)
async def analyze_image(request: ImageRequest):
    """
    Accepts an image URL and returns reverse-image-search style results.
    Currently returns stubbed dummy data.
    """
    # TODO: Implement real reverse image search / analysis
    return ImageAnalysisResponse(
        oldest_source="example.com",
        year=2019,
        context="placeholder",
    )


@app.post("/analyze/text", response_model=TextAnalysisResponse)
async def analyze_text(request: TextRequest):
    """
    Accepts caption / claim text and returns a fact-check style response.
    Currently returns stubbed dummy data.
    """
    # TODO: Implement real text / claim analysis
    return TextAnalysisResponse(
        flag=False,
        confidence="low",
        summary="placeholder",
        sources=[],
    )


@app.post("/analyze/post", response_model=PostAnalysisResponse)
async def analyze_post(request: PostRequest):
    """
    Accepts both an image URL and text, returns a combined analysis.
    Delegates to the individual analyzers. Either field may be omitted.
    Currently returns stubbed dummy data.
    """
    image_result = None
    text_result = None

    if request.image_url:
        # TODO: call real image analysis
        image_result = ImageAnalysisResponse(
            oldest_source="example.com",
            year=2019,
            context="placeholder",
        )

    if request.text:
        # TODO: call real text analysis
        text_result = TextAnalysisResponse(
            flag=False,
            confidence="low",
            summary="placeholder",
            sources=[],
        )

    return PostAnalysisResponse(
        image=image_result,
        text=text_result,
    )
