/* =====================================================================
 * 类型：API DTO + 领域模型（字段名以 docs/api/02_api_data_link.md 实测为准）
 * ===================================================================== */

/** 分页响应的 data 通用形状 */
export interface PageData<T> {
  total: number;
  items: T[];
  page?: number;
  pageSize?: number;
}

/** POST /position/nearPosition 的 items 元素 */
export interface PositionApi {
  id: number; // positionId 网点 ID
  name: string;
  address?: string;
  distance?: number; // 米
  state?: number; // 网点营业状态 1=营业中 2=暂停
  idleCount?: number | null; // ★ 仅供参考（FROZEN#2），页面空闲数以明细接口计算为准
  categoryCodeList?: string[]; // 该网点有哪些设备类型（逐类查询机器明细的依据）
}

/** POST /position/deviceDetailPage 的 items 元素（⚠️ 不带 categoryCode，分类来自请求参数本身） */
export interface DeviceApi {
  id: number; // = goodsId
  deviceId: number; // 设备硬件 ID
  name: string; // 运营方手填自由文本
  floorCode: string; // 楼层原文（数字串，或「其它」）
  state: 1 | 2 | 3;
  finishTime: string | null; // 占用中=预计结束时间；空闲为 null
}

/* ---------------- 领域模型 ---------------- */

export type MachineState = 1 | 2 | 3;

export interface Machine {
  goodsId: number;
  deviceId: number;
  name: string; // 照抄 API 原文（「培黎7号机…」「西3层1号楼」等错字保留）
  floorCode: string; // 原文；楼层展示/排序一律以此为准，绝不从机器名解析
  categoryCode: string; // 来自查询参数（明细条目本身不带）
  state: MachineState;
  finishTime: string | null;
}

export interface Building {
  positionId: number;
  name: string; // API 原名（如「北京培黎职业学院4号楼」）
  shortName: string; // 显示名（剥通用前缀后的「4号楼」；剥不掉则用原名）
  categoryCodes: string[];
  machines: Machine[] | null; // null = 尚未成功加载过（首次失败时用错误卡展示）
}
