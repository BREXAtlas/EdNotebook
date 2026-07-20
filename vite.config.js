import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function manualChunk(id) {
  if (!id.includes("node_modules")) return undefined;
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-core";
  if (id.includes("node_modules/@supabase/")) return "supabase-core";
  if (/node_modules\/(pdfjs-dist|mammoth|tesseract\.js|@tesseract\.js-data|@opencvjs|jspdf)\//.test(id)) return "document-tools";
  if (id.includes("node_modules/tus-js-client/")) return "upload-tools";

  // Let Rollup place every other dependency with the route or lazy feature that
  // imports it. A catch-all vendor chunk would pull transitive OCR/PDF helpers
  // back into the initial page even though the workspace itself is lazy.
  return undefined;
}

function featureChunkFileName(chunkInfo) {
  const coreNames = new Set(["index", "react-core", "supabase-core"]);
  const folder = coreNames.has(chunkInfo.name) ? "core" : "features";
  return `assets/${folder}/[name]-[hash].js`;
}

function assetFileName(assetInfo) {
  const name = assetInfo.names?.[0] || assetInfo.name || "asset";
  if (name.endsWith(".css")) return "assets/styles/[name]-[hash][extname]";
  if (/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(name)) return "assets/media/[name]-[hash][extname]";
  if (/\.(woff2?|ttf|otf)$/i.test(name)) return "assets/fonts/[name]-[hash][extname]";
  return "assets/static/[name]-[hash][extname]";
}

// The production site is served from the root of https://ednotebook.com.
// Core account code and feature workspaces are emitted separately so the first
// page does not download document/OCR/publishing tools until those routes open.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: manualChunk,
        entryFileNames: "assets/core/[name]-[hash].js",
        chunkFileNames: featureChunkFileName,
        assetFileNames: assetFileName,
      },
    },
  },
});