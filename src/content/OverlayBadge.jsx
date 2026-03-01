// OverlayBadge.jsx
// ---------------------------------------------------------------------------
// React component rendered inside a Shadow DOM host on each Instagram post.
//
// States: idle → loading → result (low / medium / high) or error
// The badge shows a small pill; clicking it toggles a slide-down panel with
// the full analysis results (confidence meter, summary, sources).
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useCallback } from "react";

// ---- Helpers --------------------------------------------------------------

/**
 * Determine risk level from the backend response.
 * Backend sends:  flag (bool) — true = needs attention
 *                 confidence (string) — "low" | "medium" | "high"
 */
function riskLevel(flag, confidence) {
  if (!flag) return "low"; // flag is false or undefined → safe

  // flag is true — use confidence to determine severity
  const c = (confidence || "").toLowerCase();
  if (c === "high") return "high";
  if (c === "medium") return "medium";
  return "medium"; // flagged but low confidence → still medium
}

/**
 * Map confidence string to a 0–1 number for the meter bar.
 */
function confidenceToNumber(confidence) {
  const c = (confidence || "").toLowerCase();
  if (c === "high") return 0.9;
  if (c === "medium") return 0.65;
  if (c === "low") return 0.35;
  return 0;
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

// ---- Component ------------------------------------------------------------

export default function OverlayBadge({ postData }) {
  const [state, setState] = useState("idle"); // idle | loading | result | error
  const [result, setResult] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fire analysis on mount
  useEffect(() => {
    if (!postData || (!postData.imageUrl && !postData.text)) return;

    // Guard against stale extension context (happens after extension
    // reload while the page is still open).
    if (!chrome?.runtime?.id) {
      console.warn("[Prism] Extension context invalidated — skipping analysis");
      setErrorMsg("Extension was reloaded. Please refresh the page.");
      setState("error");
      return;
    }

    setState("loading");

    try {
      chrome.runtime.sendMessage(
        { type: "ANALYZE_POST", data: postData },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Prism] Message error:", chrome.runtime.lastError.message);
            setErrorMsg(chrome.runtime.lastError.message);
            setState("error");
            return;
          }

          if (response && response.error) {
            console.error("[Prism] Backend error:", response.error);
            setErrorMsg(response.error);
            setState("error");
            return;
          }

          console.log("[Prism] Analysis result:", response);
          setResult(response);
          setState("result");
        }
      );
    } catch (err) {
      console.warn("[Prism] sendMessage failed:", err.message);
      setErrorMsg("Extension was reloaded. Please refresh the page.");
      setState("error");
    }
  }, [postData]);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev);
  }, []);

  // ---- Determine badge appearance -----------------------------------------
  let badgeClass = "prism-badge";
  let badgeContent;

  if (state === "idle") {
    badgeClass += " prism-badge--idle";
    badgeContent = <span>🔘 Prism</span>;
  } else if (state === "loading") {
    badgeClass += " prism-badge--loading";
    badgeContent = (
      <>
        <span className="prism-spinner" />
        <span>Analysing…</span>
      </>
    );
  } else if (state === "error") {
    badgeClass += " prism-badge--error";
    badgeContent = <span>❌ Error</span>;
  } else {
    // result — backend returns flat unified shape
    const level = riskLevel(result?.flag, result?.confidence);
    badgeClass += ` prism-badge--${level}`;
    badgeContent = (
      <span>
        {riskIcon(level)} {riskLabel(level)}
      </span>
    );
  }

  // ---- Render -------------------------------------------------------------
  function ResultPanel({ result }) {
    // Category pill mapping
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
    const level = riskLevel(result?.flag, result?.confidence);
    const confidenceNum = confidenceToNumber(result?.confidence);
    const pillLabel = result?.category && result.category !== "none" ? CATEGORY_EMOJI[result.category] : null;
    return (
      <>
        <div className="prism-section">
          <div className="prism-section-title">Verdict</div>
          <div className="prism-section-body">
            <span className={`prism-category-pill`}>{pillLabel}</span>
            {result?.summary && <div style={{ marginTop: 4 }}>{result.summary}</div>}
          </div>
          <div className="prism-meter">
            <div className="prism-meter-bar">
              <div
                className={`prism-meter-fill prism-meter-fill--${level}`}
                style={{ width: `${Math.round(confidenceNum * 100)}%` }}
              />
            </div>
            <span className="prism-meter-label">{result?.confidence || "N/A"}</span>
          </div>
        </div>
        {result?.sources?.length > 0 && (
          <>
            <hr className="prism-divider" />
            <div className="prism-section">
              <div className="prism-section-title">Sources</div>
              <ul className="prism-sources">
                {result.sources.slice(0, 5).map((src, i) => (
                  <li key={i}>
                    <a href={src.url} target="_blank" rel="noopener noreferrer">
                      {src.title || src.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {result?.image_provenance && (
          <>
            <hr className="prism-divider" />
            <div className="prism-section">
              <div className="prism-section-title">Image Provenance</div>
              <div className="prism-section-body">
                {result.image_provenance.context && <p>{result.image_provenance.context}</p>}
                {result.image_provenance.is_mismatch && (
                  <p>⚠️ This image appears to originate from a different source</p>
                )}
                {result.image_provenance.oldest_source_url && (
                  <p>
                    🔗 Earliest source:{" "}
                    <a href={result.image_provenance.oldest_source_url} target="_blank" rel="noopener noreferrer" style={{ color: "#0366d6" }}>
                      {(() => { try { return new URL(result.image_provenance.oldest_source_url).hostname; } catch(e) { return result.image_provenance.oldest_source_url; } })()}
                    </a>
                    {result.image_provenance.year && ` (${result.image_provenance.year})`}
                  </p>
                )}
                {!result.image_provenance.context &&
                  !result.image_provenance.oldest_source_url &&
                  !result.image_provenance.is_mismatch && (
                    <p>No significant image matches found.</p>
                )}
              </div>
            </div>
          </>
        )}
        <hr className="prism-divider" />
        <div className="prism-section">
          <div className="prism-section-title">Why?</div>
          <div className="prism-reasoning-grid">
            <div className="prism-reasoning-card"><strong>Image</strong><br />{result?.reasoning?.image}</div>
            <div className="prism-reasoning-card"><strong>Text</strong><br />{result?.reasoning?.text}</div>
            <div className="prism-reasoning-card"><strong>Author</strong><br />{result?.reasoning?.author}</div>
            <div className="prism-reasoning-card"><strong>Consistency</strong><br />{result?.reasoning?.consistency}</div>
          </div>
        </div>
      </>
    );
  }

  // ---- Return the badge + expandable panel --------------------------------
  return (
    <div className="prism-container">
      <button className={badgeClass} onClick={togglePanel}>
        {badgeContent}
      </button>
      {panelOpen && (
        <div className="prism-panel prism-panel--open">
          {state === "error" && (
            <div className="prism-section">
              <div className="prism-section-body" style={{ color: "#d32f2f" }}>
                {errorMsg || "Something went wrong."}
              </div>
            </div>
          )}
          {state === "loading" && (
            <div className="prism-section">
              <div className="prism-section-body">Analysing this post…</div>
            </div>
          )}
          {state === "result" && result && <ResultPanel result={result} />}
        </div>
      )}
    </div>
  );
}
