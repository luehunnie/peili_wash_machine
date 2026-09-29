/* =====================================================================
 * 视图层：V1 清爽生活蓝（design/refs/v1-fresh-blue.html 为唯一视觉基线）
 * 结构（锁定）：head → hero → 查询面板 → 洗衣机总览 → 机器明细 → footer
 * 所有 API 数据一律 textContent 渲染；innerHTML 只用于本文件内的静态 SVG 常量
 * ===================================================================== */

import { ApiBusinessError, ApiNetworkError } from "./api";
import { floorsSummary } from "./campus";
import { CATEGORY_ORDER, CATEGORY_TEXT, STATE_REPAIR_TEXT } from "./config";
import { el, SVG_CLOUD_ALERT, SVG_CLOUD_OFF, SVG_FOLDER, SVG_LOGO, SVG_REFRESH } from "./dom";
import { clockText, floorLabel, remainingLabel } from "./time";
import type { Building, Machine } from "./types";

/* ---------------- 视图状态（app.ts 持有并传入） ---------------- */

export type Selection = "all" | number;
export type CategorySelection = "all" | string;

export interface ViewState {
  buildings: Building[];
  selectedBuilding: Selection;
  selectedCategory: CategorySelection;
  search: string;
  lastUpdate: Date | null;
  /** 最近一轮轮询的错误（有旧数据时展示在 fresh 指示条；无数据时展示错误面板） */
  cycleError: unknown;
  /** 网点列表首次加载失败（整页错误面板） */
  initialError: unknown;
  loading: boolean;
  /** 明细文件夹展开状态（30s 重渲染不丢用户操作） */
  openFolders: Set<number>;
}

export interface ViewHandlers {
  onBuildingChip: (id: Selection) => void;
  onCategoryChip: (code: CategorySelection) => void;
  onSearchSubmit: (query: string) => void;
  onManualRefresh: () => void;
  onToggleFolder: (positionId: number, open: boolean) => void;
  onRetryBuilding: (positionId: number) => void;
  /** 点击机器（总览卡片 / 明细行）→ 打开单机详情抽屉（T4） */
  onOpenMachine: (m: Machine) => void;
}

export interface ShellRefs {
  freshBtn: HTMLButtonElement;
  buildingChips: HTMLElement;
  categoryChips: HTMLElement;
  searchInput: HTMLInputElement;
  arrayCount: HTMLElement;
  arrayBox: HTMLElement;
  filePanel: HTMLElement;
  listBox: HTMLElement;
}

/* ---------------- 错误文案（验收#5：业务/网络错误区分；评审#4：无账号系统，绝不引导登录） ---------------- */

export interface ErrorInfo {
  icon: string;
  title: string;
  desc: string;
  detail: string;
}

export function describeError(err: unknown): ErrorInfo {
  if (err instanceof ApiBusinessError) {
    return {
      icon: SVG_CLOUD_ALERT,
      title: `服务暂时不可用（错误码 ${err.code}）`,
      desc: "稍后再试一次。如果一直不行，过一会儿再来看看。",
      detail: err.serverMessage || "",
    };
  }
  if (err instanceof ApiNetworkError) {
    return {
      icon: SVG_CLOUD_OFF,
      title: "网络连不上了",
      desc: "可能是网络不好，或服务暂时不可用。检查一下网络，再试试。",
      detail: err.message,
    };
  }
  return {
    icon: SVG_CLOUD_ALERT,
    title: "服务暂时不可用",
    desc: "稍后再试一次。",
    detail: err instanceof Error ? err.message : String(err ?? "未知错误"),
  };
}

export function errShortText(err: unknown): string {
  if (err instanceof ApiBusinessError) return `服务暂时不可用（错误码 ${err.code}）`;
  if (err instanceof ApiNetworkError) return "网络不通";
  return err instanceof Error ? err.message : String(err ?? "未知错误");
}

/* ---------------- 静态骨架 ---------------- */

