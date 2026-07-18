import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project site (github.com/BREXAtlas/EdNotebook) is served at
// https://brexatlas.github.io/EdNotebook/ — base must match the repo name.
// If you switch to a custom domain or a user/org root repo, change this to "/".
export default defineConfig({
  plugins: [react()],
  base: "/EdNotebook/",
});
