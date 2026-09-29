/* =====================================================================
 * 控制层：状态 + 轮询 + 交互
 *  - 30s 定时轮询；页面不可见时暂停（visibilitychange），回到前台立即补一轮
 *  - 只轮询当前展示的楼栋（「全部」= 本校 9 楼，仍限定校区范围内）
 *  - Promise.allSettled 合并：失败的楼保留旧数据，不整页崩
 * ===================================================================== */

import { fetchBuildingMachines, fetchCampusBuildings } from "./campus";
import { POLL_INTERVAL_MS } from "./config";
import type { Building } from "./types";
import type { CategorySelection, Selection, ShellRefs, ViewHandlers, ViewState } from "./view";
import {
  renderChips,
  renderDetails,
  renderFresh,
  renderOverview,
  renderShell,
  syncChips,
} from "./view";

export function initApp(root: HTMLElement): void {
  const state: ViewState = {
    buildings: [],
    selectedBuilding: "all",
    selectedCategory: "all",
    search: "",
    lastUpdate: null,
    cycleError: null,
    initialError: null,
    loading: false,
    openFolders: new Set<number>(),
  };

  const handlers: ViewHandlers = {
    onBuildingChip: (id: Selection) => {
      state.selectedBuilding = id;
      syncChips(refs, state);
      renderOverview(refs, state, handlers);
      renderDetails(refs, state, handlers);
      void pollCycle(); // 换楼立即拉一次当前楼
    },
    onCategoryChip: (code: CategorySelection) => {
      state.selectedCategory = code;
      syncChips(refs, state);
      renderOverview(refs, state, handlers);
      renderDetails(refs, state, handlers);
    },
    onSearchSubmit: (query: string) => {
      state.search = query;
      renderDetails(refs, state, handlers);
      if (query) refs.listBox.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    onManualRefresh: () => {
      if (state.initialError) void load();
      else void pollCycle();
    },
    onToggleFolder: (positionId: number, open: boolean) => {
      if (open) state.openFolders.add(positionId);
      else state.openFolders.delete(positionId);
    },
    onRetryBuilding: (positionId: number) => void refreshBuildings([positionId]),
  };

  const refs: ShellRefs = renderShell(root, handlers);

  function renderAll(): void {
    renderOverview(refs, state, handlers);
    renderDetails(refs, state, handlers);
    renderFresh(refs, state);
    syncChips(refs, state);
  }

  /** 首次加载：网点列表 → chips → 首轮机器数据 */
  async function load(): Promise<void> {
    state.loading = true;
    state.initialError = null;
    state.cycleError = null;
    renderOverview(refs, state, handlers);
    renderDetails(refs, state, handlers);
    renderFresh(refs, state);
    try {
      state.buildings = await fetchCampusBuildings();
      renderChips(refs, state, handlers);
      await pollCycle();
    } catch (err) {
      state.initialError = err;
      renderAll();
    } finally {
      state.loading = false;
      renderFresh(refs, state);
    }
  }

  /** 一轮轮询：并发拉当前可见楼栋，allSettled 合并（失败楼保留旧数据） */
  async function pollCycle(): Promise<void> {
    if (state.initialError || state.buildings.length === 0) return;
    const targets =
      state.selectedBuilding === "all"
        ? state.buildings
        : state.buildings.filter((b) => b.positionId === state.selectedBuilding);
    await refreshBuildings(targets.map((b) => b.positionId));
  }

  async function refreshBuildings(positionIds: number[]): Promise<void> {
    const targets = state.buildings.filter((b) => positionIds.includes(b.positionId));
    if (targets.length === 0) return;

    const results = await Promise.allSettled(
      targets.map((b: Building) => fetchBuildingMachines(b)),
    );

    let anyOk = false;
    let anyFail = false;
    let firstError: unknown = null;
    for (const [i, r] of results.entries()) {
      const b = targets[i];
      if (!b) continue;
      if (r.status === "fulfilled") {
        b.machines = r.value; // 失败楼不触碰：保留上一轮数据
        anyOk = true;
      } else {
        anyFail = true;
        if (firstError === null) firstError = r.reason;
      }
    }
    if (anyOk) state.lastUpdate = new Date();
    state.cycleError = anyFail ? (firstError ?? new Error("部分楼栋刷新失败")) : null;

    renderOverview(refs, state, handlers);
    renderDetails(refs, state, handlers);
    renderFresh(refs, state);
  }

  /** 30s 定时轮询；不可见暂停 */
  window.setInterval(() => {
    if (state.loading || state.initialError) return;
    if (document.hidden) return; // 省流量红线：后台标签页不请求
    void pollCycle();
  }, POLL_INTERVAL_MS);

  // 回到前台：若距上次更新超过一个周期，立即补一轮
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (state.loading || state.initialError || state.buildings.length === 0) return;
    const age = state.lastUpdate
      ? Date.now() - state.lastUpdate.getTime()
      : Number.POSITIVE_INFINITY;
    if (age >= POLL_INTERVAL_MS) void pollCycle();
  });

  void load();
}
