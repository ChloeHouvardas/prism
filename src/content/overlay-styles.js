// overlay-styles.js
// ---------------------------------------------------------------------------
// CSS injected into the Shadow DOM host attached to each Instagram <article>.
// Because it lives inside a shadow root, these styles cannot leak out to the
// page and Instagram's styles cannot override them.
// ---------------------------------------------------------------------------

export const OVERLAY_CSS = `
  /* ---- Host / container ------------------------------------------------- */
  :host {
    all: initial;
    display: block;
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #1a1a1a;
  }

  /* ---- Badge button ----------------------------------------------------- */
  .prism-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    user-select: none;
  }

  .prism-badge:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  }

  .prism-badge:active {
    transform: scale(0.97);
  }

  /* ---- Badge state colours ---------------------------------------------- */
  .prism-badge--idle {
    background: #e8e8e8;
    color: #555;
  }

  .prism-badge--loading {
    background: #fff3cd;
    color: #856404;
  }

  .prism-badge--low {
    background: #d4edda;
    color: #155724;
  }

  .prism-badge--medium {
    background: #fff3cd;
    color: #856404;
  }

  .prism-badge--high {
    background: #f8d7da;
    color: #721c24;
  }

  .prism-badge--error {
    background: #e2e3e5;
    color: #383d41;
  }

  /* ---- Spinner ---------------------------------------------------------- */
  .prism-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(133, 100, 4, 0.3);
    border-top-color: #856404;
    border-radius: 50%;
    animation: prism-spin 0.7s linear infinite;
  }

  @keyframes prism-spin {
    to { transform: rotate(360deg); }
  }

  /* ---- Panel (slide-down results) --------------------------------------- */
  .prism-panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 300px;
    max-height: 0;
    overflow: hidden;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
    opacity: 0;
    padding: 0 16px;
  }

  .prism-panel--open {
    max-height: 500px;
    opacity: 1;
    padding: 14px 16px;
  }

  /* ---- Panel sections --------------------------------------------------- */
  .prism-section {
    margin-bottom: 12px;
  }

  .prism-section:last-child {
    margin-bottom: 0;
  }

  .prism-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin-bottom: 4px;
  }

  .prism-section-body {
    font-size: 13px;
    color: #333;
  }

  /* ---- Confidence meter ------------------------------------------------- */
  .prism-meter {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .prism-meter-bar {
    flex: 1;
    height: 6px;
    background: #eee;
    border-radius: 3px;
    overflow: hidden;
  }

  .prism-meter-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  .prism-meter-fill--low    { background: #28a745; }
  .prism-meter-fill--medium { background: #ffc107; }
  .prism-meter-fill--high   { background: #dc3545; }

  .prism-meter-label {
    font-size: 12px;
    font-weight: 600;
    min-width: 32px;
    text-align: right;
  }

  /* ---- Sources list ----------------------------------------------------- */
  .prism-sources {
    list-style: none;
    padding: 0;
    margin: 4px 0 0;
  }

  .prism-sources li {
    font-size: 12px;
    color: #555;
    padding: 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prism-sources a {
    color: #0366d6;
    text-decoration: none;
  }

  .prism-sources a:hover {
    text-decoration: underline;
  }

  /* ---- Divider ---------------------------------------------------------- */
  .prism-divider {
    border: none;
    border-top: 1px solid #eee;
    margin: 10px 0;
  }
`;
