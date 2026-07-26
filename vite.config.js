import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function manualChunk(id) {
  if (!id.includes("node_modules")) return undefined;
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-core";
  if (id.includes("node_modules/@supabase/")) return "supabase-core";

  // Do not force the document and upload libraries into named manual chunks.
  // Vite/Rolldown shares its dynamic-import helper with lazy modules. Forcing
  // those modules into one manual chunk can make the helper's chunk an initial
  // dependency and preload every PDF/OCR engine. Let Rollup keep each heavy
  // library with the lazy workspace that actually imports it instead.
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

// Production is served from https://ednotebook.com/ and staging from
// https://ednotebook.com/staging/. Both builds use the same source shell while
// Vite injects the correct public base and Supabase project for each mode.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: env.VITE_PUBLIC_BASE || "/",
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
  };
});
