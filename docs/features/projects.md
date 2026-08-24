# 项目业务

状态：Current

本文描述个人空间与团队 Workspace 中项目的归属、权限边界和主要流程。

## 领域模型

`Workspace` 是项目的唯一顶层资源边界，并通过 `kind` 决定其中所有项目的模式：

- `personal`：每个有效 Better Auth 用户拥有一个，只承载个人项目；账户删除时随用户业务数据一起清理。
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

- Better Auth 用户创建 hook 调用 `ensureUserWorkspace` 创建 Personal Workspace，Session 创建 hook 在缺失时补偿；数据库部分唯一索引和事务使重复执行保持幂等，并保证同一 owner 最多一个。
- Personal Workspace 不支持邀请成员或管理项目成员，owner 可以修改名称、创建项目；Personal Workspace 是永久个人空间，不可主动删除或退出，仅在用户注销账号时随业务数据一同清理。
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
- Workspace 和 Project 主动退出与所有权转让已经实现。所有权只能由当前 owner 转让给同工作区内的成员，转让后原 owner 自动变更为 editor。

## 统一删除与退出

Workspace 和 Project 使用同一套 owner/member 规则，不区分 Personal 或 Collaboration 区域：

- 当前用户是资源 owner 时，操作显示为“删除”，直接删除资源并由数据库级联清理下级内容和全部关系。
- 当前用户是资源 member 时，操作显示为“退出”，资源保持存在，只清理当前用户的成员、申请和邀请关系。
- member 退出 Workspace 时，先对该 Workspace 中自己直接参与的 Project 应用同一规则：自己拥有的 Project 删除，其他人的 Project 只退出；随后再移除 Workspace 成员关系。

Project 的删除或退出入口位于侧边栏 Project 右键打开的权限弹窗；Workspace 的删除或退出入口位于“设置 → 工作区管理”。服务端分别由 `deleteOrLeaveProject` 和 `deleteOrLeaveWorkspace` 通过 `requireUser()` 重新读取身份和资源访问关系，不信任客户端传入的 owner/member 状态。

## 所有权转让

- Team Workspace 和 Team Project 支持所有权转让，Personal 空间及其项目不可转让。
- 仅当前唯一 owner 可以发起转让；转让目标必须是所属 Workspace 的有效成员且不能是当前 owner 本身。
- Workspace 转让在事务中将原 owner 角色降为 `editor`、目标成员角色提升为 `owner` 并更新 `workspaces.owner_id`。
- Project 转让在事务中将原 owner 角色降为 `editor`、目标成员设为 `owner`（若尚未加入项目则自动插入成员记录）并更新 `projects.owner_id`。
- 转让、成员角色修改和成员移除先锁定同一条 Workspace 或 Project 主记录，并在锁内重新核对 owner；所有权已变化的旧请求会失败并要求刷新，避免等待并发事务后继续使用过期授权。
- 转让在事务内自动清理目标用户的待处理申请和邀请，并通过站内通知告知新 owner。

## 安全与操作审计体系

- Team Workspace 支持全局操作审计日志，记录成员进出、角色变更、所有权转让、资源重命名与删除等关键事件。
- 审计日志严格对 **Workspace Owner** 开放（路由 `/settings/audit-logs`）；非 Owner 用户在侧边栏和设置菜单中不展示入口，直接访问页面或接口会被服务端拦截（403 权限拒绝）。
- 审计日志在业务 Server Action 事务内同步写入 `audit_logs` 表，记录操作者 ID、事件类型、目标资源类型与 ID、结构化详情 metadata、请求 IP 及客户端环境。
- 审计日志归属于 Team Workspace，当 Workspace 被删除或账户注销时随外键级联清理，因此它是产品内操作历史，不作为独立于 Workspace 生命周期的合规留存介质。


## 账户删除过渡策略

KnowMesh 账户删除 Action 在验证当前密码后调用 `deleteUserData`，并在同一个数据库事务中删除 Better Auth 身份。该流程复用统一删除与退出规则遍历用户的 Workspace 成员关系：删除该用户拥有的 Personal/Team Workspace；对于其他人的 Workspace，先删除其中由该用户拥有的 Project、退出其他直接参与的 Project，再退出 Workspace。数据库级联删除自有资源的 Document 和协作状态。

共享 Project 中由该用户创建、但不由该用户拥有的 Document 继续保留，并把 `created_by_id` 匿名化为 `deleted_user`。该策略可能删除其他成员参与的 Team Workspace 或 Project，是明确记录的过渡行为。

## 创建与读取

