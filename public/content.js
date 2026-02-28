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
// NOTE: Instagram is a Single Page Application (SPA). This script fires once
// on initial page load (at "document_idle"). To react to in-app navigations,
// you will eventually need a MutationObserver or URL-change listener.
// ---------------------------------------------------------------------------

console.log("TruthLens active");
