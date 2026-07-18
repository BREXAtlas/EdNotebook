import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The production site is served from the root of https://ednotebook.com.
// A root base keeps generated JavaScript, CSS, manifest, favicon, and public
// asset URLs from incorrectly requesting /EdNotebook/ on the custom domain.
export default defineConfig({
  plugins: [react()],
  base: "/",
});