侧边栏仍使用 Personal/Collaboration 作为纯界面区域标识，不把区域写入 Project：

- Personal 创建入口把当前用户的 Personal Workspace ID 交给 Server Action。
- Collaboration 创建入口只在活动 Workspace 为 `team` 且具有 `project.create` 时显示。
- `createProject` 从 Better Auth Session 获取身份、验证目标 Workspace 能力，并在事务内锁定和重新校验 owner 的 Workspace 成员关系后写入项目与 owner 成员关系。
- `getWorkspaceNavigation` 向 Workspace 成员返回目标 Workspace 的项目和文档导航元数据；导航元数据不包含正文、正文层级、摘要或预览。
- Workspace Layout 合并 Personal Workspace 与可选活动 Team Workspace 的项目和文档导航。
- `/personal` 只接受 Personal Workspace 中的项目；`/collaboration` 只接受当前活动 Team Workspace 中的项目。
- 页面读取对当前身份不可见或不属于目标区域的项目时统一渲染不可索引的 Not Found 结果，不把资源授权异常暴露为应用错误；Next.js 流式响应可能保留 HTTP 200。

客户端传入的 Workspace、Project、Document ID 和能力只用于定位候选资源；Server Action 必须通过 `requireUser()` 重新读取身份和资源关系执行授权。

## 权限总览

- Personal Workspace 只显示 owner，不提供邀请和成员管理。
- Personal 项目只显示 owner，不提供项目成员管理或 Workspace 继承组。
- Team Workspace 支持 Resend 邮箱邀请、待接受邀请查看与撤回、成员角色修改、所有权转让和移除；邮件负责静态通知和导航，受保护的接受页负责实时状态校验和用户确认，两者共享展示数据但不共享运行时 UI。
- Workspace 邀请生成七天有效的一次性原始令牌，数据库只保存其哈希。应用先在同一事务写邀请与审计记录，再调用 Resend；发送失败时会在补偿事务中撤销邀请并追加自动撤销审计，然后向调用方返回失败。对已注册收件人的站内通知仅在邮件发送成功且邀请仍有效后写入，避免撤销邀请仍产生误导 Toast。数据库和邮件服务不共享事务，因此该补偿不能被视为跨服务原子提交。
- Team 项目只显示项目直接成员；Workspace 成员作为邀请候选人而不是项目权限成员。
- Workspace 和 Project 邀请接受后默认加入为 viewer。Workspace viewer 可申请 editor；非项目成员可申请 viewer；Project viewer 可申请 editor。项目受邀人可选择接受或主动拒绝邀请。
- 管理员可批准或拒绝权限申请，亦可在成员列表中直接调整成员的角色（editor 与 viewer）或由 owner 转让所有权；申请被拒绝、审批通过、成员角色变更或移出成员均会在业务事务内为相关成员写入站内通知。
- 邀请接受、权限申请提交、审批通过与申请未通过会在业务事务内写入用户级站内通知；邀请发出通知在邮件成功后单独写入。通知历史不随 Workspace 切换。
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

复合外键和事务结束时执行的延迟约束触发器共同保护成员及 owner 不变量。创建流程使用事务依次写入资源与 owner 成员；所有权转让在同一事务更新 `owner_id`、原 owner 角色和新 owner 角色，严格保证事务提交时满足延迟约束触发器。项目创建和成员移除还会锁定同一条 Workspace 成员关系，防止并发流程越过所有权检查。

## 相关代码

- `src/models/Schema.ts`
- `src/features/workspaces/Workspace.ts`
- `src/features/workspaces/server/EnsureUserWorkspace.ts`
- `src/features/workspaces/server/GetWorkspaceContext.ts`
- `src/features/projects/Project.ts`
- `src/features/projects/server/CreateProject.ts`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- `src/features/users/server/DeleteUserData.ts`
- `src/features/auth/server/DeleteAccount.ts`
- `src/features/projects/server/GetPermissionOverview.ts`
- `src/features/permissions/PermissionPolicy.ts`
- `src/features/permissions/server/ProjectAuthorization.ts`
- `src/features/notifications/server/CreateNotification.ts`
- `src/components/layout/AppSidebar/SidebarWorkspaceNavigation.tsx`

## 相关决策

- [ADR 0006：分离 Workspace 结构发现与 Project 内容访问](../adr/0006-separate-workspace-discovery-from-project-content-access.md)
- [数据库与迁移](../database/schema-and-migrations.md)
- [文档业务](documents.md)
- [ADR 0008：统一按 owner 删除资源、按 member 退出资源](../adr/0008-delete-owned-resources-on-account-removal.md)
