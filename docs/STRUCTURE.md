# 项目结构说明

> [!WARNING]
> 这是项目早期结构快照，包含已经删除的 Counter 和旧路由，不再是当前架构事实来源。当前知识库从 [`docs/README.md`](README.md) 开始；当前架构参见 [`architecture/overview.md`](architecture/overview.md)。本文仅用于追溯项目演进。

本文档以当前仓库中实际存在的文件为准，说明各目录的职责、当前路由关系，以及后续增加业务代码时的放置约定。

## 当前目录树

以下结构省略了 `node_modules/`、`.next/` 等依赖和构建产物，也没有展开 `local.db/` 内部的数据库文件。

```text
.
├── .github/
├── .vscode/
├── local.db/
├── migrations/
│   ├── 0000_init-db.sql
│   └── meta/
├── public/
├── scripts/
│   └── local-runtime.ts
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   └── page.tsx
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   ├── sign-in/page.tsx
│   │   │   └── sign-up/page.tsx
│   │   ├── api/
│   │   │   └── auth/[...all]/route.ts
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── user-profile/page.tsx
│   │   ├── global-error.tsx
│   │   ├── layout.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   ├── libs/
│   │   ├── DB.ts
│   │   ├── DBConnection.ts
│   │   └── Env.ts
│   ├── models/
│   │   └── Schema.ts
│   ├── styles/
│   │   └── global.css
│   ├── templates/
│   │   └── BaseTemplate.tsx
│   ├── utils/
│   │   ├── AppConfig.ts
│   │   └── Helpers.ts
│   └── proxy.ts
├── tests/
│   ├── e2e/
│   │   ├── Counter.e2e.ts
│   │   └── Sanity.e2e.ts
│   └── integration/
│       └── Counter.integ.ts
├── drizzle.config.ts
├── next.config.ts
├── oxfmt.config.ts
├── oxlint.config.ts
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## `src/app`：Next.js 路由层

`src/app` 使用 Next.js App Router。这里负责 URL、路由布局、页面入口、Metadata、错误边界和 Route Handler。

业务代码应尽量避免直接堆积在 `page.tsx` 中。页面文件主要负责：

- 读取路由参数和查询参数。
- 执行页面级鉴权。
- 获取页面所需数据。
- 组合业务组件。
- 声明页面 Metadata。

### 根布局和框架文件

#### `src/app/layout.tsx`

全站唯一的 `RootLayout`，当前负责：

- 输出 `<html>` 和 `<body>`。
- 导入 `global.css`。
- 声明 favicon 和 viewport。
- 从主题 cookie 输出首屏主题，并挂载全站 Toast 容器。

只属于某一类页面的 Header、Sidebar 或导航不应放入根布局。

#### `src/app/global-error.tsx`

全局错误边界。当错误无法由更内层的路由错误边界处理时，Next.js 使用该文件渲染错误页面。

#### `src/app/robots.ts`

生成 `/robots.txt`。当前允许抓取站点，并禁止抓取 `/dashboard`。

#### `src/app/sitemap.ts`

生成 `/sitemap.xml`。站点路由发生变化时，应同步更新这里维护的 URL 列表。

### `(app)` 路由组

```text
src/app/(app)/
└── page.tsx
```

括号目录是路由组，不会出现在 URL 中：

- `(app)/page.tsx` 对应 `/`。
- 当前没有 `(app)/layout.tsx`，首页直接继承 `RootLayout`，并由 `components/landing` 中的区块组件组合公开态 Header、Main 和 Footer。

路由组名称不具备鉴权能力。将页面放入 `(app)` 不会自动要求用户登录，真正的访问保护由 `src/proxy.ts` 或页面附近的服务端鉴权逻辑完成。

### `(auth)` 路由组

```text
src/app/(auth)/
├── layout.tsx
├── forgot-password/page.tsx
├── reset-password/page.tsx
├── sign-in/page.tsx
└── sign-up/page.tsx
```

用于 Better Auth 邮箱密码认证页面：

- `sign-in` 与 `sign-up` 提供登录、注册和邮箱验证入口。
- `forgot-password` 与 `reset-password` 提供密码恢复流程。
- `(auth)/layout.tsx` 使用全屏 Flex 布局将认证组件居中。

### `(workspace)` 工作区路由

```text
src/app/(workspace)/
├── layout.tsx
├── dashboard/page.tsx
├── personal/page.tsx
├── collaboration/page.tsx
├── notifications/page.tsx
├── search/page.tsx
├── starred/page.tsx
└── settings/
```

- `layout.tsx` 通过 `requireUser()` 间接验证 Better Auth Session，并组合 `AppShell`。
- 路由组名称不会进入 URL；例如 `dashboard/page.tsx` 对应 `/dashboard`。
- 工作区、项目和文档数据由共享布局与具体页面的 Server Component 查询组合。

### `settings`

```text
src/app/(workspace)/settings/
├── preferences/page.tsx
└── user-profile/page.tsx
```

`user-profile` 使用 KnowMesh 自有账户设置组件管理 Better Auth 资料、密码和原子账户删除；`preferences` 管理主题与内容宽度。

### `api`

当前 `/api/auth/[...all]` Route Handler 挂载 Better Auth 认证接口。其他业务写入仍优先使用经过认证和授权的 Server Action。

将来新增 Route Handler 时使用：

```text
src/app/api/<resource>/route.ts
```

Route Handler 负责 HTTP 输入输出、鉴权和调用业务逻辑，不应包含大量可复用的业务实现。

## 当前路由关系

| URL | 文件 | 使用的布局 |
| --- | --- | --- |
| `/` | `src/app/(app)/page.tsx` | `RootLayout` |
| `/sign-in` | `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` | `RootLayout` → `(auth)/layout.tsx` |
| `/sign-up` | `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` | `RootLayout` → `(auth)/layout.tsx` |
| `/dashboard` | `src/app/dashboard/page.tsx` | `RootLayout` → `dashboard/layout.tsx` |
| `/settings/user-profile` | `src/app/settings/user-profile/[[...user-profile]]/page.tsx` | `RootLayout` |
| `/robots.txt` | `src/app/robots.ts` | Next.js Metadata Route |
| `/sitemap.xml` | `src/app/sitemap.ts` | Next.js Metadata Route |

## `src/libs`：基础设施层

```text
src/libs/
├── DB.ts
├── DBConnection.ts
└── Env.ts
```

### `Env.ts`

集中声明、读取和验证环境变量。其他文件不得直接读取 `process.env`，需要的变量必须先在 `Env.ts` 中完成验证，再通过 `Env` 使用。

### `DBConnection.ts`

负责根据 `Env.DATABASE_URL` 创建 PostgreSQL Pool 和 Drizzle 实例，并加载 `src/models/Schema.ts`。

### `DB.ts`

创建并导出共享的 `db` 实例。在开发环境中把连接缓存到 `globalThis`，避免 Next.js 热更新反复创建数据库连接。

页面、查询或业务服务通常只应导入 `db`，不应自行调用 `createDbConnection()`。

## `src/models`：数据库模型

当前 `Schema.ts` 是 Drizzle Schema 入口，定义了示例 `counter` 表。`drizzle.config.ts` 的 `schema` 配置直接指向该文件。

这里存放：

- 数据库表。
- 字段与约束。
- 索引。
- Drizzle relation。

如果以后拆分多个模型文件，应继续由 `Schema.ts` 统一导出，或者同步修改 `drizzle.config.ts` 的 Schema 路径。

## `src/styles`：全局样式

`global.css` 由根布局导入，存放 Tailwind CSS v4 入口、全局变量和基础样式。

只服务某个组件或业务页面的样式优先使用 Tailwind 工具类，不要无差别加入全局样式。

## `src/templates`：页面外壳

当前只有 `BaseTemplate.tsx`。它负责：

- 产品名称和标语。
- 左右导航插槽。
- `<header>`、`<main>` 和 `<footer>`。
- 页面宽度和基础文本样式。

它目前只被 `dashboard/layout.tsx` 使用。

如果后续按此前讨论把页面外壳改为 `AppShell`、`AppHeader` 等组件，可以将它们放入 `src/components/layout/`；完成替换且没有调用方后，再删除 `templates/`。

## `src/utils`：通用配置和帮助函数

```text
src/utils/
├── AppConfig.ts
└── Helpers.ts
```

- `AppConfig.ts` 当前保存产品名称 `KnowMesh 知序`。
- `Helpers.ts` 当前提供 `getBaseUrl()`，供 `robots.ts` 和 `sitemap.ts` 生成绝对 URL。

适合放入 `utils` 的代码应是无明确业务归属、无资源生命周期的通用函数。数据库连接和第三方客户端属于 `libs`，特定业务的帮助函数应跟随相应业务模块。

## `src/proxy.ts`：请求鉴权

当前使用轻量 Session cookie 预检：

- `proxy()` 仅通过 Better Auth Session cookie 判断是否需要快速跳转，不把 cookie 当作完整授权依据。
- 保护工作区、邀请、通知、搜索、收藏和设置等路由。
- 未登录访问受保护页面时跳转到 `/sign-in`。
- 当前 matcher 排除了 `/api`。

路由发生变化时，需要同步维护 `isProtectedRoute` 和 proxy matcher。目录名 `(app)` 或 `(auth)` 本身不会改变路由权限。

## `migrations`：数据库迁移

保存 Drizzle 生成的 SQL、Schema 快照和迁移日志：

```text
migrations/
├── 0000_init-db.sql
└── meta/
```

常用命令：

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

迁移文件用于让不同环境按相同顺序更新数据库结构，应提交版本控制并接受代码审查。

## `local.db`：本地数据库数据

`scripts/local-runtime.ts` 在本地开发时通过 PGlite Socket 使用该目录保存 PostgreSQL 兼容数据库数据。

这是生成数据，不是源码：

- 不手工编辑内部文件。
- 不在其中存放迁移或业务代码。
- 不提交版本控制。

## `scripts`：运行辅助脚本

### `local-runtime.ts`

负责协调本地运行流程：

1. 启动 PGlite Socket 数据库。
2. 等待数据库端口就绪。
3. 执行数据库迁移。
4. 根据运行模式启动 Next.js、生产构建或 Playwright 所需服务。
5. 收到退出信号后清理子进程。

## `tests`：集成与端到端测试

```text
tests/
├── owner-invariants.integ.ts
└── e2e/
    └── Sanity.e2e.ts
