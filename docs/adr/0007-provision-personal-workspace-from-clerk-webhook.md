# ADR 0007：通过 Clerk 注册 Webhook 创建 Personal Workspace

- 状态：Accepted
- 日期：2026-08-13

## 背景

Personal Workspace 原本由 `getWorkspaceContext` 在用户第一次打开工作台时懒创建。这让“注册完成即拥有个人空间”的产品语义依赖用户是否访问工作台，也把写入副作用放进了共享读取查询。

Clerk 是用户身份的权威来源，并在用户注册完成后产生 `user.created` 事件。应用需要在不建立本地用户镜像表的前提下，以可信身份事件触发个人空间初始化。

## 决策

- 新增公开的 `POST /api/webhooks/clerk` Route Handler，并使用 Clerk Webhook 签名密钥验证请求。
- 只在已验证的 `user.created` 事件中调用 `ensureUserWorkspace`；该函数继续依靠 Personal Workspace 部分唯一索引和事务保持重复投递幂等。
- Webhook 创建失败返回 `5xx`，让 Clerk 重试；签名无效返回 `400`。
- `getWorkspaceContext` 只读取当前用户的 Workspace，不再懒创建 Personal Workspace。
- 部署必须在 Clerk Dashboard 为该地址订阅 `user.created`，并配置 `CLERK_WEBHOOK_SIGNING_SECRET`。

## 原因

- 注册生命周期与 Workspace 初始化保持一致，不再由某个页面访问偶然触发。
- 签名验证阻止外部请求伪造 Clerk 用户 ID。
- 幂等处理适应 Webhook 至少一次投递和失败重试语义。
- 查询路径不再包含持久化副作用。

## 后果

- Webhook 是异步事件：通常会在注册完成后立即处理，但 Clerk 不保证页面重定向必须等待数据库写入完成。短暂投递延迟或持续失败时，用户可能暂时看到无 Personal Workspace 的工作台；监控应关注 Webhook 失败并允许重试。
- 开发和生产环境都必须创建对应 Clerk Webhook endpoint；本地联调需要可被 Clerk 访问的 HTTPS 地址。
- 已有 Clerk 用户不会重新触发历史 `user.created`，升级时需要迁移或一次性回填保证他们已有 Personal Workspace；现有数据库迁移已经为已知 owner 处理过该状态。

## 备选方案

### 继续在工作台查询时懒创建

未采用。实现简单但不能表达注册完成时初始化，读取路径也会产生写入。

### 注册完成后由浏览器调用初始化接口

未采用。客户端回调可能被关闭、重复调用或伪造，并且仍依赖一次页面跳转。

### 建立本地用户镜像表

暂不采用。当前只需要 Clerk user ID 创建资源，不需要复制用户资料；增加用户同步表会扩大生命周期处理范围。

## 相关代码和文档

- `src/app/api/webhooks/clerk/route.ts`
- `src/features/workspaces/server/EnsureUserWorkspace.ts`
- `src/features/workspaces/server/GetWorkspaceContext.ts`
- `src/libs/Env.ts`
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库与迁移](../database/schema-and-migrations.md)
