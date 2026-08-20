# 渲染与数据流

状态：Current

本文说明 KnowMesh 当前如何在 Server Component、Client Component、Server Action 和普通服务端函数之间分配职责。

## 核心原则

```text
首屏读取：Server Component → server-only 查询 → 数据库
用户交互：Client Component 管理界面状态
内部写入：Client Component → Server Action → 数据库
交互式权限读取：Client Component → Server Action → 资源授权 → 数据库与本地用户表
写入后同步：Server Action 使工作区布局数据失效 → 重新执行服务端读取
权限通知：权限 Server Action → 同一数据库事务写业务状态与用户通知
文档编辑：Client Component → 防抖/失焦保存 → Server Action → JSONB
```

`async` 不决定函数是否为 Server Action。决定因素是调用发生在哪个运行边界，以及导出函数是否使用 `'use server'` 暴露为 Action。

## 受保护页面的认证回跳

`src/proxy.ts` 保护工作区与邀请页面。未检测到 Better Auth Session cookie 时，代理将完整的站内相对路径写入 `redirect_url` 后转到 `/sign-in`。认证页服务端校验该参数不能离开当前应用，并在登录与注册页面之间继续携带它。邮箱验证成功后 Better Auth 自动创建 Session，并回到该目标；注册回调只附加用于展示成功提示的站内状态，不改变原始邀请 token。代理的 cookie 检查只用于快速重定向；页面、Server Action 和 Route Handler 仍必须通过 `requireUser()` 查询数据库并完整验证 Session。

这会保留 Workspace 邀请链接的 token，但不自动接受邀请；用户仍必须在接受页明确确认，服务端 Action 再次校验 token 和已验证邮箱。`/dashboard` 只是没有安全动态目标时的 fallback。

## 初始工作区导航数据

`WorkspaceLayout` 默认在服务器运行：

```text
浏览器请求任一受保护工作区页面
→ Next.js 执行 WorkspaceLayout
→ WorkspaceLayout 调用 getWorkspaceContext()
→ 服务端通过 requireUser() 验证 Better Auth Session，再按 workspace_members 校验 HttpOnly Workspace cookie 并确定当前 Workspace
→ WorkspaceLayout 为 Personal Workspace 与可选的活动 Team Workspace 调用 getWorkspaceNavigation()
→ server-only 导航查询认证一次，计算可访问项目后按这些项目 ID 读取文档元数据
→ 项目及文档导航数据作为 props 传给 AppShell
→ 页面结构和序列化数据发送给浏览器
```

`getWorkspaceContext` 和 `getWorkspaceNavigation` 是 `server-only` 普通函数，不是 Server Action。它们与 `WorkspaceLayout` 在同一服务器边界内调用，不产生额外浏览器请求。`getCurrentUser`、`getWorkspaceContext`、`getProjectAuthorization` 和 `getUnreadNotificationCount` 使用 React 请求级缓存（`cache()`），使 Layout、具体页面与鉴权入口在同一次 Server Component 渲染中复用 Session 或查询结果；该缓存不跨请求保存身份或权限。cookie 只保存上次选择，服务端必须重新验证成员关系；无效或已失去访问权时回退到 Personal Workspace。

## 工作台流式聚合

`/dashboard` 的标题和快捷入口同步渲染，最近文档、通知摘要、待处理邀请与权限申请分别位于独立的 `Suspense` 边界。某一数据源变慢时只延迟对应区块，不阻塞工作台主体或其他区块；路由级 `loading.tsx` 负责客户端导航的即时过渡反馈。

`getRecentDocuments`、`getPendingApprovals` 和 `getPendingInvitations` 使用 React 请求级缓存，只在同一次服务端渲染中复用结果。待处理 Workspace 邀请直接使用 `requireUser()` 返回的唯一已验证邮箱，不访问外部用户目录；独立 `Suspense` 边界仍用于隔离各业务查询的延迟与错误。

`getWorkspaceContext` 是只读查询，不创建 Personal Workspace。Better Auth 注册初始化流程为：

```text
Better Auth 创建本地 user
→ databaseHooks.user.create.after 调用 ensureUserWorkspace
→ ensureUserWorkspace 在事务中创建 Personal Workspace 与 owner 成员
→ Session 创建 hook 在缺少空间时执行同一幂等补偿
→ 邮箱验证完成后同步历史待处理 Workspace 邀请通知
```

Better Auth 的 after hook 不与用户写入共享同一个业务事务；hook 失败会让注册请求显示可重试错误，后续 Session 创建 hook 继续补偿缺失的 Personal Workspace。部分唯一索引保证重复执行不会创建第二个个人空间。

账户删除流程为：

```text
用户从 KnowMesh 账号设置提交当前密码
→ 应用通过 Better Auth 服务端 API 验证当前密码
→ 应用在同一个数据库事务中调用 deleteUserData 并删除 Better Auth user
→ deleteUserData 删除用户拥有的 Workspace 和 Project
→ 外键级联删除自有资源的下级内容
→ 清理其他 Workspace 和 Project 中的成员、申请和邀请关系
→ 保留其他人 Project 中的 Document，并匿名化 created_by_id
```

