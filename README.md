# KnowMesh 知序

KnowMesh 是一个面向团队的知识工作空间，用于汇聚文档、项目资料和协作上下文，让零散信息逐步沉淀为可持续使用的共同知识。

## 技术栈

- Next.js 16、React 19 和 TypeScript
- Tailwind CSS 4
- Better Auth 身份认证
- Drizzle ORM、PostgreSQL 和本地 PGlite 运行环境
- Zod 环境变量验证
- Ultracite、Oxlint 和 Oxfmt
- Vitest、Playwright 和 GitHub Actions CI

应用已经通过 Server Components、server-only 查询和 Server Actions 读写 Workspace、项目、文档、通知与用户偏好数据。生产环境使用 PostgreSQL，本地完整运行环境使用 PGlite Socket。

## 环境要求

- Node.js 24 或更高版本
- npm
- 用于浏览器测试的 Playwright Chromium

安装依赖和浏览器：

```shell
npm install
npx playwright install chromium
```

## 环境变量

仓库中的 `.env.example` 列出所需变量和非敏感默认值。本地开发密钥应写入不会提交的 `.env.local`：

```shell
BETTER_AUTH_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=KnowMesh <invite@example.com>
```

生产环境可在 `.env.production.local` 中配置：

```shell
NEXT_PUBLIC_APP_URL=https://example.com
BETTER_AUTH_SECRET=
DATABASE_URL=postgresql://user:password@host:5432/database
RESEND_API_KEY=
RESEND_FROM_EMAIL=KnowMesh <invite@example.com>
```

所有应用环境变量统一在 `src/libs/Env.ts` 中验证。

## 本地开发

启动完整的本地开发环境：

```shell
npm run dev
```

该命令通过 `scripts/local-runtime.ts` 启动 PGlite、执行数据库迁移，然后启动 Next.js。默认访问 [http://localhost:3000](http://localhost:3000)。

当前路由：

| 路由 | 用途 | 访问方式 |
| --- | --- | --- |
| `/` | 产品首页 | 公开 |
| `/sign-in` | 登录 | 公开 |
| `/sign-up` | 注册 | 公开 |
| `/forgot-password` | 找回密码 | 公开 |
| `/reset-password` | 重置密码 | 公开 |
| `/dashboard` | 团队知识工作台 | 需要登录 |
| `/personal` | 个人 Workspace 的项目与文档 | 需要登录 |
| `/collaboration` | 当前 Team Workspace 的项目与文档 | 需要登录 |
| `/search` | 搜索有权读取的文档标题和正文 | 需要登录 |
| `/starred` | 查看当前用户收藏的文档 | 需要登录 |
| `/notifications` | 查看和标记站内通知 | 需要登录 |
| `/invitations/accept` | 验证并接受 Workspace 邀请 | 需要登录 |
| `/settings/preferences` | 外观与内容宽度偏好 | 需要登录 |
| `/settings/user-profile` | 账户资料与密码管理 | 从已登录工作台进入 |
| `/api/auth/[...all]` | Better Auth 认证与生命周期 API | Better Auth 处理 |
| `/robots.txt` | 搜索引擎规则 | 公开 |
| `/sitemap.xml` | 公开页面 sitemap | 公开 |

`/api/auth/[...all]` 为 Better Auth 提供的服务端认证与生命周期接口，处理登录、注册、邮箱验证、密码重置和会话读取。受保护页面通过 `src/proxy.ts` 快速重定向，并在服务端通过 `requireUser()` 进行完整的数据库 Session 校验。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 PGlite、执行迁移并运行 Next.js 开发服务器 |
| `npm run dev:next` | 在数据库已经可用时仅启动 Next.js |
| `npm run build-local` | 使用内存 PGlite 完成本地生产构建 |
| `npm run build` | 迁移已配置数据库并创建生产构建 |
| `npm run start` | 启动已经构建的生产应用 |
| `npm run clean` | 清理构建、输出和覆盖率产物 |
| `npm run codegraph:watch` | 监听源码保存并同步 CodeGraph 索引 |
| `npm run lint` | 检查格式和 lint 规则 |
| `npm run lint:fix` | 修复支持自动处理的格式和 lint 问题 |
| `npm run check:types` | 执行 TypeScript 类型检查且不生成文件 |
| `npm run test` | 运行 Vitest 单元与数据库集成测试 |
| `npm run test:e2e` | 运行 Playwright 端到端测试 |
| `npm run db:generate` | 根据 Drizzle schema 生成迁移 |
| `npm run db:migrate` | 执行数据库迁移 |
| `npm run db:studio` | 打开 Drizzle Studio |

## 项目结构

```text
src/
  app/          Next.js 页面、布局和元数据路由
  components/   跨功能复用的布局与 UI 组件
  features/     按业务能力组织的组件、查询、Server Actions 和规则
  libs/         环境变量和数据库连接
  models/       Drizzle 数据模型
  styles/       全局样式
  utils/        应用配置和通用工具
scripts/        本地运行环境和 CodeGraph 工具
tests/
  e2e/          浏览器用户流程
  *.integ.ts    数据库集成测试
tools/          本地开发辅助工具
```

## 验证

提交前运行：

```shell
npm run lint
npm run check:types
npm run test
npm run build-local
npm run test:e2e
```

CI 会执行构建、静态检查、测试和覆盖率收集。

## 生产构建产物

GitHub Actions 的 `Release` 工作流会在推送到 `main` 或手动触发时构建 Next.js standalone 应用，并在对应的 Actions 运行页面上传名为 `knowmesh-<commit SHA>` 的 artifact。该文件保留 14 天，不会出现在 GitHub Releases 页面。

工作流从名为 `production` 的 GitHub Environment 读取以下配置：

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Environment variable | `PRODUCTION_APP_URL` | 构建时写入的生产站点 HTTPS 地址 |
| Environment secret | `BETTER_AUTH_SECRET` | 构建和运行 Better Auth 所需的密钥 |

下载并解压 artifact 后，入口文件为 `server.js`。生产服务器仍需在运行时提供 `BETTER_AUTH_SECRET` 和 `DATABASE_URL`，并在切换应用版本前单独执行数据库迁移；这些运行时密钥不会打包进 artifact。