export function renderShell(root: HTMLElement, h: ViewHandlers): ShellRefs {
  root.textContent = "";
  const wrap = el("div", "wrap");

  // head：logo
  const head = el("div", "head");
  const logo = el("div", "logo");
  logo.innerHTML = SVG_LOGO; // 静态常量
  const wordmark = el("div", "wordmark", "培黎洗衣速查");
  wordmark.appendChild(el("small", undefined, "PEILI LAUNDRY"));
  head.append(logo, wordmark);

  // hero：标语 + 简介 + 更新指示条（可点 = 手动刷新/重试）
  const hero = el("div", "hero");
  const h1 = el("h1");
  h1.append(document.createTextNode("今晚，"));
  const em = el("em", undefined, "哪台空着？");
  h1.appendChild(em);
  hero.appendChild(h1);
  hero.appendChild(
    el(
      "p",
      undefined,
      "躺在宿舍就能看到全校洗衣机的实时状态——空机亮绿灯，占用有倒计时，见空再下楼，不白跑。",
    ),
  );
  const freshBtn = el("button", "fresh");
  freshBtn.type = "button";
  freshBtn.setAttribute("aria-live", "polite");
  freshBtn.addEventListener("click", () => h.onManualRefresh());
  hero.appendChild(freshBtn);

  // 查询面板：① 楼栋 → ② 类型 + 搜索
  const panel = el("div", "panel");
  const step1 = el("div", "step");
  step1.appendChild(el("b", undefined, "①"));
  step1.appendChild(document.createTextNode("选楼栋"));
  const buildingChips = el("div", "chips");
  const step2 = el("div", "step");
  step2.appendChild(el("b", undefined, "②"));
  step2.appendChild(document.createTextNode("选类型"));
  const categoryChips = el("div", "chips");
  const form = el("form", "search");
  const searchInput = el("input");
  searchInput.type = "search";
  searchInput.name = "q";
  searchInput.placeholder = "搜楼栋 / 楼层 / 类型，如「8号」「5层」「烘干」";
  searchInput.setAttribute("aria-label", "搜索机器");
  const go = el("button", "go", "搜索");
  go.type = "submit";
  form.append(searchInput, go);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    h.onSearchSubmit(searchInput.value.trim());
  });
  panel.append(step1, buildingChips, step2, categoryChips, form);
  panel.appendChild(el("p", "search-note", "回车后跳到下方明细显示结果"));

  // 洗衣机总览
  const array = el("div", "array");
  const secTitle = el("div", "sec-title");
  secTitle.appendChild(document.createTextNode("洗衣机总览"));
  const arrayCount = el("span", undefined, "");
  secTitle.appendChild(arrayCount);
  const arrayBox = el("div", "array-box");
  array.append(secTitle, arrayBox);

  // 机器明细
  const listBox = el("div", "list");
  const listTitle = el("div", "sec-title");
  listTitle.appendChild(document.createTextNode("机器明细"));
  listTitle.appendChild(el("span", undefined, "可按楼栋 / 楼层 / 类型搜索"));
  const filePanel = el("div", "file-panel");
  listBox.append(listTitle, filePanel);

  // footer
  const footer = el("footer");
  footer.appendChild(el("span", undefined, "非官方工具 · 数据来自海乐生活"));
  footer.appendChild(document.createElement("br"));
  footer.appendChild(document.createTextNode("仅供同学们参考，以现场为准"));

  wrap.append(head, hero, panel, array, listBox, footer);
  root.appendChild(wrap);

  return {
    freshBtn,
    buildingChips,
    categoryChips,
    searchInput,
    arrayCount,
    arrayBox,
    filePanel,
    listBox,
  };
}

/* ---------------- chips ---------------- */

function makeChip(label: string, on: boolean, onClick: () => void): HTMLButtonElement {
  const chip = el("button", `chip${on ? " on" : ""}`, label);
  chip.type = "button";
  chip.setAttribute("aria-pressed", on ? "true" : "false");
  chip.addEventListener("click", onClick);
  return chip;
}

/** 楼栋 + 类型 chips（仅在楼栋列表首次就绪时重建一次，此后只切换选中态） */
export function renderChips(refs: ShellRefs, state: ViewState, h: ViewHandlers): void {
  refs.buildingChips.textContent = "";
  refs.buildingChips.appendChild(
    makeChip("全部", state.selectedBuilding === "all", () => h.onBuildingChip("all")),
  );
  for (const b of state.buildings) {
    refs.buildingChips.appendChild(
      makeChip(b.shortName, state.selectedBuilding === b.positionId, () =>
        h.onBuildingChip(b.positionId),
      ),
    );
  }

  const present = new Set(state.buildings.flatMap((b) => b.categoryCodes));
  const ordered = [...present].sort((a, b) => categoryOrder(a) - categoryOrder(b));
  refs.categoryChips.textContent = "";
  refs.categoryChips.appendChild(
    makeChip("全部", state.selectedCategory === "all", () => h.onCategoryChip("all")),
  );
  for (const code of ordered) {
    refs.categoryChips.appendChild(
      makeChip(CATEGORY_TEXT[code] ?? code, state.selectedCategory === code, () =>
        h.onCategoryChip(code),
      ),
    );
  }
}

function categoryOrder(code: string): number {
  const i = CATEGORY_ORDER.indexOf(code);
  return i === -1 ? 99 : i;
}