账户删除采用“自有资源删除、他人资源退出”的过渡策略，不执行所有权转让。Better Auth 内置账户删除入口保持关闭；KnowMesh Server Action 将业务清理和身份行删除放入同一个 Drizzle 事务，任一步失败都会整体回滚。

普通 Workspace 和 Project 操作复用相同语义：Project 右键权限弹窗以及“设置 → 工作区管理”根据当前用户角色显示“删除”或“退出”，服务端只接收资源 ID，并在已认证边界重新解析 owner/member 身份。owner 删除完整资源；member 退出时只清理自己的关系。Workspace member 退出前会递归处理其直接参与的 Project，避免留下 owner Project 或违反成员外键。

项目及文档导航查询位于共享工作区布局，而不是只位于文档页面，因为侧边栏在搜索、收藏、设置、个人和协作页面同样存在。项目权限只计算一次，文档查询复用已经授权的项目 ID；当前导航查询没有分页，正文仍只由具体文档页面按需读取。

共享工作区布局使用 `RealtimeNotificationProvider` 注入 SSR 初始未读通知数，并在客户端与 `/api/realtime/notifications` 建立 SSE 长连接。通知是用户级数据，不按活动 Workspace 过滤；`notifications` 表触发器在写入事务提交后通过 PostgreSQL `NOTIFY` 发出不含正文的信号，各 Node.js 进程的 `NotificationDatabaseSubscriber` 读取已提交快照和准确未读数，再通过进程内 `NotificationBroadcaster` 向本进程 SSE 连接扇出。初始连接和浏览器重连都会从数据库校准未读数。侧边栏 `NotificationSidebarBadge` 仅局部更新数字文本，主内容区、编辑器与导航树不重渲染。`/notifications` 在右侧内容区读取最近 50 条，读取不自动标为已读，单条和全部已读均由明确的 Server Action 完成。

## 创建项目

`CreateProjectDialog` 是 Client Component。表单提交后调用 `createProject`：

```text
用户提交表单
→ 客户端 Zod 校验
→ 客户端调用标记了 `'use server'` 的 `createProject`
→ requireUser() 完整验证 Better Auth Session
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
→ getProjectDocuments 从 Better Auth Session 取得 userId
→ getProjectAuthorization 用 Workspace 成员关系授予结构发现，再用 Project 直接角色授予内容权限
→ 验证项目属于当前 Workspace
→ 查询项目文档元数据和所选文档内容
→ DocumentWorkspace 与 DocumentEditor 接收所选文档数据
```

创建、更新和删除均使用 Server Action。客户端的 `projectId`、`documentId` 或能力只用于定位候选资源和界面呈现，服务端仍会重新计算授权。`viewer` 可以读取，不能创建、修改或删除文件；`owner` 和 `editor` 可以管理文件。

Tiptap 正文变更先在客户端合并，随后调用 `updateDocument`。服务端再次验证 ProseMirror JSON 结构后写入 `documents.content`。当前没有实时通道或冲突合并，多客户端编辑采用数据库最后写入结果。

`DocumentEditor` 在创建和销毁时通过 `DocumentEditorToolbarProvider` 注册当前 Tiptap 实例。共享 `ContentToolbar` 从该上下文取得编辑器，仅在可编辑文档打开时显示格式命令；编辑器内容仍由文档页面持有，工具栏上下文不保存正文副本。

## 权限总览

邀请接受、权限申请提交和审批通过会在对应业务事务内写入持久化通知。通知保存当时的标题和正文快照，不依赖之后会被删除的待处理邀请或申请记录；读取和已读写入始终按当前用户限制收件人。

侧边栏管理入口按需调用 `getPermissionOverview` Server Action。该 Action 从 Better Auth Session 取得身份，再按请求范围验证读取能力；验证通过后查询对应范围的直接成员、邀请候选人和待处理申请，并批量读取本地 `user` 表补充姓名、邮箱和头像。响应同时返回服务端计算的能力，客户端据此呈现重命名、删除和成员管理操作；对应 Server Action 仍会再次授权。Workspace 邀请由应用生成令牌并通过 Resend 发送邮件。邮件 CTA 只导航到接受页，不执行成员写入。接受页重新校验令牌、状态和当前用户唯一已验证邮箱，只有邮箱匹配且邀请仍有效时才允许明确接受。Project 只能邀请所属 Workspace 的现有成员，接受后成为 viewer。文件继续继承项目直接成员权限。

Personal 和 Collaboration 是界面区域，不是 Project 数据字段。Personal 区域始终读取当前用户的 Personal Workspace；Collaboration 区域只在活动 Workspace 为 Team 时显示并读取该 Team 的项目。文件没有独立 ACL，因此文件总览验证文件读取能力后返回所属项目的授权来源；界面通过“项目名称 \ 文件名称”路径呈现文件的所属项目。

## 外观主题渲染

