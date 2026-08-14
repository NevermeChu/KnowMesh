# 系统架构概览

状态：Current

本文描述 KnowMesh 当前已经实现的主要运行边界，不展开单个组件的样式和局部事件处理。

## 应用边界

KnowMesh 使用 Next.js App Router、React Server Components、Clerk、Drizzle ORM 和 PostgreSQL 兼容数据库。

```text
浏览器
├─ 公开首页与认证 UI
└─ 登录后的 Client Components
     ├─ AppShell
     ├─ AppSidebar
     ├─ CreateProjectDialog
     └─ Tiptap DocumentEditor
            │ Server Actions
            ▼
Next.js 服务器
├─ Server Components 和路由布局
├─ Clerk 服务端鉴权
├─ Clerk Webhook Route Handler
├─ server-only 查询
└─ Drizzle
       │
       ▼
PostgreSQL / 本地 PGlite
```

## 路由分区

- `src/app/(app)`：公开根页面，包含登录或进入工作台的入口及产品介绍内容。
- `src/app/(auth)`：登录和注册页面。
- `src/app/(workspace)`：登录后的工作区页面，共享 `WorkspaceLayout` 和 `AppShell`。
- `src/proxy.ts`：声明受保护路由并通过 Clerk middleware 执行访问保护。

路由组只组织代码，不自动提供鉴权；新增工作区路由时必须同时确认 `src/proxy.ts` 的保护范围。

当前仓库提供 `/api/webhooks/clerk` Route Handler。middleware matcher 排除了 `/api`，该端点不使用浏览器会话鉴权，而是通过 Clerk Webhook 签名验证来源；其他新增 API 路由必须单独定义认证和授权边界。

## 代码职责

- `src/app`：当前 URL、路由布局、页面组合和 Metadata。
- `src/components/layout`：跨工作区页面复用的应用外壳。
- `src/features`：按业务能力组织组件、校验、服务端写入和查询。
- `src/models/Schema.ts`：Drizzle 数据库结构入口。
- `src/libs`：数据库连接和环境配置等基础设施。
- `migrations`：数据库结构的版本化变更。

业务页面不应把完整实现堆入 `page.tsx`。路由层负责组合，业务规则跟随对应 feature。

## 当前工作区外壳

`src/app/(workspace)/layout.tsx` 是 Server Component，先解析当前用户可访问的活动 Workspace，再读取该 Workspace 的项目和文档导航数据，并把安全、可序列化的数据传给 `AppShell`。

`AppShell` 是 Client Component，负责：

- 侧边栏宽度和隐藏状态。
- 共享的 `AppSidebar`。
- 内容区工具栏和全屏状态。
- 当前文档编辑器与共享内容工具栏之间的命令上下文。
- 渲染当前路由内容。

左上角切换器选择真实 Workspace。个人区域始终读取当前有效用户的 Personal Workspace；协作区域只在活动 Workspace 为 Team 时显示。两个区域复用同一项目与文档实现，但不是 Project 数据字段。

个人区域和协作区域页面也复用同一个文档功能。Workspace Layout 在服务端读取项目和文档导航元数据，全局侧边栏按项目显示文档；页面 Server Component 按当前成员关系读取所选文档。创建交互和 Tiptap 编辑器位于 Client Component，格式命令显示在共享内容工具栏。正文以 ProseMirror JSON 通过 Server Action 保存到 PostgreSQL `JSONB`。

## 当前页面状态

- `/`：公开根页面，根据 Clerk 登录状态显示登录、退出或进入工作台入口；页面中的产品示意内容不连接文档数据。
- `/dashboard`：显示静态工作台介绍和账户设置入口。
- `/personal`、`/collaboration`：读取 `project` 和可选的 `document` 查询参数，呈现项目文档列表、创建入口及单人编辑器；未选择项目时显示引导状态。
- `/search`、`/starred`、`/settings/preferences`：当前渲染 `AppSectionPlaceholder`，没有对应的数据读取或业务操作。
- `/settings/user-profile`：渲染 Clerk `UserProfile`。
- 侧边栏可以创建和列出个人、协作项目；点击项目通过 `project` 查询参数打开对应文档工作区。

## 已实现与未实现

已实现：

- Clerk 登录与工作区路由保护。
- 登录后共享应用外壳。
- 个人与协作项目创建。
- Workspace 创建、切换和项目归属。
- Clerk 注册完成后通过签名 Webhook 幂等创建 Personal Workspace；owner 可以从工作区管理删除该空间，Clerk 账户删除时也会清理该空间。
- Clerk 账户删除后通过签名 Webhook 删除用户拥有的 Workspace 和 Project，并退出其他共享资源。
- 项目及 owner 成员持久化。
- 当前用户项目列表查询和侧边栏刷新。
- 工作区、项目和文件的能力授权、分层管理弹窗、重命名与删除。
- 项目内文档创建、列表和读取。
- 基于 Tiptap 的单人富文本编辑与 JSONB 自动保存。
- Personal Workspace 项目仅 owner 授权；Team Workspace 成员可发现导航结构，Project 直接成员才能读取正文；文件继承 Project 内容权限。

尚未实现：

- 文档层级树、移动、版本历史和 Markdown 导入导出。
- 所有权转移、评论和实时协作。
- 面向外部客户端的稳定 API。

未实现内容只表示当前边界，不构成已经批准的实现方案。

## 相关文档

- [渲染与数据流](rendering-and-data-flow.md)
- [项目业务](../features/projects.md)
- [数据库与迁移](../database/schema-and-migrations.md)
- [ADR 0001](../adr/0001-use-server-components-for-workspace-data.md)
- [文档业务](../features/documents.md)
- [ADR 0002](../adr/0002-use-versioned-prosemirror-json.md)
- [ADR 0003](../adr/0003-introduce-workspace-resource-boundary.md)
- [ADR 0004](../adr/0004-use-capability-authorization-and-collaboration-inheritance.md)
- [ADR 0008](../adr/0008-delete-owned-resources-on-account-removal.md)
