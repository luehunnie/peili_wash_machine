/* =====================================================================
 * DOM 基础设施
 * ===================================================================== */

/**
 * 建元素。所有 API 数据一律走 textContent 赋值，杜绝注入 HTML
 * （DOMPurify 之类因此不需要——约束是永远不用 innerHTML 渲染 API 数据）。
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/* ---- 内联 SVG（静态常量，无 API 数据，可安全 innerHTML；图标源 lucide ISC / 自绘） ---- */

export const SVG_LOGO =
  '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="13" r="4.5"/><circle cx="7.6" cy="6.4" r="1" fill="#fff" stroke="none"/></svg>';

export const SVG_FOLDER =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#2e7df0" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A2 2 0 0 1 5 4.5h4l2 2.5h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

/** lucide「rotate-cw」（ISC License，https://lucide.dev） */
export const SVG_REFRESH =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';

export const SVG_CLOUD_OFF =
  '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#9db0c2" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M17.2 17.5H7a4.2 4.2 0 0 1-.7-8.35A6 6 0 0 1 16.6 7.3a4.8 4.8 0 0 1 3.3 7.1" fill="#f0f3f6"/><path d="M3.5 3.5l17 17" stroke="#c0392b" stroke-linecap="round"/></svg>';

export const SVG_CLOUD_ALERT =
  '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#9db0c2" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M17.2 18H7a4.2 4.2 0 0 1-.7-8.35A6 6 0 0 1 16.6 7.8A4.8 4.8 0 0 1 17.2 18z" fill="#f0f3f6"/><path d="M12 10.2v3.6" stroke="#e8951f" stroke-linecap="round"/><circle cx="12" cy="16.2" r="1" fill="#e8951f" stroke="none"/></svg>';

/** lucide「x」（T4 抽屉关闭按钮） */
export const SVG_X =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/** lucide「triangle-alert」（T4 抽屉故障横幅） */
export const SVG_ALERT =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