主题偏好持久化在 `user_preferences`，但渲染路径不查询数据库：根布局读取 `knowmesh-theme` cookie 镜像，在 `<html>` 上输出 `data-theme` 与可选的 `dark` 类，首帧前由内联脚本把 `system` 解析为当前系统偏好并持续监听其变化。`updateThemePreference` Server Action 同时 upsert 数据库和 cookie，并 `revalidatePath('/', 'layout')`。设置页的乐观切换在本地立即应用同一解析逻辑，Action 失败时回滚。

由此产生的渲染边界：根布局读取 cookie，因此所有路由（含公开首页）均为动态渲染。细节见[系统偏好设置](../features/preferences.md)。

## 安全不变量

- 客户端输入永远不作为身份依据。
- `userId` 必须在服务端通过 `requireUser()` 从 Better Auth Session 取得。
- 客户端校验用于体验，服务端必须再次校验。
- 查询必须按当前用户成员关系限制结果。
- 传给 Client Component 的数据必须可序列化，并只包含界面需要的字段。

## 当前传输边界

- 当前项目创建、资源重命名和删除、文档创建与更新、交互式权限总览使用 Server Action。
- 当前存在 `/api/auth/[...all]` Better Auth Route Handler，提供认证和账户生命周期接口。
- 当前存在 `/api/realtime/notifications` SSE Route Handler，基于 Web Streams `ReadableStream` 向已登录用户推送实时通知与未读数同步事件，包含 25 秒心跳保活。跨进程信号由 PostgreSQL `LISTEN / NOTIFY` 传递，进程内 `NotificationBroadcaster` 只负责向本进程连接扇出。
- `src/proxy.ts` 的 matcher 排除了 `/api`；Route Handler 由自身通过 `requireUser()` 执行 Session 和身份校验。当前没有双向 WebSocket 或外部推送服务。

新增其他传输边界时，应根据实际实现更新本文档；在代码出现前不预先指定其协议、鉴权或部署方案。

## 相关代码

- `src/app/(workspace)/layout.tsx`：服务端初始查询入口。
- `src/app/api/auth/[...all]/route.ts`：挂载 Better Auth Route Handler。
- `src/app/api/realtime/notifications/route.ts`：挂载 SSE 实时通知长连接 Route Handler。
- `src/libs/Auth.ts`：配置 Better Auth、Drizzle adapter、邮件和用户生命周期 hook。
- `src/features/auth/server/DeleteAccount.ts`：验证当前密码，并在单个事务中组合业务清理与身份删除。
- `src/features/users/server/DeleteUserData.ts`：使用调用方事务清理用户拥有的资源并退出其他共享资源。
- `src/features/permissions/server/ResourceRemoval.ts`：统一执行 Workspace/Project 的 owner 删除与 member 退出事务步骤。
- `src/features/workspaces/server/GetWorkspaceContext.ts`：解析并授权当前 Workspace。
- `src/features/workspaces/server/CreateWorkspace.ts`：创建 Workspace 与 owner 成员。
- `src/features/workspaces/server/SelectWorkspace.ts`：校验选择并写入当前 Workspace cookie。
- `src/proxy.ts`：当前页面路由保护范围和 `/api` matcher 排除规则。
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`：server-only 项目与文档导航查询。
- `src/features/projects/components/CreateProjectDialog.tsx`：客户端表单。
- `src/features/projects/server/CreateProject.ts`：创建项目 Server Action。
- `src/features/projects/server/GetPermissionOverview.ts`：按需授权并读取权限总览。
- `src/features/emails/components/WorkspaceInvitationEmail.tsx`：渲染邮件客户端兼容的 Workspace 邀请邮件。
- `src/features/workspaces/server/GetWorkspaceInvitation.ts`：按令牌和当前已验证邮箱读取安全邀请摘要。
- `src/features/workspaces/components/AcceptWorkspaceInvitation.tsx`：呈现邀请状态，并在用户确认后调用接受 Action。
- `src/features/permissions/`：能力矩阵与服务端资源授权。
- `src/features/notifications/`：通知事件、实时广播总线、用户级读取和已读 Action。
- `src/features/preferences/server/UpdateThemePreference.ts`：主题偏好 Server Action（数据库 + cookie 双写）。
- `src/app/layout.tsx`：根布局主题 cookie 读取与 `<html>` 主题输出。
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
- [ADR 0007：通过 Clerk 注册 Webhook 创建 Personal Workspace](../adr/0007-provision-personal-workspace-from-clerk-webhook.md)（已替代）
- [ADR 0008：统一按 owner 删除资源、按 member 退出资源](../adr/0008-delete-owned-resources-on-account-removal.md)
- [ADR 0009：使用 Better Auth 管理本地身份](../adr/0009-use-better-auth-for-local-identity.md)
- [ADR 0010：使用 SSE 实现实时站内通知](../adr/0010-use-sse-for-realtime-notifications.md)
- [ADR 0011：使用事务性 PostgreSQL 通知驱动跨进程 SSE](../adr/0011-use-postgresql-notify-for-realtime-delivery.md)