```

- `*.test.ts` 和 `*.test.tsx` 是纯业务逻辑/核心边界单元测试，与实现文件放在一起。
- `*.integ.ts` 是数据库约束与迁移集成测试，放在 `tests/` 下。
- `*.e2e.ts` 是 Playwright 端到端冒烟测试，放在 `tests/` 下。
- `npm run test` 运行 Vitest 测试。
- `npm run test:e2e` 根据当前 Playwright 配置运行 `tests/` 下的 `*.e2e.*`。

## `public`：静态资源

存放浏览器可直接请求的文件。目前主要是 favicon 和 Apple Touch Icon。

例如：

```text
public/favicon.ico → /favicon.ico
```

## 工具和仓库配置

### 目录

- `.github/`：GitHub Actions、Dependabot 和仓库自动化配置。
- `.vscode/`：推荐扩展、任务、调试以及 Oxc 保存时格式化配置。
- `.codegraph/`：CodeGraph 生成的本地代码索引，不放业务代码。
- `.cursor/`、`.claude/`：本地 AI 工具配置。
- `.storybook/`：Storybook 配置目录，当前没有配置文件。

### 根级文件

- `package.json`：依赖、Node.js 版本和 npm scripts。
- `next.config.ts`：Next.js 配置。
- `tsconfig.json`：TypeScript 严格检查和 `@/` 路径别名。
- `drizzle.config.ts`：Drizzle Schema、迁移目录和数据库配置。
- `vitest.config.ts`：Vitest 单元测试与浏览器组件测试配置。
- `playwright.config.ts`：集成测试和端到端测试配置。
- `oxlint.config.ts`：Oxc Lint 规则。
- `oxfmt.config.ts`：Oxfmt 格式化规则。
- `lefthook.yml`：Git hooks 配置。
- `AGENTS.md`、`CLAUDE.md`：仓库内的开发与代理协作约定。
- `README.md`：项目入口文档。
- `SIMPLIFY.md`：现有的项目简化说明。

环境文件由 `src/libs/Env.ts` 统一验证。不要在源代码、文档或日志中写入密钥。

## 后续业务代码的扩展约定

以下目录当前不存在，只在实际出现对应代码时创建。

### `src/features`

用于存放具体业务能力，例如：

```text
src/features/
└── knowledge/
    ├── components/
    ├── actions/
    ├── queries/
    ├── schemas/
    └── types/
