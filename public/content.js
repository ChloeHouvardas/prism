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

// ---- Helpers --------------------------------------------------------------

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
