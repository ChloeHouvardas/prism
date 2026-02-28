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

    setState("loading");

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
    // result — backend returns { text: {...}, image: {...} }
    const textResult = result?.text;
    const level = riskLevel(textResult?.flag, textResult?.confidence);
    badgeClass += ` prism-badge--${level}`;
    badgeContent = (
      <span>
        {riskIcon(level)} {riskLabel(level)}
      </span>
    );
  }

  // ---- Render -------------------------------------------------------------
  return (
    <>
      <button className={badgeClass} onClick={togglePanel}>
        {badgeContent}
      </button>

      <div className={`prism-panel ${panelOpen ? "prism-panel--open" : ""}`}>
        {state === "loading" && <p className="prism-section-body">Running analysis…</p>}

        {state === "error" && (
          <div className="prism-section">
            <div className="prism-section-title">Error</div>
            <p className="prism-section-body">{errorMsg || "Something went wrong."}</p>
          </div>
        )}

        {state === "result" && result && <ResultPanel result={result} />}
      </div>
    </>
  );
}

// ---- Result sub-component -------------------------------------------------

function ResultPanel({ result }) {
  // Backend response fields are "text" and "image" (not "text_analysis" / "image_analysis")
  const textAnalysis = result.text;
  const imageAnalysis = result.image;

  const textLevel = riskLevel(textAnalysis?.flag, textAnalysis?.confidence);
  const confidenceNum = confidenceToNumber(textAnalysis?.confidence);

  return (
    <>
      {/* ---- Text analysis ---- */}
      {textAnalysis && (
        <div className="prism-section">
          <div className="prism-section-title">Text Analysis</div>
          <div className="prism-section-body">{textAnalysis.summary || "No summary available."}</div>

          <div className="prism-meter">
            <div className="prism-meter-bar">
              <div
                className={`prism-meter-fill prism-meter-fill--${textLevel}`}
                style={{ width: `${Math.round(confidenceNum * 100)}%` }}
              />
            </div>
            <span className="prism-meter-label">
              {textAnalysis.confidence || "N/A"}
            </span>
          </div>
        </div>
      )}

      {/* ---- Sources ---- */}
      {textAnalysis?.sources?.length > 0 && (
        <>
          <hr className="prism-divider" />
          <div className="prism-section">
            <div className="prism-section-title">Sources</div>
            <ul className="prism-sources">
              {textAnalysis.sources.slice(0, 5).map((src, i) => (
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

      {/* ---- Image analysis ---- */}
      {imageAnalysis && (
        <>
          <hr className="prism-divider" />
          <div className="prism-section">
            <div className="prism-section-title">Image Analysis</div>
            <div className="prism-section-body">
              {imageAnalysis.context && (
                <p>{imageAnalysis.context}</p>
              )}
              {imageAnalysis.is_mismatch && (
                <p>
                  ⚠️ This image appears to originate from a different source
                </p>
              )}
              {imageAnalysis.oldest_source_url && (
                <p>
                  🔗 Earliest source:{" "}
                  <a
                    href={imageAnalysis.oldest_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#0366d6" }}
                  >
                    {(() => { try { return new URL(imageAnalysis.oldest_source_url).hostname; } catch(e) { return imageAnalysis.oldest_source_url; } })()}
                  </a>
                  {imageAnalysis.year && ` (${imageAnalysis.year})`}
                </p>
              )}
              {!imageAnalysis.context &&
                !imageAnalysis.oldest_source_url &&
                !imageAnalysis.is_mismatch && (
                  <p>No significant image matches found.</p>
                )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
