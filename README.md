# 培黎洗衣速查

北京培黎职业学院校园洗衣机**实时状态**查询页：扫码打开即用，不用装 App、不用登录。选楼栋、看全校洗衣机总览（空闲 / 占用 / 维修 + 剩余分钟），点任意一台机器可查看它的程序与价格，数据每 30 秒自动刷新。

> **非官方学生工具**：本项目与学校、海尔 / 海乐生活均无关系，数据来自「海乐生活」的公开查询接口，仅供同学们参考，**一切以现场为准**。
> 免责：本工具只读展示、不存储任何用户数据；如收到学校或厂商的下架要求，随即撤下。

技术栈：Vite + TypeScript + 手写 CSS，构建产物为纯静态文件，零运行时依赖；微信内置浏览器为主要渲染环境，自动跟随系统亮 / 暗色模式。

## 本地开发

```bash
npm install     # 安装依赖（仅构建期工具：vite / typescript / biome）
npm run dev     # 启动开发服务器（默认 http://localhost:5173）
npm run check   # 类型检查（tsc）+ 代码规范检查（biome）
npm run build   # 类型检查 + 构建到 dist/
npm run preview # 本地预览 dist/ 构建产物
```

## 部署（GitHub Pages）

部署采用 GitHub 官方 Actions 组合（见 `.github/workflows/deploy.yml`）：`push` 到 `main` 分支时自动 `npm ci → npm run build`，把 `dist/` 发布到 GitHub Pages，无需任何第三方 Action。

一次性开通步骤（仓库管理员操作一次）：

1. 打开仓库 **Settings → Pages**；
2. **Source** 选择 **GitHub Actions**（不要选 "Deploy from a branch"）；
3. 保存后，下次 push 到 `main`（或手动在 Actions 页触发 workflow）即自动部署。

站点地址（开通后生效）：**https://luehunnie.github.io/peili_wash_machine/**

## 入口二维码（供打印，上线后再生成）

二维码只是一张图片，用一次性命令在开发机生成即可，**不是项目依赖**（不要 `npm install` 它）：

```bash
# 终端直接显示（需在真实终端里运行）
npx qrcode-terminal "https://luehunnie.github.io/peili_wash_machine/"

# 或生成 PNG 图片文件（-o 指定文件名，可直接打印）
npx qrcode -o qr_code.png "https://luehunnie.github.io/peili_wash_machine/"
```

注意：**实际生成放到上线之后做**——站点开通前扫码会得到 404。生成的图片自行保存，不入库。

## 5 分钟搬家（迁移到任意静态托管）

项目已按「随时可搬」设计：`vite.config.ts` 里 `base: "./"`（相对路径），构建产物不绑定任何域名。

```bash
npm run build
```

然后把 `dist/` **整个目录**上传到任意静态托管（GitHub Pages 其他仓库、Gitee Pages、Vercel、Netlify、Cloudflare Pages、校园服务器 nginx 等）即可，无需改任何代码或配置。

## 自备域名（可选，CNAME）

域名需自行购买，GitHub Pages 托管本身免费。做法：

1. 仓库根目录添加一个 `CNAME` 文件，内容为你的域名（如 `wash.example.com`）；
2. 到域名 DNS 服务商添加一条 **CNAME 记录**，把该子域指向 `luehunnie.github.io`；
3. 仓库 Settings → Pages 里确认自定义域名已识别（可勾选 Enforce HTTPS）。

备案提示（措辞谨慎）：**`*.github.io` 子域由 GitHub 提供、无需 ICP 备案**；但**自定义域名**是否需要备案取决于解析位置与访问者所在地——使用自定义域名后，备案责任在域名所有者（用户）自己，请自行确认。本项目默认使用 github.io 子域，零备案零成本。
