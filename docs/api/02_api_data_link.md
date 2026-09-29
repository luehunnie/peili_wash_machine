# 海乐生活（云裳/海尔）API 数据链路 — 完整版（已实测验证）

> 验证时间：2026-09-28 · 生产环境 `https://yshz-user.haier-ioc.com`
> 所有样本均为真实请求返回（坐标：杭州西湖附近）

## 0. 一页结论

- **协议**：REST/JSON，POST 为主，GET 查详情。响应信封 `{"code":0,"message":"success","data":...}`
- **鉴权**：登录后 token 放 **`authorization`** 头（无 Bearer 前缀，直接裸 token）
- **无签名、无加密、无证书锁定**：`sign/nonceStr/timestamp` 只是微信支付 SDK 字段，业务 API 无任何签名
- **必带请求头**（缺 appType 会报参数错误）：
  ```
  Content-Type: application/json
  appType: 2        # 2=H5网页端, 9=Android App（服务端都认）
  appVersion: 1.8.9 # 任意版本号即可
  authorization: <token>   # 未登录接口可省略/留空
  ```
- **CORS 全开**（`Access-Control-Allow-Origin: *`，GET/HEAD/POST）→ **纯前端网页可直接调用**
- **未登录错误码**：`{"code":2,"message":"未登录"}`（401/100002/100003 同义）

## 1. 业务字典（来自官方 H5 前端代码）

| 字典 | 取值 |
|---|---|
| `deviceState` / `state` 设备状态 | **1=空闲， 2=占用， 3=故障** |
| `deviceType`/`categoryCode` 设备类型 | 00=洗衣机， 01=洗鞋机， 02=烘干机， 03=吹风机， 04=饮水机， 08=淋浴， 09=投放器 |
| `orderStatus` 订单状态 | 0=未支付 1=已失效 2=已支付 3=已完成 4=退款中 5=已退款 |
| `appointmentState` 预约状态 | 0=待支付 1=待生效 2=已生效 3=已失效 4=已取消 |
| `reserveState` 可预约性 | 0=否 1=是（配合 enableReserve） |
| `reserveMethod` 预约支付方式 | 1=免支付直接生效 2=需去收银台支付 |
| `signType` | 1=支付宝免密 2=微信支付分先享后付 |
| `soldType` 计费方式 | 1=按次 2=按量 |

## 2. ★ 只读设备状态链路（无需登录，已实测）

### 2.1 附近网点列表（含空闲机器数）
```http
POST /position/nearPosition
{"lng":120.15507,"lat":30.274085,"page":1,"pageSize":10}
```
```json
{"code":0,"message":"success","data":{"page":1,"pageSize":10,"total":20,"items":[{
  "id":6503,                      /* positionId 网点ID */
  "shopId":1000027550,
  "name":"七天酒店",
  "address":"杭州市拱墅区体育场路347号",
  "distance":1141.04,             /* 米 */
  "state":1,                      /* 网点营业状态 1=营业中 2=暂停 */
  "appointmentState":0,
  "idleCount":1,                  /* ★ 空闲设备数 */
  "workTime":"[\"00:00-23:59\",...]",  /* 7天营业时间 JSON串 */
  "enableReserve":false,
  "reserveNum":0,
  "categoryCodeList":["00"],      /* 该网点有哪些设备类型 */
  "rechargeFlag":false,
  "organizationId":1000009053,
  "limitDiscountFlag":false
}]}}
```

### 2.2 网点设备分类统计
```http
GET /position/positionDevice?id=6503
```
```json
{"code":0,"message":"success","data":[
  {"categoryCode":"00","categoryName":"洗衣机","total":1,"idleCount":1}]}
```

### 2.3 ★ 单台设备状态明细（分页）
```http
POST /position/deviceDetailPage
{"positionId":6503,"categoryCode":"00","page":1,"floorCode":"","pageSize":10}
```
```json
{"code":0,"message":"success","data":{"page":1,"pageSize":10,"total":1,"items":[{
  "id":10471330,            /* = goodsId */
  "deviceId":50724423,      /* 设备硬件ID，查详情用 */
  "name":"2楼洗衣服2号机",
  "imei":"861553059186995",
  "floorCode":"2",
  "state":3,                /* ★ 1空闲/2占用/3故障 */
  "enableReserve":false,
  "reserveState":0,
  "lastMaintenanceTime":null,
  "finishTime":null         /* ★ 占用中=预计结束时间，算剩余分钟用 */
}]}}
```
> H5 端算法：`剩余分钟 = moment(finishTime).diff(now, 'minutes')`

### 2.4 楼层列表
```http
GET /position/floorCodeList?positionId=6503  →  {"code":0,"data":["2"]}
```

### 2.5 ★ 设备全量详情（含洗衣程序和价格）
```http
GET /goods/normal/details/byDeviceId?deviceId=50724423
```
```json
{"code":0,"data":{
  "id":10471330,            /* goodsId */
  "categoryCode":"00","categoryName":"洗衣机",
  "name":"2楼洗衣服2号机",
  "code":"BLJ2111230479",
  "soldState":1,            /* 2=停用 */
  "shopId":1000027550,"shopName":"七天酒店","shopAddress":"...",
  "shopClosed":false,       /* 门店是否歇业 */
  "deviceState":3,          /* ★ 1空闲/2占用/3故障 */
  "deviceErrorCode":...,    /* 故障码（有值=故障） */
  "deviceErrorMsg":...,
  "reserveState":null,"enableReserve":false,"reserveMethod":null,
  "attachValueMap":{"Dispenser":{"isOn":...},"SelfClean":...},  /* 洗液投放/自清洁 */
  "items":[{                /* ★ 洗衣程序(SKU) */
    "id":1006130859,"skuId":86,
    "name":"标准",
    "feature":"标准程序，一般衣物均可洗涤。",
    "price":"4.00",         /* 元 */
    "unit":"35",            /* 分钟 */
    "soldState":1,
    "attachMap":{"SelfClean":true},
    "attach":0,
    "extAttrDto":{"items":[{"functionType":...,"isDefault":...,"unitAmount":...}]}
  }]
}}
```

