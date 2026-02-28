// src/content/index.jsx
// ---------------------------------------------------------------------------
// Content-script entry point — bundled by Vite into an IIFE that Chrome
// injects into Instagram pages. For every <article> that enters the viewport
// it attaches a Shadow DOM host and renders an <OverlayBadge /> React
// component inside it.
//
// Detection strategy (ported from the original public/content.js):
//   1. MutationObserver — watches for new <article> elements.
//   2. IntersectionObserver — fires when 30 % of an article is visible.
//   3. WeakSet — prevents duplicate processing.
//   4. extractPostData() — pulls image URL + caption text.
//   5. Shadow DOM + React render — isolated overlay UI on each post.
// ---------------------------------------------------------------------------

import React from "react";
import { createRoot } from "react-dom/client";
import OverlayBadge from "./OverlayBadge.jsx";
import { OVERLAY_CSS } from "./overlay-styles.js";

console.log("[Prism] Content script active (React overlay)");

// ---- State ----------------------------------------------------------------

const observedArticles = new WeakSet();

// ---- Post data extraction -------------------------------------------------

function getHighestResSrcsetUrl(srcset) {
  if (!srcset) return null;

  let bestUrl = null;
  let bestWidth = 0;

  const entries = srcset.split(",");
  for (const entry of entries) {
    const parts = entry.trim().split(/\s+/);
    if (parts.length < 2) continue;

    const url = parts[0];
    const descriptor = parts[1];
    const width = parseInt(descriptor, 10);
    if (!isNaN(width) && width > bestWidth) {
      bestWidth = width;
      bestUrl = url;
    }
  }

  return bestUrl;
}

function extractPostData(postElement) {
  // ---- Image extraction ---------------------------------------------------
  let imageUrl = null;

  const imgs = postElement.querySelectorAll("img[srcset]");
  if (imgs.length > 0) {
    let bestImg = null;
    let bestWidth = 0;

    for (const img of imgs) {
      const w = img.naturalWidth || img.width || 0;
      if (w > bestWidth) {
        bestWidth = w;
        bestImg = img;
      }
    }

    if (!bestImg) bestImg = imgs[0];
    imageUrl = getHighestResSrcsetUrl(bestImg.getAttribute("srcset"));
    if (!imageUrl) imageUrl = bestImg.src || null;
  } else {
    const fallbackImg = postElement.querySelector("img");
    if (fallbackImg) {
      imageUrl = fallbackImg.src || null;
    }
  }

  // ---- Caption / text extraction ------------------------------------------
  let text = null;

  const captionSelectors = [
    "ul span",
    "h1",
    'span[dir="auto"]',
    "span",
  ];

  for (const selector of captionSelectors) {
    const els = postElement.querySelectorAll(selector);
    for (const el of els) {
      const candidate = el.innerText?.trim();
      if (candidate && candidate.length > 20) {
        text = candidate;
        break;
      }
    }
    if (text) break;
  }

  console.log("[Prism] Extracted post data:", {
    imageUrl: imageUrl ? imageUrl.slice(0, 60) + "…" : null,
    textLength: text ? text.length : 0,
  });

  return { imageUrl, text };
}

// ---- Shadow DOM mounting --------------------------------------------------

function mountOverlay(articleEl) {
  // Force article to be a positioned ancestor so the badge's absolute
  // positioning works. Use !important to survive Instagram's CSS re-renders.
  articleEl.style.setProperty("position", "relative", "important");

  // Create Shadow DOM host — set inline styles directly on the element so
  // Instagram's light-DOM CSS cannot override them (Shadow DOM :host CSS
  // only applies inside the shadow root, not in the light DOM).
  const host = document.createElement("prism-badge");
  host.setAttribute("data-prism", "true");
  host.style.cssText =
    "display:block !important; position:absolute !important; " +
    "top:8px !important; right:8px !important; z-index:10000 !important; " +
    "pointer-events:auto !important; visibility:visible !important; " +
    "opacity:1 !important; width:auto !important; height:auto !important;";
  articleEl.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Inject styles
  const style = document.createElement("style");
  style.textContent = OVERLAY_CSS;
  shadow.appendChild(style);

  // React mount point
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  // Extract data and render
  const postData = extractPostData(articleEl);
  const root = createRoot(mountPoint);
  root.render(<OverlayBadge postData={postData} />);
}

// ---- IntersectionObserver -------------------------------------------------

const intersectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        mountOverlay(entry.target);
        intersectionObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.3 }
);

// ---- Article tracking -----------------------------------------------------

function trackArticles(root) {
  const candidates =
    root.nodeType === Node.ELEMENT_NODE
      ? [root, ...root.querySelectorAll("article")]
      : [];

  for (const article of candidates) {
    if (article.tagName !== "ARTICLE") continue;
    if (observedArticles.has(article)) continue;

    observedArticles.add(article);
    intersectionObserver.observe(article);
  }
}

// ---- MutationObserver -----------------------------------------------------

const mutationObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      trackArticles(node);
    }
  }
});

mutationObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

// ---- Initial scan ---------------------------------------------------------

trackArticles(document.body);
