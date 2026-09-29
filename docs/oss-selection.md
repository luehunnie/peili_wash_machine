# 开源选型（降低开发成本）— 提案

> 状态：**待用户定案**（2026-09-29 调研）。定案后本表并入 T2 / T5 工单，未列出的依赖一律不引入。

## 一、调研结论：无可直接复用的同类项目

GitHub 中英文检索（洗衣机 / 校园洗衣 / campus laundry / 海乐生活 / 海尔）结果：

- 校园洗衣机状态查询类：仅美国个别高校的 LaundryView 小项目（`davidawang/MobLaundry` ⭐4 PHP、`atfinke/Wildcat-Wash` ⭐0 Swift），API 体系与本项目完全不同，无参考价值；
- 海尔系逆向：`Andre0512/hon`（Home Assistant 集成，⭐活跃）针对**家用 hOn App API**，GPL-3.0 + Python，与校园「云裳/海乐生活」平台不是一个接口体系，不能也不需要复用；
- **结论：核心页面与轮询逻辑必须自研（API 已验证、V1 视觉已定稿，事实上已基本完成）。开源的价值集中在配套工具与资产，即下面第二节。**

## 二、拟采用清单

| # | 用途 | 项目 | 许可证 | 活跃度（2026-09 查） | 引入方式 | 省下的成本 |
|---|---|---|---|---|---|---|
| 1 | 图标资产（logo/文件夹/刷新/搜索/错误） | [lucide](https://github.com/lucide-icons/lucide) ⭐24.8k | ISC（类 MIT，无需署名） | 持续更新 | **复制 SVG 源码内联，零运行时** | 不必手画/找图标，风格统一 |
| 2 | 部署管线（T5） | GitHub 官方 `actions/checkout` + `configure-pages` + `upload-pages-artifact` + `deploy-pages` | MIT | 官方维护 | 官方 Pages workflow 模板抄改即用 | 部署脚本 0 行自研 |
| 3 | 视觉/适配验收（已在用） | [Playwright](https://github.com/microsoft/playwright) ⭐96.8k | Apache-2.0 | 每日更新 | CLI 截图（V1 六轮验证均用它） | 微信适配、断点回归全靠它 |
| 4 | 入口二维码（一次性） | [node-qrcode](https://github.com/soldair/node-qrcode) ⭐8.2k | MIT | 2024 起稳定不更（QR 是成熟问题） | 本地 CLI 生成 PNG 一次，不进仓库运行时 | 不写二维码生成代码 |

可选增强（默认不加，用户勾选后才进）：

| # | 用途 | 项目 | 许可证 | 成本 |
|---|---|---|---|---|
| A | 多工人产出风格一致（仅本地/CI） | Prettier + ESLint + Stylelint | MIT | 一次性配置 ~10 分钟 |
| B | 「添加到主屏幕」（仅 manifest.json + 图标，**无 Service Worker**） | 平台原生能力 | — | ~20 分钟 |
| C | 部署后自动性能/无障碍体检 | [Lighthouse CI](https://github.com/GoogleChrome/lighthouse)（GitHub Action） | Apache-2.0 | 一个 workflow 文件 |

## 三、明确不引入（评估过并否决）

| 候选 | 否决理由 |
|---|---|
| Tailwind / UnoCSS 等 CSS 框架 | V1 单页样式已定稿，引入构建链的成本 > 收益；断点命名沿用其惯例只是习惯不是依赖 |
| Alpine.js（⭐31.9k MIT 活跃） | 2026 年社区共识：少量交互不值得引入 ~15KB 运行时；本项目 T2 逻辑已用原生 JS 完成并验证，重写纯增风险 |
| dayjs（⭐48.7k MIT 活跃） | 倒计时已用原生 Date 实现并验证，2KB 收益不抵一次回归 |
| Workbox / PWA Service Worker | 缓存「实时状态」会离线展示旧数据误导同学；与零数据红线精神相悖。如需主屏入口用 manifest（可选 B） |
| DOMPurify | 全部机器名/字段用 textContent 渲染，无 innerHTML 注入面；约束反而是**永远不引入 innerHTML 渲染 API 数据** |
| 任何统计/埋点（GA 等） | 直接违反「不存用户数据」红线 |
| peaceiris/actions-gh-pages（⭐5.4k） | 第三方 Action，官方 deploy-pages 已覆盖需求，减少供应链面 |

## 四、红线核对

- 零服务器成本：✅ 全部免费（GitHub Pages/Actions 免费额度内，其余仅本地）
- 不存用户数据：✅ 无统计、无 SW 缓存、无 Cookie
- 只读 API：✅ 不受影响
- 非商用学生自用：✅ ISC/MIT/Apache-2.0 均允许，且无强制署名义务（页脚已自愿注明数据来源）

## 五、决策记录

- [x] **运行时依赖策略：零运行时依赖**（2026-09-29 用户定案）。fetch + 原生 CSS + details 折叠承载全部 M1 功能；图标用 lucide 内联 SVG 资产（ISC，零运行时）。
- [x] **技术栈：方案 B —— Vite + TypeScript + 手写 CSS + Biome**（2026-09-29 用户定案，诉求「现代且方便维护」）。构建期工具链，产物零运行时依赖纯静态；API 陷阱（分页重叠 N+1、finishTime 语义、状态码字典）全部类型化。方案 A（零构建）与 C（加轻框架）被否。
- [ ] 可选增强（manifest 主屏 / Lighthouse CI）：用户未勾选，默认不加，后续任一票前点名即补。开发卫生已随方案 B 以 Biome 形式并入。
- 定案人：用户；定案日期：2026-09-29

## 六、数据通路边界（2026-09-29 补记）

- **浏览器直连官方 API**（CORS 已开放实测），不建任何代理 / 回源 / CDN 中间层。
- **不做「CDN 回源伪造 / 寄生」**：伪造官方客户端身份绕过对方风控，越过本项目「只读、学生自用、善意使用」边界，且集中回源反而更容易被识别整段封禁（当前直连 = 每个同学各自正常请求，风险最低）。
- 若未来 API 变更（封跨域 / 限流 / 加签名）：按红线流程升级用户决策；届时可讨论的后备是**不改身份的免费边缘缓存**（如 Cloudflare Workers 免费档，仅缓存 GET、10–30 秒），仍 ¥0。
