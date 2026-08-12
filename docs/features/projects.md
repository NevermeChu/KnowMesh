# 项目业务

状态：Current

本文描述真实 Workspace 内个人项目和协作项目共用的业务模型、权限边界和主要创建/查询流程。

## 领域模型

`Workspace` 是可持久化、可切换的顶层团队空间；用户通过 `workspace_members` 取得可见和可切换的 Workspace 列表。每个 `Project` 必须属于一个 Workspace，并通过 `kind` 表示该 Workspace 内的分区：

- `personal`：个人项目。
- `collaboration`：协作项目。

两类项目使用同一张 `projects` 表、同一套创建逻辑和同一套成员查询。`kind` 当前用于创建输入、数据库分类、侧边栏分组和分区权限总览；Private/Shared 是选中 Workspace 内的项目分类，不是额外的实体或导航层。

Workspace 成员角色决定 Workspace 操作，并向 `collaboration` 项目继承能力；`personal` 项目只使用 `project_members` 和项目所有权，不继承 Workspace 内容权限。文件完全继承所属项目能力，没有独立 ACL。Workspace 邮箱邀请、成员角色修改和移除，以及 Project 直接成员管理已经实现；退出、所有权转让和文件独立成员管理尚未实现。

## 成员与所有权不变量

以下规则由当前 Schema、迁移或创建/查询路径直接体现，执行层不同：

- 每个项目必须有一个 `projects.owner_id`。
- 每个项目必须通过 `projects.workspace_id` 属于一个 Workspace。
- owner 必须同时存在于 `project_members`，角色为 `owner`。
- 新项目创建事务写入 owner 成员；具有 `project.members.manage` 的用户还可从所属 Workspace 成员中添加 `editor` 或 `viewer`。
- Schema 定义 `owner`、`editor`、`viewer`；当前创建流程只写入 owner，权限策略已经执行全部三个角色的能力。
- Personal 项目必须具有直接项目权限；Collaboration 项目同时合并项目直接权限与 Workspace 继承权限。
- 项目查询必须限定当前选中的 `workspace_id`，并验证 Workspace 成员关系；Workspace 权限只向 Collaboration 项目继承。
- `(project_id, user_id)` 必须唯一。
- 删除项目必须级联删除成员关系。

### 不变量执行位置

| 规则 | 当前执行位置 | 维护要求 |
| --- | --- | --- |
| `projects.owner_id` 非空 | 数据库 `NOT NULL` | 所有项目写入都必须提供服务端身份 |
| `projects.workspace_id` 非空 | 数据库外键与 `NOT NULL` | 所有项目写入和读取都必须限定 Workspace |
| `(project_id, user_id)` 唯一 | 数据库联合主键 | 不得创建重复成员关系 |
| 删除项目级联删除成员 | 数据库外键 | 删除流程不得绕过数据库约束 |
| owner 同时是 `owner` 成员 | `createProject` 事务和成员迁移回填 | 数据库没有跨表约束，无法阻止其他直接数据库写入造成不一致 |
| 新项目当前只有 owner 成员 | `createProject` 是唯一成员写入路径 | 这是当前写入结果，不是数据库约束；Schema 允许 `editor`、`viewer` |
| 仅返回当前用户可访问的项目 | `getProjects` 与权限策略 | 新增项目读取入口必须复用统一授权语义 |

## 创建流程

选中 Workspace 后，两个侧边栏分区复用 `CreateProjectDialog`。入口自动提供 `workspaceId` 和 `kind`，用户只输入名称。创建项目和权限总览均使用共享 `ModalDialog`；只有调用方显式配置关闭策略时，遮罩与 Escape 才能关闭弹窗，创建请求进行中会临时禁用关闭，避免中断状态反馈。

服务端 `createProject` 必须：

1. 使用 Clerk 获取当前 `userId`。
2. 使用 `createProjectSchema` 校验 Workspace、名称和类型。
3. 验证当前用户具有目标 Workspace 的 `project.create` 能力；viewer 不得创建项目。
4. 在同一事务中写入 `projects`。
5. 在同一事务中写入 owner 的 `project_members` 记录。
6. 返回界面需要的项目字段，不返回不必要的身份字段。

事务保证成员写入失败时不会留下无成员项目。

## 查询流程

`getProjects` 只在服务端使用，先限定当前 Workspace 成员，再通过权限策略过滤：

```text
projects
INNER JOIN workspace_members 当前 Workspace 成员
LEFT JOIN project_members 当前项目直接成员
→ Personal 只接受直接权限
→ Collaboration 合并 Workspace 与项目直接权限
```

可选的 `kind` 过滤只负责个人/协作分类。结果按创建时间倒序返回。

## 前端状态

