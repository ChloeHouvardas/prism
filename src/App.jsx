// src/App.jsx — Popup UI for Prism
// ---------------------------------------------------------------------------
// Displays a running list of all Instagram posts analyzed in the current
// browser session. Data is read from chrome.storage.session and updated
// live via the onChanged listener.
// ---------------------------------------------------------------------------

import React, { useState, useEffect } from "react";
import OnboardingScreen from "./screens/OnboardingScreen";
import OnboardingScreen2 from "./screens/OnboardingScreen2";

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
    <div 
      onClick={() => post.postUrl && window.open(post.postUrl, '_blank')}
      style={{
        position: 'relative',
        zIndex: 12,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        borderRadius: '16px',
        padding: '14px',
        display: 'flex',
        gap: '14px',
        marginBottom: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}>
      {/* Thumbnail */}
      <div style={{ flexShrink: 0 }}>
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt=""
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '12px',
              objectFit: 'cover',
              border: '2px solid rgba(255, 255, 255, 0.5)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextElementSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div
          style={{
            width: '70px',
            height: '70px',
            borderRadius: '12px',
            backgroundColor: 'rgba(200, 200, 200, 0.3)',
            border: '2px solid rgba(255, 255, 255, 0.5)',
            display: post.imageUrl ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            color: '#999'
          }}
        >
          📷
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: flag pill + category + time */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          marginBottom: '8px', 
          flexWrap: 'wrap'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            padding: '5px 10px',
            borderRadius: '20px',
            whiteSpace: 'nowrap',
            ...(() => {
              if (level === 'high') return { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.3)' };
              if (level === 'medium') return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' };
              return { backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.3)' };
            })()
          }}>
            {riskIcon(level)} {riskLabel(level)}
          </span>
          {categoryLabel && (
            <span style={{
              fontSize: '10px',
              padding: '4px 8px',
              borderRadius: '16px',
              backgroundColor: 'rgba(100, 100, 100, 0.1)',
              color: '#6b7280',
              border: '1px solid rgba(150, 150, 150, 0.2)',
              whiteSpace: 'nowrap'
            }}>
              {categoryLabel}
            </span>
          )}
          <span style={{
            fontSize: '11px',
            color: '#9ca3af',
            marginLeft: 'auto',
            flexShrink: 0,
            fontWeight: '500'
          }}>
            {timeAgo}
          </span>
        </div>

        {/* Text excerpt */}
        {post.textExcerpt && (
          <p style={{
            fontSize: '14px',
            color: '#374151',
            lineHeight: '1.5',
            marginBottom: '8px',
            margin: '0 0 8px 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontWeight: '600'
          }}>
            {post.textExcerpt}
          </p>
        )}

        {/* Context summary */}
        {post.result?.summary && (
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            lineHeight: '1.5',
            marginBottom: '8px',
            margin: '0 0 8px 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontWeight: '400'
          }}>
            {post.result.summary}
          </p>
        )}

        {/* Image provenance */}
        {post.result?.image_provenance?.oldest_source_url && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: '#6b7280',
            backgroundColor: 'rgba(150, 150, 150, 0.1)',
            padding: '6px 10px',
            borderRadius: '12px',
            border: '1px solid rgba(200, 200, 200, 0.3)'
          }}>
            <span>🔗</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }}>
              {domainFromUrl(post.result.image_provenance.oldest_source_url)}
            </span>
            {post.result.image_provenance.year ? (
              <span style={{ color: '#9ca3af' }}>({post.result.image_provenance.year})</span>
            ) : null}
            {post.result.image_provenance.is_mismatch && (
              <span style={{ color: '#f59e0b', marginLeft: '4px' }} title="Image may be from a different source">⚠️</span>
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

function EmptyStateFrame12() {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      backgroundColor: '#f4f4f6',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        left: '-130px',
        top: '365px',
        width: '270px',
        height: '270px',
        zIndex: 1,
        pointerEvents: 'none'
      }}>
        <img
          src="/9926486361fa94d64aa031f0e3b7970dde9c2e0c.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <div style={{
        position: 'absolute',
        right: '-150px',
        top: '290px',
        width: '400px',
        height: '400px',
        transform: 'rotate(-18deg)',
        zIndex: 5,
        pointerEvents: 'none'
      }}>
        <img
          src="/0d76c941b6498b0075eef088c1d6b2bb07c7908c.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <div style={{
        position: 'absolute',
        right: '-95px',
        bottom: '-135px',
        width: '420px',
        height: '420px',
        transform: 'rotate(8deg)',
        zIndex: 2,
        pointerEvents: 'none'
      }}>
        <img
          src="/c17c68f8e18c5c1c1648399fb28175ffe6cb4326.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <div style={{
        position: 'absolute',
        left: '95px',
        bottom: '-120px',
        width: '250px',
        height: '250px',
        transform: 'rotate(-14deg)',
        zIndex: 2,
        pointerEvents: 'none'
      }}>
        <img
          src="/d429c39f6867b5ce2d27cfc5508281622d539613.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <p style={{
        position: 'absolute',
        left: '40px',
        top: '30px',
        margin: 0,
        width: '160px',
        textAlign: 'left',
        fontSize: '32px',
        lineHeight: '36px',
        letterSpacing: 0,
        fontWeight: 400,
        fontStyle: 'normal',
        color: '#4B4B59',
        fontFamily: '"Playfair Display", serif',
        textShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.25)'
      }}>
        PRẞM
      </p>

      <p style={{
        position: 'absolute',
        left: '50%',
        top: '250px',
        transform: 'translateX(-50%)',
        margin: 0,
        width: '255px',
        textAlign: 'center',
        fontSize: '14px',
        lineHeight: '1.35',
        fontWeight: 500,
        color: '#666983',
        fontFamily: 'Inter, sans-serif',
        zIndex: 12
      }}>
        Scroll through Instagram to start analyzing posts.
      </p>

    </div>
  );
}

