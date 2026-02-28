// vite.config.js
// ---------------------------------------------------------------------------
// Vite build configuration for the Prism Chrome extension.
//
// This file tells Vite how to bundle the React-based popup UI.
// - The single entry point is index.html (the popup page).
// - Output goes to dist/, which is the folder you load as an unpacked
//   extension in Chrome.
// - Files in public/ (manifest.json, content.js, background.js, icons) are
//   copied verbatim into dist/ by Vite — they are NOT processed by the bundler.
// - No special `base` override is needed; Chrome loads extension files from
//   the local filesystem, so the default works.
// ---------------------------------------------------------------------------

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: "index.html",
      },
    },
  },
});
