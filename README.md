# KnowMesh 知序

KnowMesh 是一个面向团队的知识工作空间，用于汇聚文档、项目资料和协作上下文，让零散信息逐步沉淀为可持续使用的共同知识。

## 技术栈

- Next.js 16、React 19 和 TypeScript
- Tailwind CSS 4
- Clerk 身份认证
- Drizzle ORM、PostgreSQL 和本地 PGlite 运行环境
- Zod 环境变量验证
- Ultracite、Oxlint 和 Oxfmt
- Vitest、Playwright 和 GitHub Actions CI

数据库迁移和本地运行环境已经配置完成，但当前页面尚未执行数据库业务查询。

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

仓库中的 `.env` 提供本地开发默认值。本地密钥应写入 `.env.local`：

```shell
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

生产环境可在 `.env.production.local` 中配置：

```shell
NEXT_PUBLIC_APP_URL=https://example.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=postgresql://user:password@host:5432/database
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
| `/dashboard` | 团队知识工作台 | 需要登录 |
| `/settings/user-profile` | Clerk 账户资料 | 从已登录工作台进入 |
| `/robots.txt` | 搜索引擎规则 | 公开 |
| `/sitemap.xml` | 公开页面 sitemap | 公开 |

当前没有生效的 API Route Handler。

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
| `npm run test` | 运行 Vitest 单元和浏览器组件测试 |
| `npm run test:e2e` | 运行 Playwright 集成与端到端测试 |
| `npm run db:generate` | 根据 Drizzle schema 生成迁移 |
| `npm run db:migrate` | 执行数据库迁移 |
| `npm run db:studio` | 打开 Drizzle Studio |

## 项目结构

```text
src/
  app/          Next.js 页面、布局和元数据路由
  libs/         环境变量和数据库连接
  models/       Drizzle 数据模型
  styles/       全局样式
  utils/        应用配置和通用工具
scripts/        本地运行环境和 CodeGraph 工具
tests/
  e2e/          浏览器用户流程
  integration/  API 和数据库集成测试
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