/** 选中态同步（点击后只改 class，不重建） */
export function syncChips(refs: ShellRefs, state: ViewState): void {
  const sync = (box: HTMLElement, isOn: (label: string) => boolean) => {
    for (const c of box.children) {
      if (c instanceof HTMLButtonElement) {
        const on = isOn(c.textContent ?? "");
        c.classList.toggle("on", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      }
    }
  };
  sync(refs.buildingChips, (label) =>
    label === "全部"
      ? state.selectedBuilding === "all"
      : state.buildings.some(
          (b) => b.shortName === label && state.selectedBuilding === b.positionId,
        ),
  );
  sync(refs.categoryChips, (label) =>
    label === "全部"
      ? state.selectedCategory === "all"
      : (CATEGORY_TEXT[state.selectedCategory] ?? state.selectedCategory) === label,
  );
}

/* ---------------- 更新指示条 ---------------- */

export function renderFresh(refs: ShellRefs, state: ViewState): void {
  const btn = refs.freshBtn;
  btn.classList.remove("error");
  if (state.initialError) {
    btn.classList.add("error");
    btn.textContent = "";
    btn.insertAdjacentHTML("beforeend", SVG_REFRESH); // 静态常量
    btn.appendChild(document.createTextNode("加载失败 · 点击重试"));
    return;
  }
  if (state.cycleError) {
    btn.classList.add("error");
    btn.textContent = "";
    btn.insertAdjacentHTML("beforeend", SVG_REFRESH);
    btn.appendChild(document.createTextNode("刷新失败 · 列表仍可用 · 点击重试"));
    return;
  }
  btn.textContent = "";
  const dot = el("i");
  btn.appendChild(dot);
  const t = state.lastUpdate ? `${clockText(state.lastUpdate)} 更新` : "刚刚更新";
  btn.appendChild(document.createTextNode(`${t} · 每 30 秒自动刷新（点击立即刷新）`));
}

/* ---------------- 机器可见集合（筛选逻辑总览与明细共用） ---------------- */

function visibleBuildings(state: ViewState): Building[] {
  return state.selectedBuilding === "all"
    ? state.buildings
    : state.buildings.filter((b) => b.positionId === state.selectedBuilding);
}

function categoryFiltered(machines: Machine[], state: ViewState): Machine[] {
  return state.selectedCategory === "all"
    ? machines
    : machines.filter((m) => m.categoryCode === state.selectedCategory);
}

export function machineMatches(m: Machine, b: Building, q: string): boolean {
  if (!q) return false;
  const needle = q.toLowerCase();
  const haystack = [
    b.name,
    b.shortName,
    floorLabel(m.floorCode),
    CATEGORY_TEXT[m.categoryCode] ?? m.categoryCode,
    m.name,
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

function stateClass(m: Machine): string {
  return m.state === 1 ? "idle" : m.state === 2 ? "busy" : "fault";
}

/** 机器卡 / 明细行 → 可点击打开详情抽屉（T4）：纯附加属性，不改锁定结构；键盘可达（Enter/Space） */
function makeOpenable(node: HTMLElement, m: Machine, h: ViewHandlers): void {
  node.classList.add("tappable");
  node.setAttribute("role", "button");
  node.tabIndex = 0;
  node.setAttribute("aria-label", `${m.name}，查看程序与价格`);
  node.addEventListener("click", () => h.onOpenMachine(m));
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      h.onOpenMachine(m);
    }
  });
}

function stateTextOverview(m: Machine): string {
  if (m.state === 1) return "空闲";
  if (m.state === 2) return remainingLabel(m.finishTime) || "占用中";
  return STATE_REPAIR_TEXT;
}

/* ---------------- 洗衣机总览 ---------------- */

export function renderOverview(refs: ShellRefs, state: ViewState, h: ViewHandlers): void {
  const box = refs.arrayBox;
  // 保留每楼横滑位置（30s 重渲染不跳）
  const scrollPos = new Map<number, number>();
  for (const elRow of box.querySelectorAll<HTMLElement>(".m-row")) {
    const pid = elRow.dataset.pid;
    if (pid) scrollPos.set(Number(pid), elRow.scrollLeft);
  }

  box.textContent = "";

  // 整页初始失败 → 错误面板
  if (state.initialError) {
    box.appendChild(buildErrorPanel(state.initialError, () => h.onManualRefresh()));
    refs.arrayCount.textContent = "";
    return;
  }

  const visible = visibleBuildings(state);

  // 计数文案：全部楼加载成功才显示台数（评审#3：不冒充刚加载成功）
  const allLoaded = state.buildings.length > 0 && state.buildings.every((b) => b.machines !== null);
  const totalMachines = state.buildings.reduce((n, b) => n + (b.machines?.length ?? 0), 0);
  refs.arrayCount.textContent = allLoaded
    ? `全校 ${state.buildings.length} 栋楼 · ${totalMachines} 台`
    : `全校 ${state.buildings.length} 栋楼`;

  if (state.loading && visible.every((b) => b.machines === null)) {
    box.appendChild(buildOverviewSkeleton());
    return;
  }

  for (const b of visible) {
    box.appendChild(buildBuildingGroup(b, state, h, scrollPos));
  }
}

