/* =====================================================================
 * 数据层：网点（楼栋）与机器明细
 *  - 取满 nearPosition 全部分页（id 去重 + total 判定结束）后按名称过滤本校
 *  - 逐楼逐类型取 deviceDetailPage（明细条目不带 categoryCode，分类来自请求参数）
 * ===================================================================== */

import { fetchDeviceDetailPage, fetchNearPositionPage } from "./api";
import {
  BUILDING_NAME_PREFIX,
  CAMPUS_FILTER,
  CATEGORY_ORDER,
  DEVICES_MAX_PAGES,
  DEVICES_PAGE_SIZE,
  POSITIONS_MAX_PAGES,
  POSITIONS_PAGE_SIZE,
} from "./config";
import { floorSortKey } from "./time";
import type { Building, Machine, PageData, PositionApi } from "./types";

/** 楼栋显示短名：剥通用前缀（剥不掉则原样；机器名不做任何处理，两回事） */
function buildingShortName(name: string): string {
  return name.startsWith(BUILDING_NAME_PREFIX) ? name.slice(BUILDING_NAME_PREFIX.length) : name;
}

/** 类型排序：按锁定的洗衣机/烘干机/洗鞋机顺序，未知类型殿后 */
function categorySortKey(code: string): number {
  const i = CATEGORY_ORDER.indexOf(code);
  return i === -1 ? 99 : i;
}

/**
 * 楼栋稳定排序：数字名（4号楼…13号楼）按数值升序，非数字名（文华楼/逸三楼）
 * 按中文序殿后。服务端按距离返回且不同次加载顺序会漂移，必须本地定序。
 */
function compareBuildings(a: Building, b: Building): number {
  const na = /^\d+/.exec(a.shortName);
  const nb = /^\d+/.exec(b.shortName);
  if (na && nb && na[0] !== nb[0]) return Number(na[0]) - Number(nb[0]);
  if (na && !nb) return -1;
  if (!na && nb) return 1;
  return a.shortName.localeCompare(b.shortName, "zh-CN");
}

/**
 * 取全部本校楼栋。失败任一页即抛（由调用方决定展示错误态或保留旧数据）。
 * @returns 固定顺序（数字楼号升序，文华楼/逸三楼殿后）的楼栋列表
 */
export async function fetchCampusBuildings(): Promise<Building[]> {
  const seen = new Set<string>();
  const items: PositionApi[] = [];
  let total: number | null = null;
  let reachedEnd = false;

  for (let page = 1; page <= POSITIONS_MAX_PAGES; page++) {
    const data: PageData<PositionApi> = await fetchNearPositionPage(page, POSITIONS_PAGE_SIZE);
    let added = 0;
    for (const p of data.items ?? []) {
      if (p?.id === undefined || p.id === null) continue;
      const key = String(p.id);
      if (seen.has(key)) continue; // N+1 怪癖：相邻页必重复 1 条
      seen.add(key);
      items.push(p);
      added++;
    }
    const t = Number(data.total);
    if (Number.isFinite(t)) total = t;
    // ★ 结束判定唯一正确方式：累计去重条数 >= total（禁止 len==pageSize）
    if (
      (total !== null && items.length >= total) ||
      (data.items ?? []).length === 0 ||
      added === 0
    ) {
      reachedEnd = true;
      break;
    }
  }
  void reachedEnd; // 仅用于语义标记（未触顶也无所谓：MAX_PAGES 是安全上限）

  // 本校过滤必须在取满全部分页之后执行——本校网点不一定在第一页，边取边滤会漏
  const campus = items.filter((p) => typeof p.name === "string" && p.name.includes(CAMPUS_FILTER));

  return campus
    .map((p) => ({
      positionId: p.id,
      name: p.name,
      shortName: buildingShortName(p.name),
      categoryCodes: [...(p.categoryCodeList ?? [])].sort(
        (a, b) => categorySortKey(a) - categorySortKey(b),
      ),
      machines: null,
    }))
    .sort(compareBuildings);
}

/**
 * 取单楼全部机器（逐类型翻页合并）。
 * 任一类型失败 → 整楼抛错（失败粒度 = 楼；调用方保留旧数据）。
 * @returns 楼层低→高（「其它」殿后）排序后的机器；同层保持服务端返回顺序
 */
export async function fetchBuildingMachines(building: Building): Promise<Machine[]> {
  const machines: Machine[] = [];

  for (const categoryCode of building.categoryCodes) {
    const seen = new Set<string>();
    let total: number | null = null;

    for (let page = 1; page <= DEVICES_MAX_PAGES; page++) {
      const data = await fetchDeviceDetailPage(
        building.positionId,
        categoryCode,
        page,
        DEVICES_PAGE_SIZE,
      );
      let added = 0;
      for (const d of data.items ?? []) {
        if (d?.id === undefined || d.id === null) continue;
        const key = String(d.id);
        if (seen.has(key)) continue; // 同一分页怪癖：按 goodsId 去重
        seen.add(key);
        machines.push({
          goodsId: d.id,
          deviceId: d.deviceId,
          name: d.name, // 照抄原文
          floorCode: String(d.floorCode ?? ""),
          categoryCode,
          state: (d.state === 1 || d.state === 2 || d.state === 3
            ? d.state
            : 3) as Machine["state"],
          finishTime: d.finishTime ?? null,
        });
        added++;
      }
      const t = Number(data.total);
      if (Number.isFinite(t)) total = t;
      if (
        (total !== null && seen.size >= total) ||
        (data.items ?? []).length === 0 ||
        added === 0
      ) {
        break;
      }
    }
  }

  return sortMachines(machines);
}

/** 楼层低→高（其它殿后）；同层保持服务端序（稳定排序） */
export function sortMachines(machines: Machine[]): Machine[] {
  return machines
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const fa = floorSortKey(a.m.floorCode);
      const fb = floorSortKey(b.m.floorCode);
      if (fa !== fb) return fa - fb;
      return a.i - b.i;
    })
    .map((x) => x.m);
}

/** 楼层区间摘要：「1–4 层 · 9 台」/「1–3 层及其它 · 7 台」/「4 层 · 1 台」 */
export function floorsSummary(machines: Machine[]): string {
  const numeric = machines
    .map((m) => (/^\d+$/.test(m.floorCode) ? Number(m.floorCode) : null))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  const hasOther = machines.some((m) => !/^\d+$/.test(m.floorCode));
  const count = `${machines.length} 台`;
  if (numeric.length === 0) return hasOther ? `其它 · ${count}` : count;
  const uniq = [...new Set(numeric)];
  const range = uniq.length === 1 ? `${uniq[0]} 层` : `${uniq[0]}–${uniq[uniq.length - 1]} 层`;
  return hasOther ? `${range}及其它 · ${count}` : `${range} · ${count}`;
}
