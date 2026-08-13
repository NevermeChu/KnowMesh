# 渲染与数据流

状态：Current

本文说明 KnowMesh 当前如何在 Server Component、Client Component、Server Action 和普通服务端函数之间分配职责。

## 核心原则

```text
首屏读取：Server Component → server-only 查询 → 数据库
用户交互：Client Component 管理界面状态
内部写入：Client Component → Server Action → 数据库
交互式权限读取：Client Component → Server Action → 资源授权 → 数据库与 Clerk 用户目录
写入后同步：Server Action 使工作区布局数据失效 → 重新执行服务端读取
文档编辑：Client Component → 防抖/失焦保存 → Server Action → JSONB
```

`async` 不决定函数是否为 Server Action。决定因素是调用发生在哪个运行边界，以及导出函数是否使用 `'use server'` 暴露为 Action。

## 初始工作区导航数据

`WorkspaceLayout` 默认在服务器运行：

```text
浏览器请求任一受保护工作区页面
→ Next.js 执行 WorkspaceLayout
→ WorkspaceLayout 调用 getWorkspaceContext()
→ 服务端按当前 Clerk 用户的 workspace_members 校验 HttpOnly cookie 并确定当前 Workspace
→ WorkspaceLayout 为 Personal Workspace 与可选的活动 Team Workspace 调用 getWorkspaceNavigation()
→ server-only 导航查询认证一次，计算可访问项目后按这些项目 ID 读取文档元数据
→ 项目及文档导航数据作为 props 传给 AppShell
→ 页面结构和序列化数据发送给浏览器
```

`getWorkspaceContext` 和 `getWorkspaceNavigation` 是 `server-only` 普通函数，不是 Server Action。它们与 `WorkspaceLayout` 在同一服务器边界内调用，不产生额外浏览器请求。`getWorkspaceContext` 使用 React 请求级缓存，使 Layout 与具体页面在同一次 Server Component 渲染中复用结果；该缓存不跨请求保存身份或权限。cookie 只保存上次选择，服务端必须重新验证成员关系；无效或已失去访问权时回退到 Personal Workspace。

`getWorkspaceContext` 是只读查询，不再创建 Personal Workspace。Clerk 注册完成后的初始化流程为：

```text
Clerk 完成用户注册
→ 向 /api/webhooks/clerk 投递 user.created
→ Route Handler 使用 CLERK_WEBHOOK_SIGNING_SECRET 验证签名
→ ensureUserWorkspace 在事务中创建 Personal Workspace 与 owner 成员
→ 部分唯一索引使重复投递幂等
```

Webhook 失败返回 `5xx` 以触发 Clerk 重试。Webhook 是异步投递，因此不能把注册后的页面重定向当作数据库写入已经完成的同步证明。

项目及文档导航查询位于共享工作区布局，而不是只位于文档页面，因为侧边栏在搜索、收藏、设置、个人和协作页面同样存在。项目权限只计算一次，文档查询复用已经授权的项目 ID；当前导航查询没有分页，正文仍只由具体文档页面按需读取。

## 创建项目

`CreateProjectDialog` 是 Client Component。表单提交后调用 `createProject`：

```text
用户提交表单
→ 客户端 Zod 校验
→ 客户端调用标记了 `'use server'` 的 `createProject`
→ Clerk 服务端鉴权
→ 服务端 Zod 校验
→ 验证当前用户具有目标 Workspace 的 project.create 能力
→ 数据库事务写 projects 和 project_members
→ Server Action 使 Workspace Layout 失效
→ WorkspaceLayout 重新查询并更新侧边栏
```

`createProject` 文件顶部的 `'use server'` 声明了服务器执行边界；客户端只调用该 Action，数据库访问仍位于服务器模块。

项目或文档创建成功后，对应 Server Action 通过 `revalidatePath('/(workspace)', 'layout')` 使共享工作区布局失效。因此侧边栏会重新执行 `getWorkspaceNavigation`，而不依赖客户端刷新与导航的时序。新文档创建返回 ID 后，客户端只负责导航到该文档。

## 文档读取与保存

个人和协作页面读取查询参数后复用 `ProjectDocumentsPage`：

```text
页面取得 project 和 document 参数
→ getWorkspaceContext 确定当前 Workspace
→ getProjectDocuments 从 Clerk 会话取得 userId
→ getProjectAuthorization 用 Workspace 成员关系授予结构发现，再用 Project 直接角色授予内容权限
→ 验证项目属于当前 Workspace
→ 查询项目文档元数据和所选文档内容
→ DocumentWorkspace 与 DocumentEditor 接收所选文档数据
```

创建、更新和删除均使用 Server Action。客户端的 `projectId`、`documentId` 或能力只用于定位候选资源和界面呈现，服务端仍会重新计算授权。`viewer` 可以读取，不能创建、修改或删除文件；`owner` 和 `editor` 可以管理文件。

