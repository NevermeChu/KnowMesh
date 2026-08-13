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

- Clerk `user.created` Webhook 在注册完成后调用 `ensureUserWorkspace` 创建 Personal Workspace；数据库部分唯一索引和事务使重复投递保持幂等，并保证同一 owner 最多一个。
- Personal Workspace 不可删除、退出、邀请成员或管理项目成员，但 owner 可以修改名称和创建项目。
- Personal 项目只允许项目 owner 访问，不继承 Workspace 成员能力，也不授予 `project.members.manage`。
- Personal 区域始终读取当前用户的 Personal Workspace，与活动 Team Workspace 无关。
- 选择 Personal Workspace 时不显示协作区域；选择 Team Workspace 时同时显示个人项目和当前团队项目。

## 团队工作区

- 用户主动创建的 Workspace 一律为 `team`。
- Team Workspace owner 可管理 Workspace 和成员；editor 可创建项目；viewer 只读。
- Team Workspace 成员都可以发现其中的项目和文件导航结构，但只有项目直接成员可以读取文档正文。
- Team 项目的内容权限只由 `project_members.role` 决定，不与 Workspace 角色合并；Workspace owner 也不能绕过该边界。
- 项目直接成员必须先属于对应 Team Workspace。
- Workspace 成员仍拥有任意项目时不得被移除，防止 `projects.owner_id` 指向已离开的成员。
- 主动退出和所有权转让尚未实现。

## 创建与读取

侧边栏仍使用 Personal/Collaboration 作为纯界面区域标识，不把区域写入 Project：

- Personal 创建入口把当前用户的 Personal Workspace ID 交给 Server Action。
- Collaboration 创建入口只在活动 Workspace 为 `team` 且具有 `project.create` 时显示。
- `createProject` 从 Clerk 获取身份、验证目标 Workspace 能力，并在事务内锁定和重新校验 owner 的 Workspace 成员关系后写入项目与 owner 成员关系。
- `getWorkspaceNavigation` 向 Workspace 成员返回目标 Workspace 的项目和文档导航元数据；导航元数据不包含正文、正文层级、摘要或预览。
- Workspace Layout 合并 Personal Workspace 与可选活动 Team Workspace 的项目和文档导航。
- `/personal` 只接受 Personal Workspace 中的项目；`/collaboration` 只接受当前活动 Team Workspace 中的项目。

客户端传入的 Workspace、Project、Document ID 和能力只用于定位候选资源；Server Action 必须重新读取 Clerk 身份和资源关系执行授权。

## 权限总览

- Personal Workspace 只显示 owner，不提供邀请和成员管理。
- Personal 项目只显示 owner，不提供项目成员管理或 Workspace 继承组。
- Team Workspace 支持 Resend 邮箱邀请、成员角色修改和移除。
- Team 项目只显示项目直接成员；Workspace 成员作为邀请候选人而不是项目权限成员。
- Workspace 和 Project 邀请接受后默认加入为 viewer。Workspace viewer 可申请 editor；非项目成员可申请 viewer；Project viewer 可申请 editor。
- 文件权限总览继续展示所属项目的授权来源，不增加文档级 ACL。

## 数据不变量

| 规则 | 执行位置 |
| --- | --- |
| 每个项目必须属于一个 Workspace | `projects.workspace_id` 非空外键 |
| 每个 owner 最多一个 Personal Workspace | `workspaces_personal_owner_idx` 部分唯一索引 |
| Workspace owner 同时是唯一 owner 成员 | 部分唯一索引和延迟约束触发器 |
| Project owner 属于项目的 Workspace | `projects_workspace_owner_member_fk` 复合外键 |
| Project 成员必须是同一 Workspace 成员 | `project_members_workspace_member_fk` 复合外键 |
| Project 成员必须关联项目所属 Workspace | `project_members_project_workspace_fk` 复合外键 |
| Project owner 同时是唯一 owner 项目成员 | 部分唯一索引和延迟约束触发器 |
| Personal Workspace 不参与成员协作 | Workspace 和 Project 成员 Server Action |
| Personal 项目只由 owner 访问 | `PermissionPolicy` 和资源授权查询 |
| Workspace 成员可见 Team 项目的导航结构 | `getWorkspaceNavigation` 和 `project.structure.read` |
| Team 项目正文只允许项目直接成员 | `PermissionPolicy`、`getProjectAuthorization` 和正文查询 |
| 删除 Workspace/Project 级联下级资源 | 数据库外键 |

复合外键和事务结束时执行的延迟约束触发器共同保护成员及 owner 不变量。创建流程仍使用事务依次写入资源与 owner 成员；未来所有权转让必须在同一事务更新 `owner_id`、原 owner 角色和新 owner 角色，否则提交会被数据库拒绝。项目创建和成员移除还会锁定同一条 Workspace 成员关系，防止并发流程越过所有权检查。

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

- [ADR 0006：分离 Workspace 结构发现与 Project 内容访问](../adr/0006-separate-workspace-discovery-from-project-content-access.md)
- [数据库与迁移](../database/schema-and-migrations.md)
- [文档业务](documents.md)
