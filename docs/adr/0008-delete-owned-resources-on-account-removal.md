# ADR 0008：统一按 owner 删除资源、按 member 退出资源

- 状态：Accepted
- 日期：2026-08-14

## 背景

Clerk `UserProfile` 允许用户终止账户，并在身份删除后产生 `user.deleted` Webhook。KnowMesh 不保存本地用户镜像，但业务表直接保存 Clerk user ID；仅删除 Clerk 身份会留下无法再登录的 owner、成员关系、权限申请和创建者标识。

当前尚未实现 Workspace 或 Project 所有权转让。普通资源操作和账户删除都无法把自有资源交给其他成员，需要一套一致的过渡策略保证数据库 owner 不变量和用户生命周期能够闭合。

## 决策

- Workspace 和 Project 统一采用 owner 删除、member 退出的规则，不区分 Personal 或 Collaboration 区域。
- Project 操作入口位于右键权限弹窗，Workspace 操作入口位于“设置 → 工作区管理”；界面按当前角色显示“删除”或“退出”，按钮不携带图标。
- owner 删除资源时，外键级联删除全部下级内容和关系；member 退出时，只清理自己的成员、申请和邀请关系。
- member 退出 Workspace 时，对其直接参与的下级 Project 递归应用同一规则，再删除 Workspace 成员关系。
- `/api/webhooks/clerk` 在验证签名后处理 `user.deleted`，通过 `deleteUserData` 在单个数据库事务中复用该规则清理业务数据；失败返回 `5xx` 让 Clerk 重试。
- 删除用户拥有的全部 Workspace，包括 Personal Workspace 和 Team Workspace；现有外键级联删除其中的 Project、Document、成员、邀请和权限申请。
- 对用户不拥有的 Workspace，删除其中由该用户拥有的 Project，退出其他直接参与的 Project，最后退出 Workspace。
- 其他人 Project 中由该用户创建的 Document 继续保留，`created_by_id` 改为固定的 `deleted_user` 标识，不保留已删除的 Clerk user ID。
- 清理操作必须幂等，允许同一个 `user.deleted` 事件重复投递。

## 过渡性质

这是所有权转让能力上线前的过渡方案。owner 删除 Team Workspace 或 Team Project 会同时删除其他成员在其中的共享内容；当前接受这一后果，不把资源静默转给任意成员。

未来实现所有权转让、删除前业务预检或软删除后，应新增 ADR 替代本决策，不直接改写本记录。

## 后果

- Clerk 账户删除后，KnowMesh 不再保留可用于授权或成员展示的悬空 Clerk user ID。
- 用户拥有的协作资源会随账户一起永久删除，其他成员会失去对应内容。
- Webhook 是异步边界；Clerk 身份删除与 KnowMesh 数据清理之间可能短暂存在延迟。失败投递必须通过 Clerk Webhook 监控和重试处理。
- 仅以邮箱存在、尚未被接受的 Workspace 邀请无法从 `user.deleted` 载荷关联到 Clerk user ID，不属于本次用户 ID 清理范围。

## 备选方案

### 阻止仍拥有协作资源的用户删除账户

未采用。当前使用 Clerk 托管账户页面，且尚未实现所有权转让和 KnowMesh 自定义注销前置流程。

### 自动选择其他成员成为 owner

未采用。系统没有可靠、明确的继任者选择规则，自动转让可能授予非预期权限。

### 保留全部业务数据并仅删除成员关系

未采用。自有资源将失去满足数据库约束的 owner，也会留下不可操作的数据。

## 相关代码和文档

- `src/app/api/webhooks/clerk/route.ts`
- `src/features/users/server/DeleteUserData.ts`
- `src/features/permissions/server/ResourceRemoval.ts`
- `src/models/Schema.ts`
- [项目业务](../features/projects.md)
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库 Schema 与迁移](../database/schema-and-migrations.md)