Tiptap 正文变更先在客户端合并，随后调用 `updateDocument`。服务端再次验证 ProseMirror JSON 结构后写入 `documents.content`。当前没有实时通道或冲突合并，多客户端编辑采用数据库最后写入结果。

`DocumentEditor` 在创建和销毁时通过 `DocumentEditorToolbarProvider` 注册当前 Tiptap 实例。共享 `ContentToolbar` 从该上下文取得编辑器，仅在可编辑文档打开时显示格式命令；编辑器内容仍由文档页面持有，工具栏上下文不保存正文副本。

## 权限总览

侧边栏管理入口按需调用 `getPermissionOverview` Server Action。该 Action 从当前 Clerk 会话取得身份，再按请求范围验证读取能力；验证通过后查询对应范围的直接成员、邀请候选人和待处理申请，并通过 Clerk 用户目录补充姓名和主邮箱。响应同时返回服务端计算的能力，客户端据此呈现重命名、删除和成员管理操作；对应 Server Action 仍会再次授权。Workspace 邀请由应用生成令牌并通过 Resend 发送邮件，接受页校验令牌、有效期和当前 Clerk 用户已验证邮箱；Project 只能邀请所属 Workspace 的现有成员，接受后成为 viewer。文件继续继承项目直接成员权限。

Personal 和 Collaboration 是界面区域，不是 Project 数据字段。Personal 区域始终读取当前用户的 Personal Workspace；Collaboration 区域只在活动 Workspace 为 Team 时显示并读取该 Team 的项目。文件没有独立 ACL，因此文件总览验证文件读取能力后返回所属项目的授权来源；界面通过“项目名称 \ 文件名称”路径呈现文件的所属项目。

## 安全不变量

- 客户端输入永远不作为身份依据。
- `userId` 必须在服务端从 Clerk 会话取得。
- 客户端校验用于体验，服务端必须再次校验。
- 查询必须按当前用户成员关系限制结果。
- 传给 Client Component 的数据必须可序列化，并只包含界面需要的字段。

## 当前传输边界

- 当前项目创建、资源重命名和删除、文档创建与更新、交互式权限总览使用 Server Action。
- 当前存在一个 `POST /api/webhooks/clerk` Route Handler，只接受签名有效的 Clerk 事件，并仅处理 `user.created`。
- `src/proxy.ts` 的 matcher 排除了 `/api`；Webhook 依靠请求签名而不是 Clerk 浏览器会话。当前没有其他公开 API、文件传输或实时连接。

新增其他传输边界时，应根据实际实现更新本文档；在代码出现前不预先指定其协议、鉴权或部署方案。

## 相关代码

- `src/app/(workspace)/layout.tsx`：服务端初始查询入口。
- `src/app/api/webhooks/clerk/route.ts`：验证 Clerk Webhook 并初始化 Personal Workspace。
- `src/features/workspaces/server/GetWorkspaceContext.ts`：解析并授权当前 Workspace。
- `src/features/workspaces/server/CreateWorkspace.ts`：创建 Workspace 与 owner 成员。
- `src/features/workspaces/server/SelectWorkspace.ts`：校验选择并写入当前 Workspace cookie。
- `src/proxy.ts`：当前页面路由保护范围和 `/api` matcher 排除规则。
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`：server-only 项目与文档导航查询。
- `src/features/projects/components/CreateProjectDialog.tsx`：客户端表单。
- `src/features/projects/server/CreateProject.ts`：创建项目 Server Action。
- `src/features/projects/server/GetPermissionOverview.ts`：按需授权并读取权限总览。
- `src/features/permissions/`：能力矩阵与服务端资源授权。
- `src/components/layout/AppShell.tsx`：客户端工作区外壳。
- `src/features/documents/components/ProjectDocumentsPage.tsx`：项目文档服务端页面组合。
- `src/features/documents/server/GetProjectDocuments.ts`：文档 server-only 查询。
- `src/features/documents/server/CreateDocument.ts`：文档创建 Server Action。
- `src/features/documents/server/UpdateDocument.ts`：文档更新 Server Action。
- `src/features/documents/server/DeleteDocument.ts`：文档删除 Server Action。
- `src/features/projects/server/UpdateProject.ts` 和 `DeleteProject.ts`：项目管理 Server Action。
- `src/features/workspaces/server/UpdateWorkspace.ts` 和 `DeleteWorkspace.ts`：Workspace 管理 Server Action。

## 相关决策

- [ADR 0001：工作区初始数据使用 Server Component](../adr/0001-use-server-components-for-workspace-data.md)
- [ADR 0002：文档内容使用版本化 ProseMirror JSON](../adr/0002-use-versioned-prosemirror-json.md)
- [ADR 0003：引入 Workspace 资源边界](../adr/0003-introduce-workspace-resource-boundary.md)
- [ADR 0004：使用能力授权并继承协作项目权限](../adr/0004-use-capability-authorization-and-collaboration-inheritance.md)
- [ADR 0007：通过 Clerk 注册 Webhook 创建 Personal Workspace](../adr/0007-provision-personal-workspace-from-clerk-webhook.md)
