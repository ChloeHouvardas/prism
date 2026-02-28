// vite.content.config.js
// ---------------------------------------------------------------------------
// Second Vite config that bundles src/content/index.jsx into a single IIFE
// file at dist/content.js. This replaces the old plain-JS public/content.js.
//
// Usage:  vite build --config vite.content.config.js
// ---------------------------------------------------------------------------

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Content scripts run in a web page, not a Node environment.
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist",

    // IMPORTANT: do not wipe dist/ — the popup build already wrote files there.
    emptyOutDir: false,

    lib: {
      entry: "src/content/index.jsx",
      name: "PrismContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },

    rollupOptions: {
      output: {
        // Everything in one file — no dynamic imports or code splitting.
        inlineDynamicImports: true,
      },
    },

    // Keep bundle reasonably readable for debugging during development.
    minify: true,
    sourcemap: false,
  },
});
