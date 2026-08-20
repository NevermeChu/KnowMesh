# ADR 0011：使用事务性 PostgreSQL 通知驱动跨进程 SSE

- 状态：Accepted
- 日期：2026-08-20
- 替代：[ADR 0010](0010-use-sse-for-realtime-notifications.md)

## 背景

ADR 0010 选择 SSE 作为浏览器单向实时通道，但首版实现直接在业务写入函数中向 Node.js 进程内 `EventEmitter` 广播。该实现存在两个一致性缺口：事务尚未提交时就可能向用户发送之后被回滚的通知；SSE 连接与业务写入落在不同 Node.js 进程时无法互相感知。浏览器重连也只恢复连接，没有从持久化状态校准未读数。

KnowMesh 的生产环境已经依赖 PostgreSQL，因此可以复用数据库事务通知而不增加 Redis 或第三方推送服务。本地 PGlite 能执行通知函数和触发器，但当前 `pglite-socket` 多连接代理不等价于多个 PostgreSQL backend，不能作为跨连接异步通知的验证环境。

## 决策

- 保留 SSE 作为浏览器传输协议。
- `notifications` 的插入及 `read_at` 更新由数据库触发器调用 `pg_notify`。PostgreSQL 只在所属事务提交后投递事件，回滚事务不产生可见通知。
- 每个 Node.js 进程维护一个 PostgreSQL `LISTEN` 连接，把数据库信号转换为该进程内按用户隔离的 SSE 事件。进程内广播只承担连接扇出，不再承担跨进程一致性。
- 数据库信号只包含收件人、事件种类和通知 ID；标题、正文与准确未读数在收到信号后从数据库读取，避免在通知载荷中复制敏感内容或信任瞬时状态。
- 每次 SSE 初始连接和浏览器自动重连都从数据库发送一次准确的 `notification:count_sync`，持久化状态始终是角标的事实源。

## 原因

- PostgreSQL `NOTIFY` 与触发它的事务共享提交边界，可以消除回滚后的幽灵 Toast。
- `LISTEN / NOTIFY` 天然跨 Node.js 进程，适合当前自建 PostgreSQL 与 systemd 部署，也保留未来水平扩展能力。
- SSE 仍符合单向、低频通知场景；无需引入 WebSocket 双向状态机或额外消息中间件。
- 重连时数据库校准未读数，即使客户端在断线期间没有看到 Toast，角标也不会长期漂移。

## 后果

- 应用进程需要一个专用 PostgreSQL 监听连接；连接异常时订阅器会释放旧连接并重试。
- 迁移必须同时部署通知触发器。旧应用可以忽略数据库通知，因此该迁移与应用回滚兼容。
- 默认 PGlite 本地运行时可以验证迁移、事务提交/回滚语义和 SSE 重连计数校准，但跨会话即时 Toast 必须连接真实 PostgreSQL 验证；对应 Playwright 用例仅在 `E2E_REAL_POSTGRES=true` 时运行。
- `NOTIFY` 不是历史消息队列。断线期间的 Toast 不做逐条回放，但持久化通知列表和重连未读数校准保证状态完整；若未来要求逐条可靠推送，应增加 outbox 和游标消费，而不是扩展进程内事件总线。

## 备选方案

### 继续使用进程内 EventEmitter

未采用。它无法跨进程，并且业务函数很难统一获得可靠的事务提交后回调。

### 定时轮询数据库

未采用。它能校准状态但会对每个客户端持续制造查询，延迟也取决于轮询间隔。当前只在连接建立和数据库事件到达时查询。

### Redis Pub/Sub 或消息 SaaS

未采用。当前 PostgreSQL 已能承担低频事务通知，引入额外服务会增加部署和运维边界。

## 相关代码和文档

- `migrations/0021_notification_realtime_delivery.sql`
- `src/features/notifications/server/NotificationDatabaseSubscriber.ts`
- `src/features/notifications/server/NotificationBroadcaster.ts`
- `src/app/api/realtime/notifications/route.ts`
- [通知](../features/notifications.md)
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
