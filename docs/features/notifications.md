# 通知

状态：Current

本文描述 KnowMesh 当前的站内通知模型、触发事件、读取边界和界面行为。

## 产品边界

通知属于 Better Auth 用户，而不属于当前选中的 Workspace。用户切换 Workspace 后仍能查看自己的全部通知；服务端读取和已读写入始终使用 `requireUser()` 返回的当前用户 ID 限制收件人，客户端不能指定收件人身份。

侧边栏在“设置”上方显示通知入口。通过 Web 标准的 Server-Sent Events (SSE) 长连接（`/api/realtime/notifications`），客户端在通知事务提交后收到由 PostgreSQL `LISTEN / NOTIFY` 驱动的事件。数据库订阅器把连接的 `error` 和干净 `end` 都视为失效，清除旧启动状态并按有上限的指数退避重新建立 `LISTEN`。服务端每 15 秒复验建立连接时的 Better Auth Session，撤销、过期或账户失效会关闭旧流；每条流只保留有限的待发送 chunk，慢客户端填满缓冲区时服务端解除订阅并关闭流。客户端对浏览器已终止的 EventSource 进行有上限的指数退避重建，并在每次连接后从数据库校准未读数，因此断流不会改变持久通知事实。侧边栏通过独立的 `NotificationSidebarBadge` 局部更新未读角标数字（最多呈现为 `99+`），同时弹出无打扰轻量 Toast 微浮窗，不触发页面整体重载或打断编辑器输入焦点。

点击后由共享 Workspace Layout 在右侧内容区打开 `/notifications`，页面展示最近 50 条通知，并支持单条或全部标为已读。对于工作区邀请、项目邀请与权限申请类通知，卡片直接挂载“接受/忽略/批准/拒绝”就地操作按钮，并提供直达邀请详情页或全局权限管理弹窗的深度链接；“前往工作区 / 前往项目”会先把活动 Workspace cookie 切到目标资源所属空间，再打开仪表盘或对应分区的项目页（`/personal` 或 `/collaboration`，仅带 `project`，不自动打开文档）。侧边栏在选中项目后展开所属分区与项目节点并加载根级文档树。用户就地操作或在权限弹窗中审批通过后，相关通知会在同一数据库事务中自动标记为已读；批准与拒绝把业务结果以可序列化对象返回客户端，避免生产环境把 `throw` 显示为 Server Components digest。已读变更通过 SSE 广播 `notification:count_sync`，跨标签页即时同步消除角标。页面读取本身不会自动改变已读状态，避免路由预取或普通刷新误消费通知。

工作区邀请支持双轨处理机制：已登录用户可直接通过站内通知或控制台就地接受（`acceptWorkspaceInvitationInApp`），也可通过邮件中的 Token 外链（`/invitations/accept?token=...`）或站内详情直达链接（`/invitations/accept?workspace=...`）完成加入。

## 持久化模型

`notifications` 保存用户级历史记录：

- `recipient_user_id` 是收件人的 Better Auth 用户 ID，也是所有读取和已读写入的隔离条件。
- `actor_user_id` 是可选的触发者 Better Auth 用户 ID；触发者删除账户后会被置空。
- `type` 表示稳定的业务事件类型。
- `title` 和 `body` 保存事件发生时的展示快照，因此待处理邀请或申请被删除后仍可解释通知。
- `target_kind` 与 `target_id` 同时为空或同时存在，记录 Workspace 或 Project 上下文，但不建立多态外键；资源删除后历史通知仍可保留。
- `read_at` 为空表示未读，`created_at` 决定列表顺序。

索引分别支持按收件人与创建时间读取列表，以及按收件人统计未读通知。`workspace_invited` 对 `(recipient_user_id, target_id)` 使用部分唯一索引，邮箱验证回调即使并发执行也只能为同一用户和 Workspace 保留一条邀请通知。通知收件人使用级联用户外键，触发者使用删除置空外键，账户删除事务仍按业务语义显式清理。

Better Auth 删除账户前的业务清理会删除该用户收到的全部通知，并把其他用户通知中的该用户触发者引用置空。通知删除也会在事务提交后发布 `notification:count_sync`，使仍存活的其他标签页重新读取准确未读数。

## 当前事件

首期通知覆盖权限闭环中的状态变化：

