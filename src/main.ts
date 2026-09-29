/* 入口：样式 → 正常应用 or ?debug=1 自检 */

import "./style.css";
import { initApp } from "./app";
import { runDebugSelfTest } from "./debug";

// 未捕获异常只落控制台（验收期靠控制台定位；不打断已渲染的界面）
window.addEventListener("error", (e) =>
  console.error("[全局异常]", e.message, e.filename, e.lineno),
);
window.addEventListener("unhandledrejection", (e) =>
  console.error("[未处理的 Promise 拒绝]", e.reason),
);

const app = document.querySelector<HTMLElement>("#app");
if (app) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("debug") === "1") {
    void runDebugSelfTest(app);
  } else {
    initApp(app);
  }
}
