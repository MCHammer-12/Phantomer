import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  css: {
    postcss: path.resolve(__dirname, "postcss.config.js"),
  },
  plugins: [react()as any],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3030,
  },
});