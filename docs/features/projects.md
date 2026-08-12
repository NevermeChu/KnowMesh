# 项目业务

状态：Current

本文描述永久个人空间与团队 Workspace 中项目的归属、权限边界和主要流程。

## 领域模型

`Workspace` 是项目的唯一顶层资源边界，并通过 `kind` 决定其中所有项目的模式：

- `personal`：每个用户永久拥有一个，只承载个人项目。
- `team`：可创建、加入和删除的团队工作区，其中项目参与协作。

`projects` 不再保存 `kind`。项目通过非空 `workspace_id` 唯一归属 Workspace，个人或协作语义必须从 `workspaces.kind` 推导。文件完全继承所属项目能力，没有独立 ACL。

```text
User
├─ Personal Workspace
│  └─ Projects → Documents
└─ Team Workspaces
   └─ Projects → Documents
```

## 个人空间

- `ensureUserWorkspace` 保证当前用户拥有一个 Personal Workspace；数据库部分唯一索引保证同一 owner 最多一个。
- Personal Workspace 不可删除、退出、邀请成员或管理项目成员，但 owner 可以修改名称和创建项目。
- Personal 项目只允许项目 owner 访问，不继承 Workspace 成员能力，也不授予 `project.members.manage`。
- Personal 区域始终读取当前用户的 Personal Workspace，与活动 Team Workspace 无关。
- 选择 Personal Workspace 时不显示协作区域；选择 Team Workspace 时同时显示个人项目和当前团队项目。

## 团队工作区

- 用户主动创建的 Workspace 一律为 `team`。
- Team Workspace owner 可管理 Workspace 和成员；editor 可创建项目；viewer 只读。
- Team 项目合并项目直接成员与 Workspace 继承权限。
- 项目直接成员必须先属于对应 Team Workspace。
- Workspace 成员仍拥有任意项目时不得被移除，防止 `projects.owner_id` 指向已离开的成员。
- 主动退出和所有权转让尚未实现。

## 创建与读取

侧边栏仍使用 Personal/Collaboration 作为纯界面区域标识，不把区域写入 Project：

- Personal 创建入口把当前用户的 Personal Workspace ID 交给 Server Action。
- Collaboration 创建入口只在活动 Workspace 为 `team` 且具有 `project.create` 时显示。
- `createProject` 从 Clerk 获取身份、验证目标 Workspace 能力，并在同一事务中写入项目和 owner 成员关系。
- `getWorkspaceNavigation` 按目标 Workspace 查询项目、计算权限，再使用可访问项目 ID 读取文档导航，避免重复认证与权限连接。
- Workspace Layout 合并 Personal Workspace 与可选活动 Team Workspace 的项目和文档导航。
- `/personal` 只接受 Personal Workspace 中的项目；`/collaboration` 只接受当前活动 Team Workspace 中的项目。

客户端传入的 Workspace、Project、Document ID 和能力只用于定位候选资源；Server Action 必须重新读取 Clerk 身份和资源关系执行授权。

## 权限总览

- Personal Workspace 只显示 owner，不提供邀请和成员管理。
- Personal 项目只显示 owner，不提供项目成员管理或 Workspace 继承组。
- Team Workspace 支持 Resend 邮箱邀请、成员角色修改和移除。
- Team 项目显示项目直接权限与 Workspace 继承权限，并可从现有 Workspace 成员中添加直接成员。
- 文件权限总览继续展示所属项目的授权来源，不增加文档级 ACL。

## 数据不变量

| 规则 | 执行位置 |
| --- | --- |
| 每个项目必须属于一个 Workspace | `projects.workspace_id` 非空外键 |
| 每个 owner 最多一个 Personal Workspace | `workspaces_personal_owner_idx` 部分唯一索引 |
| Workspace owner 同时是 owner 成员 | 创建和初始化事务 |
| Project owner 同时是 owner 成员 | 创建和迁移事务 |
| Personal Workspace 不参与成员协作 | Workspace 和 Project 成员 Server Action |
| Personal 项目只由 owner 访问 | `PermissionPolicy` 和资源授权查询 |
| Team 项目继承 Workspace 能力 | `PermissionPolicy` |
| 删除 Workspace/Project 级联下级资源 | 数据库外键 |

跨表 owner 不变量无法由普通外键完整表达，所有权转让和成员移除必须使用事务并具有集成测试。

## 相关代码

- `src/models/Schema.ts`
- `src/features/workspaces/Workspace.ts`
- `src/features/workspaces/server/EnsureUserWorkspace.ts`
- `src/features/workspaces/server/GetWorkspaceContext.ts`
- `src/features/projects/Project.ts`
- `src/features/projects/server/CreateProject.ts`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- `src/features/projects/server/GetPermissionOverview.ts`
- `src/features/permissions/PermissionPolicy.ts`
- `src/features/permissions/server/ProjectAuthorization.ts`
- `src/components/layout/AppSidebar/SidebarWorkspaceNavigation.tsx`

## 相关决策

- [ADR 0005：使用 Workspace 类型作为项目权限模式](../adr/0005-use-workspace-kind-as-project-mode.md)
- [数据库与迁移](../database/schema-and-migrations.md)
- [文档业务](documents.md)
