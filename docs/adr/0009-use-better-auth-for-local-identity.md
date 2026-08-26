# ADR 0009：使用 Better Auth 管理本地身份

- 状态：Accepted
- 日期：2026-08-18
- 替代：[ADR 0007](0007-provision-personal-workspace-from-clerk-webhook.md)

## 背景

KnowMesh 原先由 Clerk 托管用户、会话和账户生命周期，并通过异步 Webhook 创建 Personal Workspace、清理删除账户后的业务数据。该边界要求外部用户目录、Webhook 配置和开发环境公网回调，也使成员展示需要访问外部服务。

本次迁移允许重建明确指定的数据库，不迁移现有 Clerk 用户、密码、会话或用户 ID。Workspace、Project、成员、邀请和能力授权仍由 KnowMesh 业务模型负责。

## 决策

- 使用 Better Auth 的邮箱密码认证、Session、邮箱验证和密码重置能力，并通过现有 Drizzle/PostgreSQL 连接持久化 `user`、`session`、`account` 和 `verification` 表。
- Better Auth `user` 表是用户身份资料的权威来源。每个账户只使用一个登录邮箱；Workspace 邀请只接受规范化后匹配且已经验证的当前邮箱。
- 业务代码通过内部 `getCurrentUser()` 和 `requireUser()` 边界读取服务端会话，不直接散布 Better Auth API 调用，也不信任客户端传入的用户 ID。
- 用户创建 hook 同步调用幂等的 `ensureUserWorkspace`。若底层认证写入与业务写入不能共享事务，则登录后的专用初始化路径只在 Personal Workspace 缺失时补偿；普通 Workspace 查询保持只读。
- 账户删除必须从 KnowMesh 设置页发起。删除 Better Auth 用户前同步调用 `deleteUserData`；业务清理失败时阻止身份删除。
- 不采用 Better Auth Organization 插件。Workspace 和 Project 权限模型仍是唯一业务授权来源。

ADR 0008 中“owner 删除、member 退出”、保留文档时匿名化创建者及同步业务清理的规则继续有效；其中 Clerk `UserProfile` 和 `user.deleted` Webhook 作为触发边界的部分由本 ADR 替代。

## 原因

- 本地身份表允许成员和邀请界面批量读取姓名、邮箱和头像，不再依赖外部用户目录。
- 同步生命周期边界可以在业务清理失败时阻止账户删除，也不需要依赖异步 Webhook 的最终一致性。
- 认证与业务授权分离，避免把 Workspace 规则复制到认证插件中。

## 后果

- 需要维护认证表、迁移、密钥、邮件发送和安全更新，并为登录、注册、验证、重置密码及账户删除提供自有界面。
- 现有 Clerk 用户和会话在切换时失效；旧 Clerk 应用版本不能连接重建后的 Better Auth 数据库提供正常登录。
- 数据库重建是单独的破坏性运维步骤，执行前必须再次核对目标地址和备份要求。

## 备选方案

### 继续使用 Clerk

未采用。它不能消除外部用户目录、Webhook 和开发环境公网回调依赖。

### 使用 Better Auth Organization 插件

未采用。现有 Workspace、Project 和能力授权已经表达产品规则，引入第二套组织模型会产生重复真相源。

### 双写并迁移 Clerk 用户

未采用。本次明确允许重建数据库，没有保留历史身份的需求；双写会扩大迁移与回滚复杂度。

## 相关代码和文档

- `src/libs/Auth.ts`
- `src/libs/AuthCore.ts`
- `src/libs/AuthClient.ts`
- `src/models/Schema.ts`
- `src/features/workspaces/server/EnsureUserWorkspace.ts`
- `src/features/auth/server/DeleteAccount.ts`
- `src/features/users/server/DeleteUserData.ts`
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库 Schema 与迁移](../database/schema-and-migrations.md)
- [Better Auth 替换 Clerk 实施计划](../Better-Auth替换Clerk实施计划.md)