### 2.6 扫码识别设备（App/H5 扫机身二维码）
```http
GET /goods/scan?imei=...   或 ?n=... / ?devid=... / ?barCode=...
→ {"goodsId":..., deviceState..., ...}
```
（H5 把 `.../barCode/<code>` 路径的二维码解析为 barCode 参数）

### 2.7 指定网点详情
```http
GET /position/positionDetail?lng=&lat=&id=<positionId>
→ {..., workTime, serviceTelephone, positionDeviceDetailList:[...]}
```

## 3. 登录链路（预约等写操作前需要）

### 3.1 发验证码
```http
POST /login/getCode    {"target":"13800138000"}     → code:0 发送成功（60s 冷却）
```

### 3.2 验证码登录
```http
# H5 网页端：
POST /login/bindAccount   {"phone":"...","verificationCode":"...","loginType":5}
# Android App 端：
POST /login/login         {"phone/mobile":...,"code/verificationCode":...}
→ {"token":"...", "token_expired": <毫秒时间戳>, member:{...}}
```
第三方授权：`/login/authorizationLogin`（支付宝 `authorizationCode`,`clientType:2`）、`/login/bindWechatAccount`（`channel:5,code,encryptedData,iv`）

### 3.3 之后所有请求带
```
authorization: <token>
```
（H5 存 localStorage `user_token`/`USE_ACCESS_TOKEN`；App 存 SharedPreferences `"token"`）

## 4. 预约（下单）链路 —— 需登录

```
选网点(positionId) → 设备明细(deviceDetailPage) → 选设备(deviceId/goodsId)
  → [可选] POST /appointment/goodsExist {goodsId}     # 查该设备当前预约单
  → POST /appointment/goodsCategory/list               # 预约商品分类
  → POST /appointment/spec/list                        # 规格
  → POST /appointment/item/list {shopId,specValueId,unit,page,pageSize}
  → POST /shopConfig/list {goodsCategoryId,shopId}     # 预约规则/海星币强制
  → ★ POST /trade/reserveCreate                        # 创建预约单
  → reserveMethod==1 ? 免支付生效 : 去 /pay/reservepay 收银台
```

### /trade/reserveCreate 请求体（从 H5 提取）
```json
{
  "purchaseList": [{
    "goodsId": 10471330,
    "goodsItemId": 86,          /* skuId */
    "soldType": 1,              /* >1件或吹风机(03)时=2 */
    "amount": 1, "num": 1
  }],
  "shopId": 1000027550,
  "categoryCode": "00",
  "goodsId": 10471330,
  "mustCoin": 0,                 /* shopConfig 里 tokenCoinForceUse */
  "reserveMethod": 1             /* goodDetail.reserveMethod */
}
→ {"orderNo":"..."}
```

### 预约后流转
- 启动：`POST /trade/startByOrder`、`POST /trade/fulfillment/start`
- 校验核销：`POST /trade/check/verify`、`/trade/check/reSendCode`（App 端输码）
- 取消：`POST /trade/cancel`
- 详情/轮询：`GET /trade/detail`、`GET /trade/detail/simple`
- 进行中订单（首页角标）：`POST /trade/underway/stateList {}` → `{orderNo, stateList:[...]}`
- 订单列表：`POST /trade/list`；付款：`/pay/pay`、`/pay/prePay`、`/pay/asyncPay`

## 5. 其他已确认接口（App+H5 汇总）

登录 `/login/userLayout` `/login/authorizationUrl` `/login/bindAccountForApp`；
账户 `/account/getAccountInfo` `/account/myProperty` `/userInfo`；
卡包 `/card/*`（校园卡绑定/充值）、`/shop/schoolList`；
消息 `/message/index|list|read|total`；公告 `/notice/getNoticeByShopId`；
反馈 `/feedback/*`；报修 `/deviceFix/*`；
海星币 `/tokenCoin/user/*`、`/starfish/*`；
设备操作 `/device/placeClothes`、`/device/selfClean/start`、`/goods/verify`；
最近运行 `POST /goods/last/runInfo`；广告位 `/slot/get`。

## 6. 安全观察（做 Web 端时的注意点）

1. 位置/状态类接口**完全无鉴权**——你的 Web 页面可以直接展示，无需账号
2. 无速率限制迹象（未压测，Web 端请自觉加缓存，建议 10~30s 轮询间隔）
3. 预约/支付必须用户自己的 token——Web 端登录页让用户手机号+验证码自助登录即可（`/login/getCode` + `/login/bindAccount`，loginType:5）
4. 阿里云 WAF Cookie（acw_tc）由 CDN 自动处理，浏览器 fetch 无感
5. 官方 H5 本身就是网页（h5.haier-ioc.com，uni-app），你的站点相当于第三方的另一个客户端；低频个人使用无合规问题，**勿商用/勿压测/勿共享他人 token**

## 7. 环境矩阵

| 域名 | 用途 |
|---|---|
| `yshz-user.haier-ioc.com` | 生产 API（App+H5 共用）|
| `pre-user.haier-ioc.com` | 预发 |
| `h5.haier-ioc.com` | 官方 H5（uni-app，可参考 UI/逻辑）|
| `static.haier-ioc.com` | 图片 CDN |
| `notice.haier-ioc.com` | 公告 H5 |
