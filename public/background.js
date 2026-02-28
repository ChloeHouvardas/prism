// background.js — Background Service Worker (Manifest V3)
// ---------------------------------------------------------------------------
// This is the extension's background service worker. It runs in a separate
// context with NO access to the DOM (no `document`, no `window`).
//
// Key characteristics:
//   • Ephemeral — Chrome can shut it down after ~30 s of inactivity and
//     restart it when an event fires. Do NOT store state in global variables;
//     use chrome.storage instead.
//   • Event-driven — register listeners at the top level so they survive
//     service-worker restarts.
//   • Use fetch() for network requests (XMLHttpRequest is unavailable).
//
// This worker is the central hub for coordinating messages between the popup
// and content scripts, making API calls, and managing extension lifecycle
// events.
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  console.log("Prism extension installed:", details.reason);
});
