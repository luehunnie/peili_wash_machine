/* =====================================================================
 * API 客户端层（只读链路）
 * 两类错误严格区分（UI 需不同展示）：
 *   ApiBusinessError —— 请求到达服务端，但信封 code != 0（携带 code 与服务端 message）
 *   ApiNetworkError  —— 未取得合法业务信封：断网 / DNS / 超时 / HTTP 非 2xx / 响应非 JSON
 * ===================================================================== */

import { API_TIMEOUT_MS, BASE_URL, CAMPUS_LAT, CAMPUS_LNG, HEADERS } from "./config";
import type { DeviceApi, GoodsDetailApi, PageData, PositionApi } from "./types";

/** 未登录类业务错误码（只读链路遇不到；仅用于识别，绝不引导登录——本平台无账号系统） */
const LOGIN_ERROR_CODES = [2, 401, 100002, 100003];

export class ApiBusinessError extends Error {
  readonly code: number;
  readonly serverMessage: string;
  readonly isLoginError: boolean;

  constructor(code: number, serverMessage: string) {
    super(`业务错误 code=${code}：${serverMessage}`);
    this.name = "ApiBusinessError";
    this.code = code;
    this.serverMessage = serverMessage;
    this.isLoginError = LOGIN_ERROR_CODES.includes(Number(code));
  }
}

export class ApiNetworkError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(`网络错误：${message}`);
    this.name = "ApiNetworkError";
  }
}

interface ApiCallOptions {
  /** POST 请求体（自动 JSON 序列化） */
  body?: unknown;
  /** 查询参数（自动拼 query string；值为 null/undefined 的跳过） */
  params?: Record<string, string | number | null | undefined>;
}

/** BASE_URL + path [+ query string] */
function buildUrl(path: string, params?: ApiCallOptions["params"]): string {
  const url = BASE_URL + path;
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [key, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    qs.append(key, String(v));
  }
  const s = qs.toString();
  if (!s) return url;
  return url + (url.includes("?") ? "&" : "?") + s;
}

/**
 * 统一 API 调用入口。
 * @returns 信封 code==0 时的 data 字段
 * @throws ApiBusinessError / ApiNetworkError
 */
export async function apiCall<T>(
  method: "GET" | "POST",
  path: string,
  options: ApiCallOptions = {},
): Promise<T> {
  const url = buildUrl(path, options.params);
  const init: RequestInit = {
    method,
    headers: { ...HEADERS },
  };
  if (options.body !== undefined && method === "POST") {
    init.body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  init.signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === "AbortError") {
      throw new ApiNetworkError(`请求超时（${API_TIMEOUT_MS / 1000}s）：${method} ${path}`, err);
    }
    throw new ApiNetworkError(`网络请求失败：${method} ${path}：${e?.message ?? String(err)}`, err);
  } finally {
    clearTimeout(timer);
  }

  // 先读原文再解析，区分「非 JSON 响应」与「业务信封」
  let rawText = "";
  try {
    rawText = await response.text();
  } catch {
    rawText = "";
  }
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (payload !== null && typeof payload === "object" && "code" in payload) {
    const env = payload as { code?: unknown; message?: unknown; data?: unknown };
    if (Number(env.code) === 0) {
      return env.data as T; // ★ 成功：只返回信封里的 data
    }
    throw new ApiBusinessError(Number(env.code), String(env.message ?? `HTTP ${response.status}`));
  }

  // 没有标准信封：HTTP 错误页 / WAF 拦截页 / 空响应等
  throw new ApiNetworkError(
    `响应异常（HTTP ${response.status}${payload === null && rawText ? "，响应非 JSON" : ""}）：${method} ${path}`,
  );
}

/* ---------------- 只读端点（docs/api/02_api_data_link.md §2） ---------------- */

/** 附近网点列表（含参考空闲数与类型清单） */
export function fetchNearPositionPage(page: number, pageSize: number) {
  return apiCall<PageData<PositionApi>>("POST", "/position/nearPosition", {
    body: { lng: CAMPUS_LNG, lat: CAMPUS_LAT, page, pageSize },
  });
}

/** 单楼某类型的机器明细分页（floorCode 传空 = 全楼层） */
export function fetchDeviceDetailPage(
  positionId: number,
  categoryCode: string,
  page: number,
  pageSize: number,
) {
  return apiCall<PageData<DeviceApi>>("POST", "/position/deviceDetailPage", {
    body: { positionId, categoryCode, page, floorCode: "", pageSize },
  });
}

/** 单机全量详情（含程序与价格，docs §2.5）。抽屉打开时请求一次，不轮询 */
export function fetchGoodsDetail(deviceId: number) {
  return apiCall<GoodsDetailApi>("GET", "/goods/normal/details/byDeviceId", {
    params: { deviceId },
  });
}
