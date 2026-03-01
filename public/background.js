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

// ---- Configuration --------------------------------------------------------

const API_BASE = "http://localhost:8000";

// ---- Lifecycle events -----------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  console.log("Prism extension installed:", details.reason);
});

// ---- Message handler ------------------------------------------------------
// Listens for messages from the content script and forwards them to the
// FastAPI backend. The content script cannot make cross-origin requests
// directly, so this worker acts as a proxy.
//
// Message format from content script:
//   { type: "ANALYZE_POST", data: { imageUrl: string|null, text: string|null, author: string|null } }
//
// Response sent back to the content script:
//   On success: the JSON response from the backend
//   On failure: { error: "description" }
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_POST") {
    handleAnalyzePost(message.data, sendResponse);

    // Return true to indicate we will call sendResponse asynchronously.
    // Without this, the message channel closes before the fetch completes.
    return true;
  }
});

// ---- Backend API calls ----------------------------------------------------

async function handleAnalyzePost(data, sendResponse) {
  try {
    console.log("[Prism] Sending to backend:", data);

    // Map camelCase (JS convention) → snake_case (Python convention)
    const body = {
      image_url: data.imageUrl || null,
      text: data.text || null,
      author: data.author || null,
    };

    const response = await fetch(`${API_BASE}/analyze/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Prism] Backend HTTP error:", response.status, errorText);
      sendResponse({ error: `Backend returned ${response.status}` });
      return;
    }

    const result = await response.json();
    console.log("[Prism] Backend response:", result);

    // Store the result in session storage so the popup can display it
    storeAnalyzedPost(data, result);

    sendResponse(result);
  } catch (err) {
    console.error("[Prism] Fetch failed:", err.message);
    sendResponse({ error: err.message });
  }
}

// ---- Session storage for popup feed ---------------------------------------
// After each successful analysis, append the result to chrome.storage.session
// so the popup can display a running list of analyzed posts. Capped at 50.

const MAX_STORED_POSTS = 50;

async function storeAnalyzedPost(data, result) {
  try {
    const store = await chrome.storage.session.get("analyzedPosts");
    const posts = store.analyzedPosts || [];

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      imageUrl: data.imageUrl || null,
      textExcerpt: (data.text || "").slice(0, 120),
      author: data.author || null,
      result: result,
    };

    posts.push(entry);

    // Keep only the most recent entries
    const trimmed = posts.slice(-MAX_STORED_POSTS);

    await chrome.storage.session.set({ analyzedPosts: trimmed });
    console.log("[Prism] Stored analyzed post:", entry.id);
  } catch (err) {
    console.error("[Prism] Failed to store analyzed post:", err.message);
  }
}
