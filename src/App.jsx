// src/App.jsx — Popup UI for Prism
// ---------------------------------------------------------------------------
// Displays a running list of all Instagram posts analyzed in the current
// browser session. Data is read from chrome.storage.session and updated
// live via the onChanged listener.
// ---------------------------------------------------------------------------

import React, { useState, useEffect } from "react";

// ---- Helpers --------------------------------------------------------------

function riskLevel(flag, confidence) {
  if (!flag) return "low";
  const c = (confidence || "").toLowerCase();
  if (c === "high") return "high";
  return "medium";
}

function riskLabel(level) {
  switch (level) {
    case "high":
      return "Likely Misleading";
    case "medium":
      return "Uncertain";
    case "low":
      return "Looks OK";
    default:
      return "Unknown";
  }
}

function riskIcon(level) {
  switch (level) {
    case "high":
      return "⚠️";
    case "medium":
      return "🔍";
    case "low":
      return "✅";
    default:
      return "🔘";
  }
}

const PILL_STYLES = {
  low: "bg-green-600/20 text-green-400 border border-green-600/30",
  medium: "bg-amber-600/20 text-amber-400 border border-amber-600/30",
  high: "bg-red-600/20 text-red-400 border border-red-600/30",
};

const CATEGORY_LABELS = {
  fabricated: "Fabricated",
  false_context: "False Context",
  manipulated: "Manipulated",
  imposter: "Imposter Content",
  false_connection: "False Connection",
  satire: "Satire",
  astroturfing: "Astroturfing",
  sponsored_disguised: "Sponsored / Disguised",
};

function domainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ---- PostCard component ---------------------------------------------------

function PostCard({ post }) {
  const textResult = post.result?.text;
  const imageResult = post.result?.image;
  const level = riskLevel(post.result?.flag, post.result?.confidence);
  const pill = PILL_STYLES[level] || PILL_STYLES.low;
  const CATEGORY_EMOJI = {
    fabricated: "🚫 Fabricated Content",
    false_context: "🖼️ False Context",
    manipulated: "✂️ Manipulated Content",
    imposter: "🎭 Imposter Content",
    false_connection: "🔗 False Connection / Clickbait",
    satire: "🎪 Satire or Parody",
    astroturfing: "🤖 Astroturfing",
    sponsored_disguised: "💰 Undisclosed Sponsored Content",
    none: null
  };
  const categoryLabel = post.result?.category && post.result.category !== "none"
    ? CATEGORY_EMOJI[post.result.category] || null
    : null;

  const timeAgo = formatTimeAgo(post.timestamp);

  return (
    <div className="bg-prism-surface rounded-lg p-3 flex gap-3 hover:bg-prism-card transition-colors duration-150">
      {/* Thumbnail */}
      <div className="flex-shrink-0">
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt=""
            className="w-12 h-12 rounded-md object-cover bg-prism-card"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextElementSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className={`w-12 h-12 rounded-md bg-prism-card flex items-center justify-center text-prism-muted text-lg ${post.imageUrl ? "hidden" : ""}`}
        >
          📷
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: flag pill + time */}
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pill}`}>
            {riskIcon(level)} {riskLabel(level)}
          </span>
          {categoryLabel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/50 text-gray-400 border border-gray-600/30">
              {categoryLabel}
            </span>
          )}
          <span className="text-[10px] text-prism-muted flex-shrink-0 ml-auto">
            {timeAgo}
          </span>
        </div>

        {/* Text excerpt */}
        {post.textExcerpt && (
          <p className="text-xs text-prism-muted leading-snug line-clamp-2 mb-1.5">
            {post.textExcerpt}
          </p>
        )}

        {/* Context summary */}
        {post.result?.summary && (
          <p className="text-[11px] text-gray-400 leading-snug line-clamp-2 mb-1">
            {post.result.summary}
          </p>
        )}

        {/* Image provenance */}
        {post.result?.image_provenance?.oldest_source_url && (
          <div className="flex items-center gap-1 text-[10px] text-prism-muted">
            <span>🔗</span>
            <span className="truncate">
              {domainFromUrl(post.result.image_provenance.oldest_source_url)}
            </span>
            {post.result.image_provenance.year ? (
              <span className="text-gray-500">({post.result.image_provenance.year})</span>
            ) : null}
            {post.result.image_provenance.is_mismatch && (
              <span className="text-amber-400 ml-1" title="Image may be from a different source">⚠️</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Time formatting ------------------------------------------------------

function formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ---- Main App -------------------------------------------------------------

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load posts from session storage on mount
  useEffect(() => {
    chrome.storage.session.get("analyzedPosts", (data) => {
      setPosts(data.analyzedPosts || []);
      setLoading(false);
    });

    // Listen for live updates from background.js
    const onChange = (changes, area) => {
      if (area === "session" && changes.analyzedPosts) {
        setPosts(changes.analyzedPosts.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(onChange);

    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  // Sort newest first
  const sortedPosts = [...posts].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col h-screen bg-prism-bg">
      {/* Header */}
      <header className="flex-shrink-0 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-prism-primary to-prism-accent bg-clip-text text-transparent">
            Prism
          </h1>
          {sortedPosts.length > 0 && (
            <span className="text-[10px] font-medium text-prism-muted bg-prism-surface px-2 py-0.5 rounded-full">
              {sortedPosts.length} post{sortedPosts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-[11px] text-prism-muted tracking-wide uppercase mt-1">
          Instagram misinformation detector
        </p>
      </header>

      {/* Divider */}
      <div className="h-px bg-prism-surface mx-4" />

      {/* Body */}
      <main className="flex-1 overflow-y-auto prism-scroll px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-5 h-5 border-2 border-prism-primary border-t-transparent rounded-full" />
          </div>
        ) : sortedPosts.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="text-4xl mb-4 opacity-60">🔍</div>
            <p className="text-sm text-prism-muted leading-relaxed">
              Scroll through Instagram to start analyzing posts.
            </p>
          </div>
        ) : (
          /* Post feed */
          <div className="flex flex-col gap-2">
            {sortedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 px-4 py-2 text-center">
        <small className="text-[10px] text-gray-600">v1.0.0</small>
      </footer>
    </div>
  );
}
