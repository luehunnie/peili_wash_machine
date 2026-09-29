/* =====================================================================
 * ?debug=1 自检模式（开发/验收用，不进入正常用户路径）
 * 依次打真实只读接口，把结果 JSON 打到页面上，验证链路与过滤是否正常
 * ===================================================================== */

import { fetchBuildingMachines, fetchCampusBuildings } from "./campus";
import { el } from "./dom";

export async function runDebugSelfTest(root: HTMLElement): Promise<void> {
  const pre = el("pre");
  pre.style.cssText =
    "padding:12px;font:12px/1.6 ui-monospace,Menlo,monospace;background:#0e1a26;color:#cfe3f7;overflow:auto;white-space:pre-wrap;border-radius:8px";
  root.appendChild(el("h2", undefined, "链路自检（?debug=1）")).style.cssText =
    "padding:0 16px;font-size:16px";
  root.appendChild(pre);

  const log = (label: string, value: unknown) => {
    pre.textContent += `\n【${label}】\n${JSON.stringify(value, null, 2)}\n`;
  };

  try {
    const buildings = await fetchCampusBuildings();
    log(
      "本校楼栋（预期 9 栋）",
      buildings.map((b) => ({ id: b.positionId, name: b.name, cats: b.categoryCodes })),
    );
    const total = buildings.reduce((n, b) => n + (b.machines?.length ?? 0), 0);
    log("楼栋数", buildings.length);

    // 抽第一栋拉明细，验证分页/去重/排序
    const first = buildings[0];
    if (first) {
      const machines = await fetchBuildingMachines(first);
      log(`第一栋机器（${first.shortName}，预期按楼层升序）`, machines);
      log("全校机器合计（预期 59 左右，实时可能波动）", total);
    }
  } catch (err) {
    log("自检失败", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  }
}