```

- `components/`：只服务该业务的 UI。
- `actions/`：写操作或 Server Actions。
- `queries/`：数据库读取逻辑。
- `schemas/`：Zod 输入与边界校验。
- `types/`：无法从 Schema 或函数推导的业务类型。

`app` 定义业务通过哪个 URL 访问，`features` 定义业务如何实现。两者不要求一一对应。

### `src/components`

用于跨业务共享的组件与公开展示组件：

```text
src/components/
├── auth/
│   └── AuthenticationPanel.tsx
├── landing/
│   ├── InteractiveSearchSimulator.tsx
│   ├── InteractiveWorkspacePreview.tsx
│   ├── KnowledgeMeshCanvas.tsx
│   └── Landing*.tsx
├── layout/
│   ├── AppShell.tsx
│   └── AppSidebar/
└── ui/
    ├── Button.tsx
    ├── ModalDialog.tsx
    └── Input.tsx
```

- `landing/` 存放产品介绍首页的独立展示区块与交互示意组件；样式通过 `.landing-root` 限定在公开首页内。
- `layout/` 存放普通 React 应用外壳组件；Next.js 路由布局仍必须位于 `app/**/layout.tsx`。
- `ui/` 存放不包含特定业务语义的基础 UI 控件。
- 包含明确业务概念的组件应放在对应 `features/<feature>/components/`。

## 新代码放置判断

1. 定义 URL、路由布局、Metadata 或 HTTP 接口：放入 `src/app`。
2. 实现具体业务能力：放入 `src/features/<feature>`。
3. 跨业务复用的基础 UI：放入 `src/components/ui`。
4. 跨业务复用的产品外壳：放入 `src/components/layout`，再由路由 `layout.tsx` 引用。
5. 数据库、环境变量或第三方服务连接：放入 `src/libs`。
6. 数据库表结构：放入 `src/models`。
7. 无业务归属的简单通用函数：放入 `src/utils`。

优先让代码靠近实际使用它的业务模块；确认存在跨业务复用后，再提升到公共目录。
