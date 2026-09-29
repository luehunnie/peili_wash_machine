/* =====================================================================
 * 单机详情抽屉（T4）：纯叠加层，独立于锁定的 V1 页面结构之外
 *  - 打开时请求一次 GET /goods/normal/details/byDeviceId，不轮询；再次打开重新请求
 *  - 挂 document.body：30s 轮询只重建 #app 内部，绝不会关闭/重置抽屉
 *  - 关闭 = 背景遮罩点击 + 右上 X（≥44px 触控）+ Esc；单例，同一时刻最多一个
 *  - API 数据一律 textContent 渲染；机器名照抄原文，禁止任何解析推导
 *  - 绝不展示 enableReserve / reserveState / reserveMethod，无预约/支付入口
 * ===================================================================== */

import { fetchGoodsDetail } from "./api";
import { CATEGORY_TEXT, STATE_REPAIR_TEXT } from "./config";
import { el, SVG_ALERT, SVG_X } from "./dom";
import { remainingLabel } from "./time";
import type { GoodsDetailApi, GoodsItemApi, Machine, MachineState } from "./types";
import { describeError } from "./view";

export interface DeviceDrawer {
  open(machine: Machine): void;
  close(): void;
}

interface DrawerState {
  machine: Machine | null;
  loading: boolean;
  error: unknown;
  detail: GoodsDetailApi | null;
}

/**
 * 创建（全局唯一）单机详情抽屉。返回 open/close 供 app.ts 接线。
 * 骨架一次创建、挂在 body 末尾；内容随状态局部重建。
 */
export function createDrawer(): DeviceDrawer {
  /* ---- 静态骨架 ---- */
  const overlay = el("div", "dw-overlay");
  const mask = el("div", "dw-mask");
  const box = el("div", "dw");
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-labelledby", "dw-title");

  const head = el("div", "dw-head");
  const headMain = el("div", "dw-head-main");
  const titleEl = el("div", "dw-title");
  titleEl.id = "dw-title";
  const subEl = el("div", "dw-sub");
  headMain.append(titleEl, subEl);
  const closeBtn = el("button", "dw-close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "关闭详情");
  closeBtn.innerHTML = SVG_X; // 静态常量
  head.append(headMain, closeBtn);

  const body = el("div", "dw-body");
  box.append(head, body);
  overlay.append(mask, box);
  document.body.appendChild(overlay);

  /* ---- 状态 ---- */
  let state: DrawerState = { machine: null, loading: false, error: null, detail: null };
  /** 请求序号：close / 再次 open / 重试都会递增，使在途响应作废（防串台） */
  let seq = 0;
  let lastFocus: HTMLElement | null = null;

  const isOpen = () => overlay.classList.contains("open");

  function open(machine: Machine): void {
    seq++;
    const mySeq = seq;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state = { machine, loading: true, error: null, detail: null };
    overlay.classList.add("open");
    document.body.classList.add("dw-open");
    render();
    closeBtn.focus({ preventScroll: true });
    void loadDetail(machine, mySeq);
  }

  function close(): void {
    if (!isOpen()) return;
    seq++; // 在途请求作废
    overlay.classList.remove("open");
    document.body.classList.remove("dw-open");
    state = { machine: null, loading: false, error: null, detail: null };
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true }); // 轮询重渲染会换节点，断连则不强行还原
    lastFocus = null;
  }

  async function loadDetail(machine: Machine, mySeq: number): Promise<void> {
    try {
      const detail = await fetchGoodsDetail(machine.deviceId);
      if (seq !== mySeq) return; // 已关闭或已被新请求取代
      state = { machine, loading: false, error: null, detail };
    } catch (err) {
      if (seq !== mySeq) return;
      state = { machine, loading: false, error: err, detail: null };
    }
    render();
  }

  function retry(): void {
    const m = state.machine;
    if (!m) return;
    seq++;
    const mySeq = seq;
    state = { machine: m, loading: true, error: null, detail: null };
    render();
    void loadDetail(m, mySeq);
  }

  /* ---- 渲染 ---- */

  function render(): void {
    const m = state.machine;
    if (!m) return;

    titleEl.textContent = m.name; // 照抄原文，绝不解析

    subEl.textContent = "";
    subEl.appendChild(el("span", "tag", categoryText(state.detail, m)));
    const st = currentDeviceState(state.detail, m);
    subEl.appendChild(el("span", `dw-state ${stateClass(st)}`, stateText(st, m)));
    if (state.detail?.soldState === 2) subEl.appendChild(el("span", "dw-off", "停用"));

    body.textContent = "";
    if (state.loading) {
      body.setAttribute("aria-busy", "true");
      body.appendChild(buildSkeleton());
    } else {
      body.removeAttribute("aria-busy");
      if (state.error) body.appendChild(buildDrawerError(state.error, retry));
      else if (state.detail) body.appendChild(buildDetailBody(state.detail, m));
    }
  }

  /* ---- 交互接线 ---- */
  mask.addEventListener("click", close);
  closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  /** 简易焦点圈：Tab 始终留在抽屉内（aria-modal 的键盘配套） */
  function trapFocus(e: KeyboardEvent): void {
    const nodes = Array.from(
      overlay.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input, select, textarea, a[href]",
      ),
    );
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) {
      e.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !overlay.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !overlay.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  return { open, close };
}

/* ---------------- 字段口径 ---------------- */

