/* =====================================================================
 * 时间与楼层工具（纯函数，无副作用）
 * ===================================================================== */

/**
 * 占用剩余分钟：floor((finishTime - now) / 60000)，与官方 H5 的
 * moment(finishTime).diff(now, "minutes")（截断）口径一致。
 * @returns null = 非占用（finishTime 缺失）；数值 ≤0 表示已到点
 */
export function remainingMinutes(finishTime: string | null, now = Date.now()): number | null {
  if (!finishTime) return null;
  const end = new Date(finishTime).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.floor((end - now) / 60_000);
}

/** 总览机器卡 / 明细行的剩余文案：剩 X 分钟 / 即将结束（≤0）/ 空串（非占用） */
export function remainingLabel(finishTime: string | null, now = Date.now()): string {
  const m = remainingMinutes(finishTime, now);
  if (m === null) return "";
  return m <= 0 ? "即将结束" : `剩 ${m} 分钟`;
}

/**
 * 楼层标签：数字串 →「N层」；空串 →「其它」（该楼 floorCodeList 的兜底楼层桶，
 * 实测烘干机等设备 floorCode 传空）；非空非数字（如「其它」）原样展示。
 */
export function floorLabel(floorCode: string): string {
  if (/^\d+$/.test(floorCode)) return `${floorCode}层`;
  return floorCode === "" ? "其它" : floorCode;
}

/** 楼层排序键：数字楼层数值升序，「其它」等非数字统一殿后 */
export function floorSortKey(floorCode: string): number {
  return /^\d+$/.test(floorCode) ? Number(floorCode) : 999;
}

/** 更新时间戳展示：HH:MM */
export function clockText(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
