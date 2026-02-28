// src/main.jsx — React Entry Point
// ---------------------------------------------------------------------------
// This file bootstraps the React application that powers the extension popup.
// It mounts the root <App /> component into the #root div in index.html.
//
// The popup is destroyed and recreated every time the user opens it by
// clicking the toolbar icon, so any state that should persist across opens
// must be saved to chrome.storage (not React state alone).
// ---------------------------------------------------------------------------

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