function buildOverviewSkeleton(): HTMLElement {
  const group = el("div", "b-group");
  group.appendChild(el("div", "skel-head"));
  const row = el("div", "m-row");
  for (let i = 0; i < 5; i++) {
    const card = el("div", "m-card skel-card");
    card.appendChild(el("div", "skel-line w-40"));
    card.appendChild(el("div", "skel-line"));
    card.appendChild(el("div", "skel-line w-60"));
    row.appendChild(card);
  }
  group.appendChild(row);
  return group;
}

function buildBuildingGroup(
  b: Building,
  state: ViewState,
  h: ViewHandlers,
  scrollPos: Map<number, number>,
): HTMLElement {
  const group = el("div", "b-group");
  const head = el("div", "b-head");
  const name = el("div", "b-name", b.shortName);
  if (b.machines) name.appendChild(el("small", undefined, floorsSummary(b.machines)));
  else name.appendChild(el("small", undefined, state.loading ? "加载中…" : "加载失败"));
  head.appendChild(name);

  if (b.machines) {
    const shown = categoryFiltered(b.machines, state);
    const idle = shown.filter((m) => m.state === 1).length;
    const badge = el(
      "span",
      `b-idle ${idle > 0 ? "some" : "none"}`,
      idle > 0 ? `空闲 ${idle} / ${shown.length}` : `全忙 0 / ${shown.length}`,
    );
    head.appendChild(badge);
  }
  group.appendChild(head);

  const row = el("div", "m-row");
  row.dataset.pid = String(b.positionId);

  if (b.machines === null) {
    if (!state.loading) {
      // 单楼首次加载失败：行内错误卡 + 重试（失败粒度 = 楼）
      const errCard = el("div", "m-error");
      errCard.appendChild(el("span", undefined, "这栋楼加载失败"));
      const retry = el("button", "link-btn", "重试");
      retry.type = "button";
      retry.addEventListener("click", () => h.onRetryBuilding(b.positionId));
      errCard.appendChild(retry);
      row.appendChild(errCard);
    }
  } else {
    const shown = categoryFiltered(b.machines, state);
    if (shown.length === 0) {
      const label =
        state.selectedCategory === "all"
          ? "暂无机器"
          : `暂无${CATEGORY_TEXT[state.selectedCategory] ?? "该类型"}`;
      row.appendChild(el("span", "empty-note", label));
    } else {
      for (const m of shown) {
        const cls = stateClass(m);
        const card = el("div", `m-card ${cls}`);
        const top = el("div", "m-top");
        top.appendChild(el("span", "lamp"));
        top.appendChild(el("span", "floor", floorLabel(m.floorCode)));
        card.appendChild(top);
        card.appendChild(el("span", "m-name", m.name)); // 照抄原文
        card.appendChild(el("span", "m-state", stateTextOverview(m)));
        makeOpenable(card, m, h); // T4：点卡片开抽屉
        row.appendChild(card);
      }
    }
  }
  group.appendChild(row);

  const saved = scrollPos.get(b.positionId);
  if (saved) row.scrollLeft = saved;
  return group;
}

function buildErrorPanel(err: unknown, onRetry: () => void): HTMLElement {
  const info = describeError(err);
  const panel = el("div", "state-panel");
  const icon = el("div", "state-icon");
  icon.innerHTML = info.icon; // 静态常量 SVG
  panel.appendChild(icon);
  panel.appendChild(el("p", "state-title", info.title));
  panel.appendChild(el("p", "state-desc", info.desc));
  if (info.detail) panel.appendChild(el("p", "state-detail", info.detail));
  const retry = el("button", "btn-primary", "重试");
  retry.type = "button";
  retry.addEventListener("click", onRetry);
  panel.appendChild(retry);
  return panel;
}

/* ---------------- 机器明细（文件系统式） ---------------- */