| 事件 | 收件人 |
| --- | --- |
| 收到 Workspace 邀请（已注册用户 / 新注册同步） | 被邀请人 |
| Workspace 邀请被接受 | 邀请人 |
| Workspace Editor 申请提交 | Workspace owner |
| Workspace Editor 申请通过 | 申请人 |
| Workspace Editor 申请未通过 | 申请人 |
| Workspace 成员角色变更 | 被修改成员 |
| Workspace 所有权转让 | 新 owner |
| 被移出 Workspace | 被移除成员 |
| 收到 Project 邀请 | 被邀请人 |
| Project 邀请被接受 | 邀请人 |
| Project viewer/editor 申请提交 | Project owner |
| Project viewer/editor 申请通过 | 申请人 |
| Project viewer/editor 申请未通过 | 申请人 |
| Project 成员角色变更 | 被修改成员 |
| Project 所有权转让 | 新 owner |
| 被移出 Project | 被移除成员 |

业务状态变化和对应通知在同一数据库事务写入。通知写入失败会回滚邀请接受、申请提交或审批，避免界面状态与通知历史互相矛盾。数据库触发器仅在事务提交后投递实时信号，回滚不会产生 Toast。重复提交已存在的 Workspace 申请不会新增通知；Project 申请的 upsert 仍视为一次新的提交并新增通知。

## 实时通信与数据流

```text
业务 / 权限 Server Action
→ 服务端重新鉴权和校验输入
→ 同一事务写业务状态与 notifications 表
→ notifications 触发器在事务提交后调用 pg_notify
→ 使共享 Workspace Layout 失效

每个 Node.js 进程的 NotificationDatabaseSubscriber
→ 使用专用 PostgreSQL 连接 LISTEN knowmesh_notifications
→ 按通知 ID 读取已提交的通知快照与准确未读数
→ 将事件交给进程内 NotificationBroadcaster 做用户频道扇出

SSE 路由处理程序 (/api/realtime/notifications)
→ requireUser() 验证 Session 身份
→ 订阅当前用户的 NotificationBroadcaster 频道
→ 初始连接和浏览器重连时从数据库校准未读数
→ 持续推送 event: notification:new / event: notification:count_sync
→ 每 25 秒推送 event: ping 保活心跳
→ 待发送缓冲区满时关闭慢连接，由客户端重连并重新校准

前端 AppShell & 侧边栏局部渲染
→ RealtimeNotificationProvider 监听 SSE 流
→ NotificationSidebarBadge 仅重绘角标文本 (+1 或同步数量)
→ useToast 弹出轻量微浮窗提示
→ 编辑器、主内容区与导航树完全不参与重渲染

/notifications 已读操作
→ markNotificationRead / markAllNotificationsRead Action 标记已读
→ read_at 数据库触发器在提交后发出 count 信号
→ 其他打开的标签页即时同步清除未读角标
```

默认本地运行时使用的 PGlite 可以执行 `0021` 触发器并验证事务提交、回滚和重连未读数校准，但当前 `pglite-socket` 不能模拟真实 PostgreSQL 多 backend 之间的异步通知投递。跨浏览器会话的即时 Toast 验证必须连接真实 PostgreSQL，并以 `E2E_REAL_POSTGRES=true npm run test:e2e -- PermissionRealtime.e2e.ts` 运行。

## 相关代码

- `src/models/Schema.ts`
- `src/features/notifications/Notification.ts`
- `src/features/notifications/server/NotificationBroadcaster.ts`
- `src/features/notifications/server/NotificationDatabaseSubscriber.ts`
- `src/features/notifications/server/CreateNotification.ts`
- `src/features/notifications/server/GetNotifications.ts`
- `src/features/notifications/server/NotificationActions.ts`
- `src/features/notifications/server/OpenNotificationResource.ts`
- `src/features/notifications/context/RealtimeNotificationContext.tsx`
- `src/features/notifications/components/NotificationCard.tsx`
- `src/features/workspaces/components/DashboardPendingItems.tsx`
- `src/app/api/realtime/notifications/route.ts`
- `src/app/(workspace)/notifications/page.tsx`
- `src/components/layout/AppSidebar/SidebarMenus.tsx`

## 相关文档

- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库 Schema 与迁移](../database/schema-and-migrations.md)
- [项目业务](projects.md)
- [ADR 0011：使用事务性 PostgreSQL 通知驱动跨进程 SSE](../adr/0011-use-postgresql-notify-for-realtime-delivery.md)