- Workspace Layout 先从服务端 HttpOnly cookie 和 `workspace_members` 解析当前 Workspace，再读取该 Workspace 下的项目与文档导航。cookie 中的 ID 不直接作为授权依据；已不可访问时回退到用户可访问的第一个 Workspace。
- 左上角切换器列出用户可访问的真实 Workspace。切换成功后写入 cookie 并刷新当前布局；没有 Workspace 时可通过共享创建弹窗建立第一个 Workspace。
- 项目初始列表由 Workspace Layout 按当前 Workspace 查询并传给侧边栏。
- 项目查询同时返回当前成员角色，供侧边栏决定是否显示文档创建入口；Server Action 仍会独立执行资源授权，客户端角色只用于界面呈现。
- Workspace Layout 通过独立查询读取文档导航元数据，并在当前项目节点下展示文档。
- 个人区域、协作区域和每个项目节点都可独立折叠；只有项目和文件节点提供资源右键菜单，区域标题不承载资源管理操作。
- 创建成功后使用 `router.refresh()` 获取服务器最新结果。
- 当前没有额外的 TanStack Query 或全局项目缓存。
- 当前项目链接把 ID 写入个人或协作页面的 `project` 查询参数。页面会按成员关系读取项目文档；`document` 查询参数进一步选择当前文档。

## 角色与能力

- Workspace owner 可查看、修改、删除 Workspace 并创建项目；editor 可查看和创建项目；viewer 只读。
- Project owner 可查看、修改、删除项目并管理文件；editor 可修改项目并管理文件；viewer 只读。
- Workspace 角色只向 Collaboration 项目继承。Workspace owner 的继承管理能力不改变 `projects.owner_id`。
- 文件读取、创建、修改和删除完全继承项目能力。
- 权限映射与继承由 `src/features/permissions/PermissionPolicy.ts` 执行；服务端授权查询返回能力和授权来源。

## 权限总览

设置菜单中的“工作区管理”以及右键菜单中的“管理项目”“管理文件”提供资源基本信息、删除操作和成员权限总览：

- 工作区管理：服务端先验证当前用户是工作区成员，再返回该工作区的全部 `workspace_members`；它不代表项目权限继承。
- Workspace owner 可通过 Resend 按邮箱发送本地 Workspace 邀请并指定 `editor` 或 `viewer`。接受邀请时必须登录 Clerk，并使用与邀请邮箱匹配的已验证邮箱。
- Workspace owner 可修改普通成员角色或移除成员；owner 不可修改或移除。成员仍拥有 Personal 项目时拒绝移除，成功移除会同时清理其项目直接成员关系。
- Project owner 可从所属 Workspace 的现有成员中添加、修改或移除直接成员；项目 owner 不可修改或移除。
- 管理项目：服务端验证 `project.read`，返回项目直接权限；Collaboration 项目同时显示 Workspace 继承权限。
- 管理文件：服务端验证 `document.read`，显示所属项目的直接与继承权限，并明确文件没有独立 ACL。
- 成员身份由服务端通过 Clerk 用户目录解析为姓名和主邮箱；无法解析时回退到 Clerk `userId`。
- 返回结果标记当前登录用户，客户端在权限列表中高亮“你”。

项目权限弹窗以项目名称作为可点击标题；文件权限弹窗以“项目名称 \ 文件名称”作为可点击路径。有更新能力时弹窗允许修改名称；有删除能力时显示删除操作并二次确认。删除 Workspace 或项目会提示其数据库级联影响。工作区总览显示当前工作区名称和工作区成员，项目和文件总览区分项目直接权限与 Workspace 继承权限。

权限总览入口不替代服务端资源授权。客户端传入的工作区 ID、项目 ID 或文件 ID 都只用于定位候选资源。

## 相关代码

- `src/features/projects/Project.ts`
- `src/features/projects/CreateProjectSchema.ts`
- `src/features/projects/components/CreateProjectDialog.tsx`
- `src/features/projects/server/CreateProject.ts`
- `src/features/projects/server/UpdateProject.ts`
- `src/features/projects/server/DeleteProject.ts`
- `src/features/projects/server/CreateProject.test.ts`
- `src/features/projects/server/GetProjects.ts`
- `src/features/projects/server/GetProjects.test.ts`
- `src/features/projects/PermissionOverview.ts`
- `src/features/projects/components/PermissionOverviewDialog.tsx`
- `src/features/projects/server/GetPermissionOverview.ts`
- `src/features/projects/server/GetPermissionOverview.test.ts`
- `src/models/Schema.ts`
- `src/components/layout/AppSidebar/SidebarNavigationContextMenus.tsx`
- `src/components/layout/AppSidebar/SidebarWorkspaceNavigation.tsx`
- `src/components/layout/AppSidebar/SidebarWorkspaceNavigationTypes.ts`
- `src/components/ui/ContextMenu.tsx`
- `src/components/ui/ModalDialog.tsx`
- `src/components/ui/PopupMenu.tsx`
- `src/features/workspaces/Workspace.ts`
- `src/features/workspaces/components/CreateWorkspaceDialog.tsx`
- `src/features/workspaces/server/GetWorkspaceContext.ts`
- `src/features/workspaces/server/CreateWorkspace.ts`
- `src/features/workspaces/server/SelectWorkspace.ts`
- `src/features/workspaces/server/UpdateWorkspace.ts`
- `src/features/workspaces/server/DeleteWorkspace.ts`
- `src/features/permissions/`

## 相关文档

- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库与迁移](../database/schema-and-migrations.md)
- [文档业务](documents.md)
- [ADR 0003：引入 Workspace 资源边界](../adr/0003-introduce-workspace-resource-boundary.md)
- [ADR 0004：使用能力授权并继承协作项目权限](../adr/0004-use-capability-authorization-and-collaboration-inheritance.md)
