import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes asset paths relative, so the build works on GitHub Pages
// whether the site is served from username.github.io or username.github.io/repo-name/
export default defineConfig({
  plugins: [react()],
  base: "./",
});
