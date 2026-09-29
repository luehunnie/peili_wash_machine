# 海乐生活 APK 逆向分析 — 已确认发现

## 基本信息

| 项 | 值 |
|---|---|
| App | 海乐生活（Haile Life / "Happiness Life"） |
| 包名 | `com.yunshang.haile_life` |
| 版本 | 2.2.10 (APKPure) |
| SHA256 | f3709f3a874c709332d8e6c31b8584a8f3f51b0750a730f70fbbc6ca14439d5e |
| 厂商 | 云裳（海尔系校园洗衣物联网，"yshz" = 云裳） |
| 架构 | Flutter 3.29 混合应用（Dart SDK **3.7.2 stable**, 2025-03-11） |
| Java 框架层 | `com.zjch.common.*`（网络/AES/livedata 工具包） |
| MainActivity | `com.example.hair_life_to_c.MainActivity`（Flutter 嵌入） |

## 后端域名

| 域名 | 用途 |
|---|---|
| `https://yshz-user.haier-ioc.com` | **生产 API base URL**（用户/交易/设备域） |
| `https://pre-user.haier-ioc.com` | 预发环境（字符串中出现 `/slot/get`） |
| `h5.haier-ioc.com` | H5 页面（隐私协议、支付收银台 wxpay） |
| `static.haier-ioc.com` | 静态资源/图片 |
| `notice.haier-ioc.com` | 公告 |
| `state.haier-ioc.com/user` | 用户状态上报? |
| `https://dj-test.zjchjc.cn/` `https://open-api.zjchjc.cn/` | zjch 框架厂商遗留测试域名 |

## 网络安全配置

- `network_security_config.xml`：信任**用户安装的 CA 证书** + 允许明文流量
- → **可以用 Charles/mitmproxy 直接抓 HTTPS 包**（无需 root/绕过 SSL pinning，未见证书锁定）

## 加密（libaeslib.so）— ✅ 已排除：与主业务无关

- 归属：**短剧视频 SDK**（com.mango.bidding / com.ex.videosdk，后端 `open-api.zjchjc.cn/bcsdk/`）
- 用途：POST body 整体 AES/CBC/PKCS7 加密（key/iv 从 so 的 getKey/getIv 取，UTF-8 直用），响应 data 字段解密
- .rodata 两个 16 字节常量：`8y1TF3d5ja2a6s3Y` @0xaa0、`u7T8afRGi9aM1kyT` @0xbd8（运行时按 APK 签名校验选择）
- **主业务（haier-ioc）完全不经过它**

## 签名/请求头 — ✅ 已还原：无签名

- blutter 反编译 `HttpService::_buildHeaders`（asm/hair_life_to_c/net/http.dart:678）确认请求头仅：
  `Content-Type: application/json` + `authorization: <token>` + `appVersion: <版本>` + `appType: "9"`（Android）
- H5 端同构：`appType: 2, appVersion: 1.8.9`
- 之前看到的 `sign/signType/nonceStr/timestamp` 是**微信支付 SDK（fluwx）的支付协议字段**，非 API 签名

## API 路径清单（从 libapp.so Dart 字符串池提取）

### 设备状态（只读，重点）
- `/goods/last/runInfo` — 设备最近运行信息
- `/goods/normal/details/byDeviceId` — 按设备 ID 查详情
- `/goods/normal/details` / `/goods/normal/items`
- `/position/positionDevice` — 网点设备列表
- `/position/deviceTaskFlowList` — 设备任务流
- `/position/deviceDetailPage`
- `/appointment/order/stateQuery` — 预约单状态查询

### 预约/下单
- `/trade/reserveCreate` — 创建预约单 ⭐
- `/trade/lockOrderCreate` — 锁定单创建
- `/trade/scanOrderCreate` — 扫码下单
- `/trade/underway/create` `/trade/underway/preview/V2` `/trade/underway/orderList`
- `/appointment/goodsExist`

### 网点/学校
- `/shop/schoolList` `/card/recharge/school/list` `/card/school/class/info`
- `/position/getPositionList` `/position/nearPosition` `/position/positionDetail` `/position/usePositionList` `/position/floorCodeList`

### 登录
- `/login/login` `/login/getCode` `/login/authorizationLogin` `/login/authorizationUrl` `/login/bindAccountForApp` `/login/userLayout`

### 支付/钱包
- `/pay/pay` `/pay/prePay` `/pay/asyncPay` `/pay/checkstand` `/pay/userCard/*`
- `/trade/payLaterCreate` `/trade/order/detail` `/trade/refund/*`
- `/tokenCoin/user/*`（海星币）`/starfish/*`

### 设备操作
- `/device/placeClothes`（放衣）
- `/device/selfClean/start`（自清洁启动）
- `/goods/scan`（扫码）

### 其他
- `/common/appVersion` `/common/upload` `/message/*` `/feedback/*` `/coupon/*` `/slot/get` `/slot/click`（广告位）

## 待办

- [x] blutter 反编译 libapp.so → Dart 请求层已还原（`re/blutter_out/asm/hair_life_to_c/`）
- [x] jadx 分析 com.zjch + com.example（子代理完成，报告见上）
- [x] 验证只读接口 → **免登录全通**，见 `02_api_data_link.md` 与 `../poc/haile_status.py`
- [ ] Web 网站实现（下一步，见 `03_web_app_guide.md`）

## 已验证坑点

- 统计接口 `idleCount` 可能与单机明细 `state` 不一致（例：网点 6503 统计空闲 1 台，实际唯一机器是故障）→ 状态展示以 `/position/deviceDetailPage` 为准
- Python urllib 需 certifi（python.org 版缺系统 CA）

