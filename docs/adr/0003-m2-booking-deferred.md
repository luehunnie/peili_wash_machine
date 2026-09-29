# M2 预约暂缓：功能存在，运营商未配置（暂缓而非判死）

2026-09-29 登录链路打通后（形状见 `docs/api/02_api_data_link.md` §3），主控持实测 token 对培黎九栋做了预约链路五路核查，结论：预约功能在海乐平台完整存在，但培黎校区运营商未配置预约商品（目录空壳）。ADR-0001 的解冻决定与全部边界决策（各自登录、仅免支付型等）保留有效，仅 M2 执行时点推迟至运营商上线预约——**暂缓，不是判死**。

## 证据链（2026-09-29 主控实测，五路）

| # | 证据层 | 结果 |
|---|---|---|
| 1 | 楼栋级 | 9 栋中 6 栋 `enableReserve=True` / `appointmentState=1`——但仅是楼栋开关，不代表有可预约商品（明细见下） |
| 2 | 设备级 | 8号楼全部 6 台洗衣机（`byDeviceId` / `deviceDetailPage`）均 `enableReserve=False`、`reserveState=0/None` |
| 3 | 目录层 | `goodsCategory/list` 有分类，但 `spec/list` 三类全空、`item/list` 六栋全空——**无任何可预约商品** |
| 4 | 客户端 | App 逆向证实预约功能代码完整存在（成功页/路由/词条齐全） |
| 5 | 现实佐证 | 用户确认微信小程序无预约入口；校内无人用过预约 |

**楼栋级明细**（positionId）：

| 楼栋 | positionId | 楼栋预约开关 |
|---|---|---|
| 9号楼 | 25237 | 开 |
| 8号楼 | 25238 | 开 |
| 6号楼 | 25239 | 开 |
| 7号楼 | 25240 | 开 |
| 13号楼 | 27727 | 开 |
| 文华楼 | 27741 | 开 |
| 10号楼 | 48073 | 未开 |
| 4号楼 | 40180 | 未开 |
| 逸三楼 | 24666 | 未开 |

（「开」= `enableReserve=True` / `appointmentState=1`）

**设备级**样本：8号楼1层1号机（goodsId=85625309 / deviceId=50963278；SKU：标准 4元/40分、快速 3元/25分、大物 5元/50分）。注：此前摸底记录的 22/58 台免支付开启（HANDOFF §四）均为洗鞋机——设备级开关开 ≠ 有可预约商品，以目录层空壳为准。

**目录层**：`/appointment/goodsCategory/list` 有分类（goodsCategoryId 10=洗衣机 / 11=洗鞋机 / 12=烘干机，另 `autoRefund:0`），但 `/appointment/spec/list` 三类全空、`/appointment/item/list` 六栋全空。六栋 shopId：8号楼=1000029464、6号楼=1000029463、9号楼=1000029465、7号楼=1000029461、13号楼=1000029673、文华楼=1000022167。

**客户端**（App 逆向，`re/blutter_out/asm/hair_life_to_c/`）：`pages/reservation/successful.dart` 预约成功页；`pages/business/detail.dart` 读 reserveState 且含 "appointment" 路由；localization_zh 有「可预约 / 提前预约 / 设备无法预约」词条；App 内预约相关 API 仅 `appointment/goodsExist` 与 `appointment/order/stateQuery`。

## Consequences

- **裁定**：M2 暂缓。楼栋开关 + App 功能完整 = 平台能力就绪；预约目录空 = 运营商未录入预约商品。等配置上线，不自造预约、不越权代配置。
- **重启触发器**：任一楼 `POST /appointment/item/list {"shopId":X,"page":1,"pageSize":10}` 返回非空 itemList = 运营商上线预约，SPEC-2 解冻续做（shopId 清单见上）。
- **关联决定**（均为用户 2026-09-29 拍板）：`.tools/`（约 6.9GB 模拟器/SDK/mitm 环境）保留至开发验证完成后再清理；站点更新（含 QA 建议的抽屉 `inset:0`→四边展开一行 CSS 修复）冻结至开发验证完成后再上线。
