# 主控对话交接文档（SPEC-2 预约功能阶段）

> 写于 2026-09-29。上一主控会话上下文溢出，本文档为唯一权威交接。新主控先通读本文，再读 `docs/PROJECT_CONTROL_PACKET.md`、`docs/adr/`、`CONTEXT.md`、`docs/api/`。

## 一、项目现状（M1 已上线）

- 线上地址：https://luehunnie.github.io/peili_wash_machine/ （HTTP 200，部署流水线 `push main → Actions → Pages`，已验证多轮）
- 仓库：github.com/luehunnie/peili_wash_machine，**Public + MIT**（LICENSE 在库），描述/话题已配，Pages 开通（build_type=workflow）
- Issues #1–#7 全部关闭（SPEC-1 M1 完结）；本地 main 已同步；ticket/integration 本地分支已清
- 已上线功能：9 楼总览/筛选/搜索/明细、单机详情抽屉（程序价格）、30s 轮询（不可见暂停）、明暗双主题、页脚含反馈邮箱 3628736299@qq.com
- 打印二维码：`~/Desktop/peili_wash_qr.png`（800px）
- 成本 ¥0（公开仓库 Pages/Actions 免费）；**勿商用**（ADR-0002）

## 二、工作流纪律（用户明令，最高优先级）

1. **Orca v3.5**：主控对话只做调度/验收/集成，**不实施**；实施全部派工给独立 worker 会话
2. **全部模型 = GLM 5.3**（原文档的 GPT 角色一律替换；控制与执行都是 GLM 5.3）
3. Worker 不碰 git；主控统一 commit/集成/推送
4. 人闸：PR 合并、生产上线、以及任何**写类 API 实验**（/login/*、/trade/*）必须用户实时点头
5. GitHub Issues = 执行状态；每票验收记录写进关闭评论
6. 对官方 API 的探测纪律：勿压测（曾触发限流），单轮探测预算个位数次数，失败即停

## 三、SPEC-2（预约）已定决策（grilling 会话产出，2026-09-29）

七项决策已落 ADR-0001/0002 与 CONTEXT.md，要点：
1. 真时段预约，走官方能力，前端在本站
2. 各自登录自己账号（**共用账号方案永久否决**）
3. 数据边界：token + 我的预约单；手机号/资料/钱包**永不取永不存**
4. token 存 localStorage（仅 `{token, 过期时间}`），懒登录，退出即删
5. 失败透明：官方回执原样翻译、取消按钮、「刷新后重试」；**写操作永不自动重试**
6. 不做广告（变现前置条件=先取得学校/厂商授权）
7. 详情页「时段墙」可行性未决（见下）

## 四、登录实验结果（关键！新主控从这里继续）

**目标**：拿到登录 token 以探测预约接口。**结果：卡在登录，token 未取得。** 过程全记录：

### 已确证事实
- 官方已对全校 22/58 台机开启免支付预约（enableReserve=true, reserveMethod=1）：13号楼 6/7、文华楼 12/13、6/7/8/9号楼各 1 台洗鞋机、10号楼/4号楼 0 台
- `/login/getCode {target:手机号}` 稳定可用（发码成功 3 次）
- **官方 H5（h5.haier-ioc.com）没有纯短信登录**。登录 chunk 实测：主路径=支付宝 `authorizationLogin`；`bindAccount {phone,verificationCode,loginType:5}` 是**支付宝授权后的手机绑定步骤**；微信路径 `bindWechatAccount` 需小程序 encryptedData（网页不可行）
- `/login/authorizationUrl`（GET）返回支付宝 APP_FAST_LOGIN SDK 授权参数——App 主流登录即支付宝快捷授权
- `/appointment/goodsExist`（查机器预约单）**需登录**（code:2）→ 时段墙可行性等登录后实测
- reserveCreate 请求体已知（docs/api/02 §4：purchaseList[{goodsId,goodsItemId,soldType,amount,num}]+shopId+reserveMethod→orderNo），**无时间字段**，黑盒假设「时段=预约SKU」待 `/appointment/spec/list` + `/appointment/item/list` 验证

### 失败矩阵（全部留档，别重复试）
| 尝试 | 结果 |
|---|---|
| bindAccount（appVersion 1.8.9 / 1.0.0；±Origin/Referer；新鲜码） | 100000 请重新授权登录 |
| /login/login {phone,code} / {mobile,verificationCode} | 120 服务器加载异常 |
| /login/bindAccountForApp {phone,verificationCode} | 100000 |
| UA 伪装 iPhone Safari | 无差别 |
| H5 无头浏览器真操作 | 登录表单不渲染（showLogin 仅支付宝分支置真）|

### 失败主因假说（按优先级）
1. **bindAccount 需先有支付宝授权会话**（loginType:5 语义）→ 网页纯短信可能本就不被支持
2. **手机号 139****3991 未注册过海乐账号**——bindAccount 对无账号手机报「请重新授权」；H5 存在 `/login/register` 路由（pages-login-register chunk 未分析）→ **新主控优先分析 register chunk，可能存在注册→登录的短信路径**
3. App 的 `/login/login` 参数形状未知（120=参数错）→ 需 APK 反编译深挖或真机抓包

### 建议下一步（按序）
1. 下载分析 `https://h5.haier-ioc.com/static/js/pages-login-register.<hash>.js`（hash 在 index bundle 的 chunk map 里）——若注册可用短信，走「注册→bindAccount」
2. 若 register 也依赖第三方授权：真机抓包（APK 信任用户 CA，Charles 可抓 App 短信登录全程），需用户配合
3. 拿到 token 后：立即实测 goodsExist（判时段墙生死）、spec/item list（判时段表达）、token_expired 实测 TTL
4. 之后开 grilling 第二轮（时段墙形态/选择器/详情页模板）→ 写 SPEC-2 控制包 → 建 Issues → 派工

### 实验资产（可复用）
- 用户实验手机号：139****3991（完整号在会话记录；**不得写入任何入库文件**）
- H5 bundle 已下载：/tmp/h5_index.js、/tmp/h5_login.js（含 chunk map 可继续挖）
- 探测脚本模式：/tmp/h5_*.mjs（playwright，import 自 /Users/chenjunxian/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs）
- 交接时无遗留后台任务、无未提交工作区改动（本文件除外）

## 五、立即行动清单（新主控第一天）

1. 读本文 + ADR + CONTEXT.md + PROJECT_CONTROL_PACKET.md
2. 向用户报到，确认继续登录攻坚（register chunk 路线）还是调整 SPEC-2 顺序
3. 攻坚成功 → 第二轮 grilling → SPEC-2 控制包（含：T 票拆分、验收标准、worker 派工提示词模板）→ 建 Issues → 派工
4. 任何写类实验前：向用户出示具体调用内容，获实时同意
