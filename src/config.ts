/* =====================================================================
 * 常量区（PROJECT_CONTROL_PACKET FROZEN#5：常量集中管理，勿散落到业务代码）
 * ===================================================================== */

/** 官方生产 API（App + H5 共用，CORS 已实测放行，浏览器可直连） */
export const BASE_URL = "https://yshz-user.haier-ioc.com";

/** 必带请求头（缺 appType 服务端报参数错误；authorization 为裸 token 无 Bearer 前缀，只读链路留空即可） */
export const HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/json",
  appType: "2", // 2 = H5 网页端（9 = Android App，服务端都认）
  appVersion: "1.8.9",
  authorization: "", // 只读链路不需要登录
};

/** 本校坐标：北京培黎职业学院（海淀区双清路 1 号） */
export const CAMPUS_LNG = 116.3397;
export const CAMPUS_LAT = 40.0192;

/** 本校过滤关键字：官方接口只能按距离取附近网点，须取满全部分页后再按名称含关键字过滤 */
export const CAMPUS_FILTER = "培黎";

/** 楼栋显示名要剥掉的通用前缀（⚠️ 只用于楼栋短名，机器名一律照抄原文、绝不处理） */
export const BUILDING_NAME_PREFIX = "北京培黎职业学院";

/** 设备状态字典（官方 state / deviceState：1=空闲，2=占用，3=故障） */
export const STATE_TEXT: Readonly<Record<number, string>> = {
  1: "空闲",
  2: "占用",
  3: "故障",
};

/** 状态 3 在 UI 的展示文案（锁定口径：维修中） */
export const STATE_REPAIR_TEXT = "维修中";

/** 设备类型字典（官方 categoryCode / deviceType） */
export const CATEGORY_TEXT: Readonly<Record<string, string>> = {
  "00": "洗衣机",
  "01": "洗鞋机",
  "02": "烘干机",
  "03": "吹风机",
  "04": "饮水机",
  "08": "淋浴",
  "09": "投放器",
};

/** 类型 chips 的固定顺序（锁定结构：洗衣机 / 烘干机 / 洗鞋机） */
export const CATEGORY_ORDER: readonly string[] = ["00", "02", "01"];

/** 单请求超时（毫秒） */
export const API_TIMEOUT_MS = 10_000;

/**
 * 网点列表分页大小与自动连取安全上限。
 * ⚠️ 服务端已知怪癖：请求 pageSize=N 实际返回 N+1 条，相邻两页必重复 1 条
 *    → 累计必须按 id 去重，结束判定只看「累计去重条数 >= total」，禁止 len==pageSize。
 *    实测本校坐标 total=108，pageSize=50 轨迹 51 → +50 → +7 共 3 页取满。
 */
export const POSITIONS_PAGE_SIZE = 50;
export const POSITIONS_MAX_PAGES = 5;

/** 单楼设备分页大小与安全上限（每类最多 13 台，一页足够；保留翻页逻辑防数据异常） */
export const DEVICES_PAGE_SIZE = 50;
export const DEVICES_MAX_PAGES = 3;

/** 轮询间隔（红线：≥30s；页面不可见时暂停，见 app.ts） */
export const POLL_INTERVAL_MS = 30_000;
