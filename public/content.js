// content.js — Content Script
// ---------------------------------------------------------------------------
// This script is injected into every Instagram page that matches the pattern
// "https://www.instagram.com/*" (as declared in manifest.json).
//
// Content scripts run in an isolated world: they share the page's DOM but NOT
// its JavaScript context. To communicate with the background service worker,
// use chrome.runtime.sendMessage(). To communicate with the page's own JS,
// use window.postMessage().
//
// Detection strategy:
//   1. MutationObserver — watches the DOM for new <article> elements injected
//      by Instagram's React renderer as the user scrolls (infinite scroll).
//   2. IntersectionObserver — fires when an <article> enters the viewport,
//      giving us the exact moment a post becomes visible on screen.
//   3. A WeakSet tracks articles we've already processed so no post is ever
//      logged (or later analysed) more than once.
//   4. extractPostData() pulls the image URL and caption text from each post.
// ---------------------------------------------------------------------------

console.log("TruthLens active");

// ---- State ----------------------------------------------------------------

// WeakSet of <article> elements we have already handed to the
// IntersectionObserver. Prevents duplicate observation AND duplicate logging.
// WeakSet is used instead of Set so that references to removed DOM nodes can
// be garbage-collected.
const observedArticles = new WeakSet();

// ---- IntersectionObserver — viewport detection ----------------------------

// Fires when a tracked <article> crosses the visibility threshold.
const intersectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        console.log("[Prism] Post entered viewport:", entry.target);

        // Extract data from the post that just became visible.
        extractPostData(entry.target);

        // Stop watching this article — we only need the first intersection.
        intersectionObserver.unobserve(entry.target);
      }
    }
  },
  {
    // trigger when at least 30 % of the article is visible
    threshold: 0.3,
  }
);

// ---- Post data extraction -------------------------------------------------

// extractPostData(postElement)
// ---------------------------------------------------------------------------
// Extracts the main image URL and caption text from an Instagram post element.
//
// Image: Finds <img> tags with a srcset attribute inside the post and picks
//        the highest-resolution source. Falls back to the img's src attribute
//        if no srcset exists. Returns null if no image is found.
//
// Text:  Instagram captions live in spans that are nested in various wrappers.
//        We try several selectors for common caption containers and pick the
//        first one with substantial text. Returns null if no caption is found.
// ---------------------------------------------------------------------------
function extractPostData(postElement) {
  // ---- Image extraction ---------------------------------------------------

  let imageUrl = null;

  // Find images inside the post — Instagram uses <img> tags with srcset for
  // responsive resolution. We want the highest-resolution variant.
  const imgs = postElement.querySelectorAll("img[srcset]");

  if (imgs.length > 0) {
    // Pick the img with the largest natural dimensions to skip tiny
    // profile-picture avatars that also have srcset.
    let bestImg = null;
    let bestWidth = 0;

    for (const img of imgs) {
      const w = img.naturalWidth || img.width || 0;
      if (w > bestWidth) {
        bestWidth = w;
        bestImg = img;
      }
    }

    // Fall back to the first srcset img if dimensions aren't available yet.
    if (!bestImg) bestImg = imgs[0];

    imageUrl = getHighestResSrcsetUrl(bestImg.getAttribute("srcset"));

    // Fallback to src if srcset parsing fails.
    if (!imageUrl) imageUrl = bestImg.src || null;
  } else {
    // No srcset images — try a plain <img> (e.g. video poster).
    const fallbackImg = postElement.querySelector("img");
    if (fallbackImg) {
      imageUrl = fallbackImg.src || null;
    }
  }

  // ---- Caption / text extraction ------------------------------------------

  let text = null;

  // We try several selectors in order of specificity. The first one that
  // yields a string longer than 20 characters wins (to skip UI labels,
  // usernames, timestamps, like counts, etc.).
  const captionSelectors = [
    // Classic feed caption: span inside the comments/caption section
    "ul span",
    // h1 is sometimes used for captions
    "h1",
    // Spans with dir="auto" typically contain user-generated text
    'span[dir="auto"]',
    // Broadest fallback
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

  // ---- Log & return -------------------------------------------------------

  console.log("[Prism] Extracted post data:", { imageUrl, text });
  return { imageUrl, text };
}

// Parse a srcset string and return the URL with the highest width descriptor.
// srcset format: "url1 320w, url2 640w, url3 1080w"
function getHighestResSrcsetUrl(srcset) {
  if (!srcset) return null;

  let bestUrl = null;
  let bestWidth = 0;

  const entries = srcset.split(",");
  for (const entry of entries) {
    const parts = entry.trim().split(/\s+/);
    if (parts.length < 2) continue;

    const url = parts[0];
    const descriptor = parts[1]; // e.g. "1080w"

    const width = parseInt(descriptor, 10);
    if (!isNaN(width) && width > bestWidth) {
      bestWidth = width;
      bestUrl = url;
    }
  }

  return bestUrl;
}

// ---- Article tracking -----------------------------------------------------

// Given a DOM node (or subtree root), find every <article> inside it
// (including the node itself) and start observing any we haven't seen yet.
function trackArticles(root) {
  // If the root itself is an <article>, consider it.
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

// ---- MutationObserver — DOM injection detection ---------------------------

// Instagram's React renderer adds/removes large subtrees as the user scrolls.
// We watch for any new nodes and check whether they contain <article> elements.
const mutationObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      // Only element nodes can contain <article> tags.
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      trackArticles(node);
    }
  }
});

// Observe the entire document body for subtree additions.
mutationObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

// ---- Initial scan ---------------------------------------------------------

// Articles that are already in the DOM when the content script runs
// (e.g. first paint before any scrolling) won't trigger a mutation, so we
// do a one-time sweep.
trackArticles(document.body);