export function renderDetails(refs: ShellRefs, state: ViewState, h: ViewHandlers): void {
  const panel = refs.filePanel;
  panel.textContent = "";

  if (state.initialError) {
    panel.appendChild(el("p", "empty-note", "先解决上面的加载问题，明细就会出现"));
    return;
  }
  if (state.loading && state.buildings.every((b) => b.machines === null)) {
    for (let i = 0; i < 3; i++) panel.appendChild(buildFolderSkeleton());
    return;
  }

  const q = state.search;
  for (const b of visibleBuildings(state)) {
    // 命中数与展示同口径：都在当前类型筛选范围内统计（否则会出现「命中 7 台」却显示 0 台）
    const shownForHits = b.machines ? categoryFiltered(b.machines, state) : null;
    const hits = shownForHits?.filter((m) => machineMatches(m, b, q)).length ?? 0;
    // 搜索态：命中楼自动展开；否则尊重用户手动展开状态
    const open = q ? hits > 0 : state.openFolders.has(b.positionId);

    const grp = el("details", "grp");
    if (open) grp.open = true;
    grp.addEventListener("toggle", () => h.onToggleFolder(b.positionId, grp.open));

    const summary = el("summary", "folder");
    summary.innerHTML = SVG_FOLDER; // 静态常量
    summary.appendChild(document.createTextNode(` ${b.shortName} `));
    const cnt = el("span", "cnt");
    if (b.machines) {
      const shown = categoryFiltered(b.machines, state);
      const idle = shown.filter((m) => m.state === 1).length;
      cnt.textContent = `${shown.length} 台 · 空闲 ${idle}`;
    } else {
      cnt.textContent = state.loading ? "加载中…" : "加载失败";
    }
    summary.appendChild(cnt);
    summary.appendChild(el("span", "chev", "▸"));
    grp.appendChild(summary);

    if (b.machines === null) {
      if (!state.loading) {
        const errRow = el("div", "f-row f-error");
        errRow.appendChild(el("span", undefined, "这栋楼加载失败"));
        const retry = el("button", "link-btn", "重试");
        retry.type = "button";
        retry.addEventListener("click", () => h.onRetryBuilding(b.positionId));
        errRow.appendChild(retry);
        grp.appendChild(errRow);
      }
    } else {
      const shown = categoryFiltered(b.machines, state);
      if (shown.length === 0) {
        grp.appendChild(
          el(
            "div",
            "f-row",
            state.selectedCategory === "all"
              ? "暂无机器"
              : `暂无${CATEGORY_TEXT[state.selectedCategory] ?? "该类型"}`,
          ),
        );
      } else {
        for (const m of shown) {
          const hit = q ? machineMatches(m, b, q) : false;
          grp.appendChild(buildMachineRow(m, hit, h));
        }
      }
    }
    panel.appendChild(grp);
  }

  if (q && panel.children.length > 0) {
    const note = el("p", "search-hits-note");
    const totalHits = visibleBuildings(state).reduce(
      (n, b) =>
        n +
        (b.machines
          ? categoryFiltered(b.machines, state).filter((m) => machineMatches(m, b, q)).length
          : 0),
      0,
    );
    note.textContent =
      totalHits > 0 ? `「${q}」命中 ${totalHits} 台（高亮显示）` : `没有找到「${q}」相关的机器`;
    panel.appendChild(note);
  }
}

function buildFolderSkeleton(): HTMLElement {
  const grp = el("details", "grp");
  const summary = el("summary", "folder");
  summary.appendChild(el("div", "skel-line w-40"));
  grp.appendChild(summary);
  return grp;
}

function buildMachineRow(m: Machine, hit: boolean, h: ViewHandlers): HTMLElement {
  const row = el("div", `f-row${hit ? " hit" : ""}`);
  const main = el("div");
  const tags = el("div", "f-tags");
  tags.appendChild(el("span", "tag", floorLabel(m.floorCode)));
  tags.appendChild(el("span", "tag", CATEGORY_TEXT[m.categoryCode] ?? m.categoryCode));
  main.appendChild(tags);
  main.appendChild(el("div", "f-name", m.name)); // 照抄原文
  row.appendChild(main);

  const cls = stateClass(m);
  const stateEl = el("span", `f-state ${cls}`);
  stateEl.textContent = m.state === 2 ? "占用" : m.state === 1 ? "空闲" : STATE_REPAIR_TEXT;
  row.appendChild(stateEl);

  const time = el("span", "f-time");
  if (m.state === 2) {
    const label = remainingLabel(m.finishTime) || "占用中";
    const b = el("b", undefined, label);
    time.appendChild(b);
  } else {
    time.textContent = "—";
  }
  row.appendChild(time);
  makeOpenable(row, m, h); // T4：点行开抽屉
  return row;
}
