# 项目业务

状态：Current

本文描述个人项目和协作项目共用的业务模型、权限不变量和主要创建/查询流程。

## 领域模型

`Project` 是统一业务实体，通过 `kind` 分类：

- `personal`：个人项目。
- `collaboration`：协作项目。

两类项目使用同一张 `projects` 表、同一套创建逻辑和同一套成员查询。`kind` 当前用于创建输入、数据库分类、侧边栏分组和分区权限总览；代码中没有其他按类型分支的业务行为。个人工作区和协作区不是持久化实体，没有独立成员表或 ACL。

## 成员与所有权不变量

以下规则由当前 Schema、迁移或创建/查询路径直接体现，执行层不同：

- 每个项目必须有一个 `projects.owner_id`。
- owner 必须同时存在于 `project_members`，角色为 `owner`。
- 当前唯一的成员写入路径只为新项目创建一个 owner 成员，不区分个人或协作项目。
- Schema 定义了 `editor` 和 `viewer` 枚举值，但当前没有代码写入这两个角色，也没有基于角色的授权逻辑。
- 可访问项目列表通过 `project_members.user_id` 查询，不使用“个人查 owner、协作查成员”的分支逻辑。
- `(project_id, user_id)` 必须唯一。
- 删除项目必须级联删除成员关系。

### 不变量执行位置

| 规则 | 当前执行位置 | 维护要求 |
| --- | --- | --- |
| `projects.owner_id` 非空 | 数据库 `NOT NULL` | 所有项目写入都必须提供服务端身份 |
| `(project_id, user_id)` 唯一 | 数据库联合主键 | 不得创建重复成员关系 |
| 删除项目级联删除成员 | 数据库外键 | 删除流程不得绕过数据库约束 |
| owner 同时是 `owner` 成员 | `createProject` 事务和成员迁移回填 | 数据库没有跨表约束，无法阻止其他直接数据库写入造成不一致 |
| 新项目当前只有 owner 成员 | `createProject` 是唯一成员写入路径 | 这是当前写入结果，不是数据库约束；Schema 允许 `editor`、`viewer` |
| 仅返回当前用户可访问的项目 | `getProjects` 成员连接查询 | 新增项目读取入口必须复用或等价实现成员过滤 |

## 创建流程

两个侧边栏分区复用 `CreateProjectDialog`。入口自动提供 `kind`，用户只输入名称。创建项目和权限总览均使用共享 `ModalDialog`；只有调用方显式配置关闭策略时，遮罩与 Escape 才能关闭弹窗，创建请求进行中会临时禁用关闭，避免中断状态反馈。

服务端 `createProject` 必须：

1. 使用 Clerk 获取当前 `userId`。
2. 使用 `createProjectSchema` 校验名称和类型。
3. 在同一事务中写入 `projects`。
4. 在同一事务中写入 owner 的 `project_members` 记录。
5. 返回界面需要的项目字段，不返回不必要的身份字段。

事务保证成员写入失败时不会留下无成员项目。

## 查询流程

`getProjects` 只在服务端使用，并通过成员表限制当前用户：

```text
projects
INNER JOIN project_members
  ON project_members.project_id = projects.id
WHERE project_members.user_id = 当前 Clerk 用户
```

可选的 `kind` 过滤只负责个人/协作分类。结果按创建时间倒序返回。

## 前端状态

- 项目初始列表由 Workspace Layout 查询并传给侧边栏。
- 项目查询同时返回当前成员角色，供侧边栏决定是否显示文档创建入口；Server Action 仍会独立执行资源授权，客户端角色只用于界面呈现。
- Workspace Layout 通过独立查询读取文档导航元数据，并在当前项目节点下展示文档。
- 工作区分区和每个项目节点都可独立折叠；右键工作区、项目和文件节点会打开共享菜单，而不会触发这些节点上的浏览器默认右键菜单。
- 创建成功后使用 `router.refresh()` 获取服务器最新结果。
- 当前没有额外的 TanStack Query 或全局项目缓存。
- 当前项目链接把 ID 写入个人或协作页面的 `project` 查询参数。页面会按成员关系读取项目文档；`document` 查询参数进一步选择当前文档。

## 角色与权限现状

- `owner`、`editor`、`viewer` 目前只是 Schema 和 TypeScript 中的允许值。
- 当前代码只写入 `owner`；没有成员邀请、角色变更或所有权转移写入入口。
- `getProjects` 只验证当前用户存在成员记录，不检查成员角色。
- 当前代码没有定义或执行 owner、editor、viewer 的权限矩阵。
- 文档功能已执行最小角色权限：所有成员可读，只有 `owner` 和 `editor` 可创建及编辑。项目管理仍没有完整权限矩阵。

## 权限总览

右键菜单中的“管理工作区”“管理项目”和“管理文件”当前都是只读权限总览，不提供成员或角色修改：

- 管理项目：服务端先验证当前用户是项目成员，再返回该项目的全部 `project_members`。
- 管理文件：服务端先验证文件访问权，再显示所属项目的全部成员，并明确文件没有独立 ACL。
- 管理工作区：按当前用户可访问的项目分组展示成员；由于工作区只是 `kind` 分区，不把聚合结果描述为工作区级权限。
- 成员身份由服务端通过 Clerk 用户目录解析为姓名和主邮箱；无法解析时回退到 Clerk `userId`。
- 返回结果标记当前登录用户，客户端在权限列表中高亮“你”。

项目权限弹窗以项目名称作为可点击标题；文件权限弹窗以“项目名称 \ 文件名称”作为可点击路径。点击项目名称可从文件权限切换到所属项目权限，点击当前已经打开的项目或文件不会重复调用权限查询。项目和文件弹窗底部显示“申请权限”和对应的“退出项目”或“退出文件”操作入口，退出操作会先显示二次确认窗口，但当前尚未接入对应请求。工作区总览继续保留各项目分组标题，项目和文件总览不再在成员列表前重复显示项目名称。

权限总览入口不替代服务端资源授权。客户端传入的工作区类型、项目 ID 或文件 ID 都只用于定位候选资源。

## 相关代码

- `src/features/projects/Project.ts`
- `src/features/projects/CreateProjectSchema.ts`
- `src/features/projects/CreateProjectSchema.test.ts`
- `src/features/projects/components/CreateProjectDialog.tsx`
- `src/features/projects/server/CreateProject.ts`
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

## 相关文档

- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库与迁移](../database/schema-and-migrations.md)
- [文档业务](documents.md)
