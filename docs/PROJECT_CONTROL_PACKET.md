# PROJECT CONTROL PACKET — v1（已冻结）

> 冻结时间：2026-09-29 · 冻结人：用户（Human Authority）
> 工作流：Orca Agent Development Workflow v3.5（GPT 控制层与 GLM 工程层由同一 AI 会话吸收承担，Human Gate 保留给用户）
> 变更本文件任何 FROZEN 项 = scope 变更，必须由用户显式提出。

## GOAL

学生扫码即用的校园洗衣机实时状态查看 Web 平台。

## SCOPE

- 只读链路：本校网点列表 → 机器状态墙（空闲/占用/故障 + 剩余时间）→ 单机程序与价格
- 移动端单页（微信内置浏览器为主要渲染环境）
- GitHub Pages 托管（¥0、零服务器），二维码为用户入口，校园信息网站宣传

## NON_GOALS

- 登录 / 账号系统（**已冻结移除**，恢复需用户显式提出）
- 预约下单 / 支付（整体延期）
- 任何后端服务 / 数据库 / 自建代理
- 平台存储任何用户数据（零用户数据）
- 商用

## FROZEN_DECISIONS

1. 纯静态直连官方 API `https://yshz-user.haier-ioc.com`（CORS 已实测放行）
2. 状态唯一可信来源 = `POST /position/deviceDetailPage` 明细；网点级 `idleCount` 仅作参考展示，不作为状态依据
3. 轮询纪律：间隔 ≥30s + `visibilitychange` 不可见暂停 + 只轮询当前打开的网点
4. 单一自包含文件（HTML/CSS/JS 内联为一个 index.html），保证分钟级可搬家
5. API 地址 / 请求头 / 字典等常量集中在文件头部一个常量区
6. 页脚标注"非官方工具，数据来自海乐生活"；收到下架要求即撤
7. 仓库 = github.com/luehunnie/peili_wash_machine；域名由用户自备（CNAME 至 GitHub Pages）

## ARCHITECTURE_BOUNDARIES

```
用户浏览器（手机微信） → HTTPS → 阿里云WAF → yshz-user.haier-ioc.com
```

- 无中间层。不引入构建工具链、框架、包管理（vanilla HTML/CSS/JS）。

## RISK

| 风险 | 处置 |
|---|---|
| 官方改接口/关 CORS（高概率/低损失） | 单文件自包含，分钟级搬家到任意免费静态托管 |
| 校园级流量触发限流 | 轮询纪律（见 FROZEN 3） |
| 可见性上升 | 非官方标注 + 收到要求即撤 |

## DONE_WHEN（M1 验收）

- [ ] 微信扫码可打开并正常渲染
- [ ] 展示本校网点的机器三态 + 剩余时间 + 程序价格
- [ ] 30s 自动刷新；接口故障时有友好错误态而非白屏
- [ ] 已部署到 GitHub Pages 并可访问

## ESCALATE_WHEN（升级给用户）

- 官方 API 变更 / 增加签名
- 收到学校或厂商下架要求
- 用户想恢复预约功能（scope 变更）

## 参考

- `docs/api/02_api_data_link.md` — 已实测验证的数据链路与接口文档（工程唯一事实来源）
- `docs/api/01_findings.md` — APK 逆向分析结论
- `CONTEXT.md` — 领域术语表（网点/机器/程序/预约 ↔ 官方字段映射）