/** 详情接口的 deviceState 是打开瞬间的最新快照；缺失/非法时回退列表态 */
function currentDeviceState(detail: GoodsDetailApi | null, m: Machine): MachineState {
  const s = detail?.deviceState;
  return s === 1 || s === 2 || s === 3 ? s : m.state;
}

function stateClass(st: MachineState): string {
  return st === 1 ? "idle" : st === 2 ? "busy" : "fault";
}

/** 与总览/明细同口径：1 空闲 / 2 占用含剩余（剩余分钟唯一来源是列表的 finishTime）/ 3 维修中 */
function stateText(st: MachineState, m: Machine): string {
  if (st === 1) return "空闲";
  if (st === 2) return remainingLabel(m.finishTime) || "占用中";
  return STATE_REPAIR_TEXT;
}

/** 类型中文名：优先详情 categoryName，回退本地字典 */
function categoryText(detail: GoodsDetailApi | null, m: Machine): string {
  const n = detail?.categoryName;
  if (typeof n === "string" && n.trim() !== "") return n;
  return CATEGORY_TEXT[m.categoryCode] ?? m.categoryCode;
}

/** 故障判定：deviceState=3 或 deviceErrorCode 有值 */
function isFault(detail: GoodsDetailApi, st: MachineState): boolean {
  return st === 3 || hasErrorCode(detail.deviceErrorCode);
}

function hasErrorCode(code: number | string | null | undefined): boolean {
  return code !== null && code !== undefined && String(code).trim() !== "";
}

/** 价格：两位小数（元）。非数字原文展示，缺失用占位符 */
function priceText(p: string | number | undefined): string {
  if (p === null || p === undefined || p === "") return "—";
  const n = Number(p);
  return Number.isFinite(n) ? n.toFixed(2) : String(p);
}

/** 时长：分钟 */
function unitText(u: string | number | undefined): string {
  if (u === null || u === undefined || u === "") return "时长未知";
  const n = Number(u);
  return Number.isFinite(n) ? `${n} 分钟` : String(u);
}

/* ---------------- 主体各状态 ---------------- */

function buildSkeleton(): HTMLElement {
  const wrap = el("div", "dw-content");
  wrap.appendChild(el("div", "dw-sec", "程序与价格"));
  for (let i = 0; i < 3; i++) {
    const row = el("div", "dw-prog skel-prog");
    const main = el("div", "dw-prog-main");
    main.appendChild(el("div", "skel-line w-40"));
    main.appendChild(el("div", "skel-line w-60"));
    const side = el("div", "dw-prog-side");
    side.appendChild(el("div", "skel-line w-25"));
    side.appendChild(el("div", "skel-line w-25"));
    row.append(main, side);
    wrap.appendChild(row);
  }
  return wrap;
}

function buildDrawerError(err: unknown, onRetry: () => void): HTMLElement {
  const info = describeError(err); // 复用全局错误口径（业务/网络区分）
  const panel = el("div", "dw-error");
  panel.appendChild(el("p", "state-title", info.title));
  panel.appendChild(el("p", "state-desc", info.desc));
  if (info.detail) panel.appendChild(el("p", "state-detail", info.detail));
  const retryBtn = el("button", "btn-primary", "重试");
  retryBtn.type = "button";
  retryBtn.addEventListener("click", onRetry);
  panel.appendChild(retryBtn);
  return panel;
}

function buildDetailBody(detail: GoodsDetailApi, m: Machine): HTMLElement {
  const wrap = el("div", "dw-content");
  const st = currentDeviceState(detail, m);

  if (isFault(detail, st)) {
    const banner = el("div", "dw-fault");
    const icon = el("span", "dw-fault-icon");
    icon.innerHTML = SVG_ALERT; // 静态常量
    banner.appendChild(icon);
    const txt = el("div");
    txt.appendChild(el("b", undefined, detail.deviceErrorMsg || "设备维修中，暂时无法使用"));
    if (hasErrorCode(detail.deviceErrorCode)) {
      txt.appendChild(el("small", undefined, `故障码 ${String(detail.deviceErrorCode)}`));
    }
    banner.appendChild(txt);
    wrap.appendChild(banner);
  }

  wrap.appendChild(el("div", "dw-sec", "程序与价格"));

  const items = detail.items ?? [];
  if (items.length === 0) {
    wrap.appendChild(el("p", "dw-empty", "这台机器暂未发布程序"));
    return wrap;
  }
  for (const it of items) {
    wrap.appendChild(buildProgramRow(it));
  }
  return wrap;
}

function buildProgramRow(it: GoodsItemApi): HTMLElement {
  const off = it.soldState === 2;
  const row = el("div", `dw-prog${off ? " off" : ""}`);

  const main = el("div", "dw-prog-main");
  const nameRow = el("div", "dw-prog-name");
  nameRow.appendChild(el("span", undefined, it.name || "未命名程序"));
  if (off) nameRow.appendChild(el("span", "dw-off", "停用"));
  main.appendChild(nameRow);
  if (it.feature) main.appendChild(el("p", "dw-prog-feature", it.feature));
  row.appendChild(main);

  const side = el("div", "dw-prog-side");
  side.appendChild(el("span", "dw-prog-price", `¥${priceText(it.price)}`));
  side.appendChild(el("span", "dw-prog-unit", unitText(it.unit)));
  row.appendChild(side);
  return row;
}
