import { defineConfig } from "vite";

// base 用相对路径：产物在 GitHub Pages 子路径 / 本地 dist 直开都能跑
export default defineConfig({
  base: "./",
});