// ---- Main App -------------------------------------------------------------

export default function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(null);

  // Check if onboarding was already completed
  useEffect(() => {
    chrome.storage.local.get("onboardingComplete", (data) => {
      setOnboardingStep(data.onboardingComplete ? 0 : 1);
    });
  }, []);

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

  const handleOnboardingComplete = () => {
    chrome.storage.local.set({ onboardingComplete: true });
    setOnboardingStep(0);
  };

  // Show loading while checking onboarding status
  if (onboardingStep === null) {
    return <div style={{ background: 'white', width: '100%', height: '100vh' }} />;
  }

  if (onboardingStep === 1) {
    return <OnboardingScreen onNext={() => setOnboardingStep(2)} />;
  }

  if (onboardingStep === 2) {
    return <OnboardingScreen2 onGetStarted={handleOnboardingComplete} />;
  }

  if (!loading && sortedPosts.length === 0) {
    return <EmptyStateFrame12 />;
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      backgroundColor: '#f4f4f6',
      overflow: 'hidden'
    }}>
      {/* Background gem decorations - same as empty state */}
      <div style={{
        position: 'absolute',
        left: '-130px',
        top: '365px',
        width: '270px',
        height: '270px',
        zIndex: 1,
        pointerEvents: 'none'
      }}>
        <img
          src="/9926486361fa94d64aa031f0e3b7970dde9c2e0c.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <div style={{
        position: 'absolute',
        right: '-150px',
        top: '290px',
        width: '400px',
        height: '400px',
        transform: 'rotate(-18deg)',
        zIndex: 5,
        pointerEvents: 'none'
      }}>
        <img
          src="/0d76c941b6498b0075eef088c1d6b2bb07c7908c.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <div style={{
        position: 'absolute',
        right: '-95px',
        bottom: '-135px',
        width: '420px',
        height: '420px',
        transform: 'rotate(8deg)',
        zIndex: 2,
        pointerEvents: 'none'
      }}>
        <img
          src="/c17c68f8e18c5c1c1648399fb28175ffe6cb4326.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      <div style={{
        position: 'absolute',
        left: '95px',
        bottom: '-120px',
        width: '250px',
        height: '250px',
        transform: 'rotate(-14deg)',
        zIndex: 2,
        pointerEvents: 'none'
      }}>
        <img
          src="/d429c39f6867b5ce2d27cfc5508281622d539613.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Card list overlay */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        height: '100vh',
        overflowY: 'auto',
        padding: '20px 16px'
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%'
          }}>
            <div style={{
              animation: 'spin 1s linear infinite',
              width: '20px',
              height: '20px',
              border: '2px solid rgba(75, 75, 89, 0.2)',
              borderTop: '2px solid #4B4B59',
              borderRadius: '50%'
            }} />
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0'
          }}>
            {sortedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
