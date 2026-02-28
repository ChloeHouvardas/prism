# backend/vision_service.py — Google Cloud Vision API Integration
# ---------------------------------------------------------------------------
# This module wraps the Google Cloud Vision API's WEB_DETECTION feature.
#
# It provides a single async function, analyze_image_web_detection(), that:
#   1. Sends an image URL to Google Cloud Vision for web detection.
#   2. Parses the "pages_with_matching_images" from the response.
#   3. Finds the top/oldest matching page (Google tends to rank the original
#      source higher in its results).
#   4. Returns structured data: oldest source URL, year, context, and whether
#      the image appears to be reused from a different context (is_mismatch).
#
# The google-cloud-vision library is synchronous, so we run it inside
# asyncio.to_thread() to avoid blocking FastAPI's async event loop.
#
# Authentication:
#   Set the GOOGLE_VISION_API_KEY environment variable to your Google Cloud
#   API key, or place it in a .env file. See .env.example for details.
#
#   To get an API key:
#     1. Go to https://console.cloud.google.com/apis/credentials
#     2. Click "Create Credentials" → "API key"
#     3. (Recommended) Restrict the key to the "Cloud Vision API" only
# ---------------------------------------------------------------------------

import asyncio
import logging
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

# Ensure .env is loaded even if this module is imported standalone
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from google.cloud import vision
from google.api_core import exceptions as gcp_exceptions
from google.api_core.client_options import ClientOptions

logger = logging.getLogger(__name__)

# ---- Vision client (singleton) --------------------------------------------
# Uses a plain API key from the GOOGLE_VISION_API_KEY env var instead of a
# service account JSON file. Much simpler to set up for development.

_client: vision.ImageAnnotatorClient | None = None


def _get_client() -> vision.ImageAnnotatorClient:
    """Lazily initialize the Vision API client using an API key."""
    global _client
    if _client is None:
        api_key = os.environ.get("GOOGLE_VISION_API_KEY")
        if not api_key:
            raise VisionAPIError(
                "GOOGLE_VISION_API_KEY is not set. "
                "Add it to backend/.env or set it as an environment variable."
            )
        _client = vision.ImageAnnotatorClient(
            client_options=ClientOptions(api_key=api_key)
        )
    return _client


# ---- Domains to ignore when looking for the "original" source --------------
# These are content-hosting platforms where images are republished, not where
# they originate.

REPOST_DOMAINS = {
    "instagram.com",
    "www.instagram.com",
    "facebook.com",
    "www.facebook.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "www.tiktok.com",
    "pinterest.com",
    "www.pinterest.com",
    "reddit.com",
    "www.reddit.com",
    "imgur.com",
    "i.imgur.com",
}


# ---- Core analysis function -----------------------------------------------

async def analyze_image_web_detection(image_url: str) -> dict:
    """
    Run Google Vision WEB_DETECTION on the given image URL and return
    structured results about where the image appears on the web.

    Returns:
        {
            "oldest_source_url": str,   # URL of the top/oldest matching page
            "year": int,                # estimated year of first appearance
            "context": str,             # page title or description
            "is_mismatch": bool,        # True if image appears re-used
        }

    Raises:
        VisionAPIError on any failure (credentials, quota, network, etc.)
    """
    try:
        result = await asyncio.to_thread(_run_web_detection, image_url)
        return result
    except gcp_exceptions.GoogleAPICallError as exc:
        logger.error("Vision API call failed: %s", exc)
        raise VisionAPIError(f"Vision API error: {exc.message}") from exc
    except gcp_exceptions.PermissionDenied as exc:
        logger.error("Vision API permission denied: %s", exc)
        raise VisionAPIError(
            "Vision API permission denied. Check your credentials."
        ) from exc
    except Exception as exc:
        logger.error("Unexpected error in Vision API call: %s", exc)
        raise VisionAPIError(f"Unexpected error: {exc}") from exc


def _run_web_detection(image_url: str) -> dict:
    """
    Synchronous helper — called via asyncio.to_thread().
    Performs the actual Vision API request and parses the response.
    """
    client = _get_client()

    image = vision.Image()
    image.source.image_uri = image_url

    response = client.web_detection(image=image)

    # Check for errors in the response itself
    if response.error.message:
        raise VisionAPIError(
            f"Vision API returned error: {response.error.message}"
        )

    web = response.web_detection

    # ---- Find the best matching page (oldest / original source) ------------
    # Google tends to rank the original or most authoritative source first in
    # pages_with_matching_images. We prefer non-social-media pages since those
    # are more likely to be the original source, not a repost.

    pages = web.pages_with_matching_images or []

    best_page = None
    best_social_page = None

    for page in pages:
        domain = _extract_domain(page.url)

        if domain in REPOST_DOMAINS:
            # Track the first social media match as a fallback
            if best_social_page is None:
                best_social_page = page
            continue

        # First non-social-media match is our best candidate
        best_page = page
        break

    # Fall back to the first social media page, or nothing
    if best_page is None:
        best_page = best_social_page

    # ---- Build the result --------------------------------------------------

    if best_page is None:
        # No matching pages found at all
        return {
            "oldest_source_url": "",
            "year": datetime.now().year,
            "context": "No matching pages found on the web.",
            "is_mismatch": False,
        }

    page_url = best_page.url or ""
    page_title = best_page.page_title or ""
    page_domain = _extract_domain(page_url)

    # ---- Estimate the year -------------------------------------------------
    # The Vision API does not return crawl/index dates. We use a heuristic:
    # - If we find a best_guess_label from web_entities, use it as context.
    # - The year defaults to "current year" because we can't know the true
    #   first-indexed date from Vision alone. A future enhancement could cross-
    #   reference with the Wayback Machine API for accurate dates.
    #
    # For now we set the year to the current year as a baseline. The
    # is_mismatch flag is determined by whether the source is a non-Instagram
    # domain (meaning the image existed elsewhere before this Instagram post).

    current_year = datetime.now().year

    # ---- Determine is_mismatch --------------------------------------------
    # True if the oldest/top matching source is NOT Instagram — meaning the
    # image was published elsewhere, suggesting the Instagram post may be
    # reusing/repurposing someone else's image.
    is_from_instagram = page_domain in ("instagram.com", "www.instagram.com")
    is_mismatch = not is_from_instagram

    # ---- Build context string ----------------------------------------------
    # Combine page title with the best guess label from Vision if available.
    context_parts = []
    if page_title:
        context_parts.append(page_title.strip())

    # Add best guess labels (Vision's interpretation of the image content)
    if web.best_guess_labels:
        labels = ", ".join(label.label for label in web.best_guess_labels if label.label)
        if labels:
            context_parts.append(f"Best guess: {labels}")

    context = " | ".join(context_parts) if context_parts else "No context available."

    return {
        "oldest_source_url": page_url,
        "year": current_year,
        "context": context,
        "is_mismatch": is_mismatch,
    }


# ---- Utilities -------------------------------------------------------------

def _extract_domain(url: str) -> str:
    """Extract the domain (netloc) from a URL, lowercased."""
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


# ---- Custom exception ------------------------------------------------------

class VisionAPIError(Exception):
    """Raised when the Google Vision API call fails for any reason."""
    pass
