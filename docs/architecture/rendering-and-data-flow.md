# 渲染与数据流

状态：Current

本文说明 KnowMesh 当前如何在 Server Component、Client Component、Server Action 和普通服务端函数之间分配职责。

## 核心原则

```text
首屏读取：Server Component → server-only 查询 → 数据库
用户交互：Client Component 管理界面状态
内部写入：Client Component → Server Action → 数据库
交互式权限读取：Client Component → Server Action → 资源授权 → 数据库与 Clerk 用户目录
写入后同步：router.refresh() → 重新执行服务端读取
文档编辑：Client Component → 防抖/失焦保存 → Server Action → JSONB
```

`async` 不决定函数是否为 Server Action。决定因素是调用发生在哪个运行边界，以及导出函数是否使用 `'use server'` 暴露为 Action。

## 初始工作区导航数据

`WorkspaceLayout` 默认在服务器运行：

```text
浏览器请求任一受保护工作区页面
→ Next.js 执行 WorkspaceLayout
→ WorkspaceLayout 并行调用 getProjects() 和 getDocumentNavigation()
→ 两个 server-only 查询分别按当前 Clerk 成员关系读取项目和文档元数据
→ 项目及文档导航数据作为 props 传给 AppShell
→ 页面结构和序列化数据发送给浏览器
```

`getProjects` 和 `getDocumentNavigation` 是 `server-only` 普通函数，不是 Server Action。它们与 `WorkspaceLayout` 在同一服务器边界内调用，不产生额外浏览器请求。

项目及文档导航查询位于共享工作区布局，而不是只位于文档页面，因为侧边栏在搜索、收藏、设置、个人和协作页面同样存在。当前导航查询返回所有可访问文档的元数据，没有分页；正文仍只由具体文档页面按需读取。

## 创建项目

`CreateProjectDialog` 是 Client Component。表单提交后调用 `createProject`：

```text
用户提交表单
→ 客户端 Zod 校验
→ 客户端调用标记了 `'use server'` 的 `createProject`
→ Clerk 服务端鉴权
→ 服务端 Zod 校验
→ 数据库事务写 projects 和 project_members
→ 客户端 router.refresh()
→ WorkspaceLayout 重新查询并更新侧边栏
```

`createProject` 文件顶部的 `'use server'` 声明了服务器执行边界；客户端只调用该 Action，数据库访问仍位于服务器模块。

## 文档读取与保存

个人和协作页面读取查询参数后复用 `ProjectDocumentsPage`：

```text
页面取得 project 和 document 参数
→ getProjectDocuments 从 Clerk 会话取得 userId
→ getProjectAccess 验证 project_members
→ 查询项目文档元数据和所选文档内容
→ DocumentWorkspace 与 DocumentEditor 接收所选文档数据
```

创建和更新均使用 Server Action。客户端的 `projectId` 或 `documentId` 只用于定位候选资源，服务端仍会重新查询成员关系。`viewer` 可以读取，不能创建或修改；`owner` 和 `editor` 可以写入。

Tiptap 正文变更先在客户端合并，随后调用 `updateDocument`。服务端再次验证 ProseMirror JSON 结构后写入 `documents.content`。当前没有实时通道或冲突合并，多客户端编辑采用数据库最后写入结果。

`DocumentEditor` 在创建和销毁时通过 `DocumentEditorToolbarProvider` 注册当前 Tiptap 实例。共享 `ContentToolbar` 从该上下文取得编辑器，仅在可编辑文档打开时显示格式命令；编辑器内容仍由文档页面持有，工具栏上下文不保存正文副本。

## 权限总览

侧边栏右键菜单按需调用 `getPermissionOverview` Server Action。该 Action 从当前 Clerk 会话取得身份，再按请求范围验证可访问项目或文件；验证通过后查询完整项目成员，并通过 Clerk 用户目录补充用于显示的姓名和主邮箱。当前用户标记由服务端计算。

个人工作区和协作区只是项目分类，因此工作区总览先调用成员过滤后的项目查询，再按项目分组读取权限。文件没有独立 ACL，因此文件总览先验证文件访问权，再返回所属项目权限。这两种继承或聚合关系都会在界面中明确说明。

## 安全不变量

- 客户端输入永远不作为身份依据。
- `userId` 必须在服务端从 Clerk 会话取得。
- 客户端校验用于体验，服务端必须再次校验。
- 查询必须按当前用户成员关系限制结果。
- 传给 Client Component 的数据必须可序列化，并只包含界面需要的字段。

## 当前传输边界

- 当前项目创建、文档创建、文档更新和交互式权限总览使用 Server Action。
- 当前没有 Route Handler、公开 API、Webhook、文件传输或实时连接实现。
- `src/proxy.ts` 的 matcher 排除了 `/api`；这只描述当前 matcher 范围，不代表仓库已经存在 API 鉴权方案。

新增其他传输边界时，应根据实际实现更新本文档；在代码出现前不预先指定其协议、鉴权或部署方案。

## 相关代码

- `src/app/(workspace)/layout.tsx`：服务端初始查询入口。
- `src/proxy.ts`：当前页面路由保护范围和 `/api` matcher 排除规则。
- `src/features/projects/server/GetProjects.ts`：server-only 项目查询。
- `src/features/documents/server/GetDocumentNavigation.ts`：server-only 文档导航元数据查询。
- `src/features/projects/components/CreateProjectDialog.tsx`：客户端表单。
- `src/features/projects/server/CreateProject.ts`：创建项目 Server Action。
- `src/features/projects/server/GetPermissionOverview.ts`：按需授权并读取权限总览。
- `src/components/layout/AppShell.tsx`：客户端工作区外壳。
- `src/features/documents/components/ProjectDocumentsPage.tsx`：项目文档服务端页面组合。
- `src/features/documents/server/GetProjectDocuments.ts`：文档 server-only 查询。
- `src/features/documents/server/CreateDocument.ts`：文档创建 Server Action。
- `src/features/documents/server/UpdateDocument.ts`：文档更新 Server Action。

## 相关决策

- [ADR 0001：工作区初始数据使用 Server Component](../adr/0001-use-server-components-for-workspace-data.md)
- [ADR 0002：文档内容使用版本化 ProseMirror JSON](../adr/0002-use-versioned-prosemirror-json.md)
