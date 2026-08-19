# 通知

状态：Current

本文描述 KnowMesh 当前的站内通知模型、触发事件、读取边界和界面行为。

## 产品边界

通知属于 Better Auth 用户，而不属于当前选中的 Workspace。用户切换 Workspace 后仍能查看自己的全部通知；服务端读取和已读写入始终使用 `requireUser()` 返回的当前用户 ID 限制收件人，客户端不能指定收件人身份。

侧边栏在“设置”上方显示通知入口。通过 Web 标准的 Server-Sent Events (SSE) 长连接（`/api/realtime/notifications`），客户端在服务端写入通知后毫秒级收到事件。侧边栏通过独立的 `NotificationSidebarBadge` 局部更新未读角标数字（最多呈现为 `99+`），同时弹出无打扰轻量 Toast 微浮窗，绝不触发页面整体重载或打断编辑器输入焦点。

点击后由共享 Workspace Layout 在右侧内容区打开 `/notifications`，页面展示最近 50 条通知，并支持单条或全部标为已读。已读变更通过 SSE 广播 `notification:count_sync`，跨标签页即时同步消除角标。页面读取本身不会自动改变已读状态，避免路由预取或普通刷新误消费通知。

## 持久化模型

`notifications` 保存用户级历史记录：

- `recipient_user_id` 是收件人的 Better Auth 用户 ID，也是所有读取和已读写入的隔离条件。
- `actor_user_id` 是可选的触发者 Better Auth 用户 ID；触发者删除账户后会被置空。
- `type` 表示稳定的业务事件类型。
- `title` 和 `body` 保存事件发生时的展示快照，因此待处理邀请或申请被删除后仍可解释通知。
- `target_kind` 与 `target_id` 同时为空或同时存在，记录 Workspace 或 Project 上下文，但不建立多态外键；资源删除后历史通知仍可保留。
- `read_at` 为空表示未读，`created_at` 决定列表顺序。

索引分别支持按收件人与创建时间读取列表，以及按收件人统计未读通知。通知在账户删除事务中按业务语义清理，因此收件人和触发者字段没有直接使用用户外键。

Better Auth 删除账户前的业务清理会删除该用户收到的全部通知，并把其他用户通知中的该用户触发者引用置空。

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
| 被移出 Workspace | 被移除成员 |
| 收到 Project 邀请 | 被邀请人 |
| Project 邀请被接受 | 邀请人 |
| Project viewer/editor 申请提交 | Project owner |
| Project viewer/editor 申请通过 | 申请人 |
| Project viewer/editor 申请未通过 | 申请人 |
| Project 成员角色变更 | 被修改成员 |
| 被移出 Project | 被移除成员 |

业务状态变化和对应通知在同一数据库事务写入。通知写入失败会回滚邀请接受、申请提交或审批，避免界面状态与通知历史互相矛盾。重复提交已存在的 Workspace 申请不会新增通知；Project 申请的 upsert 仍视为一次新的提交并新增通知。

## 实时通信与数据流

```text
业务 / 权限 Server Action
→ 服务端重新鉴权和校验输入
→ 同一事务写业务状态与 notifications 表
→ createNotification 向 NotificationBroadcaster 广播 notification:new 事件
→ 使共享 Workspace Layout 失效

SSE 路由处理程序 (/api/realtime/notifications)
→ requireUser() 验证 Session 身份
→ 订阅当前用户的 NotificationBroadcaster 频道
→ 持续推送 event: notification:new / event: notification:count_sync
→ 每 25 秒推送 event: ping 保活心跳

前端 AppShell & 侧边栏局部渲染
→ RealtimeNotificationProvider 监听 SSE 流
→ NotificationSidebarBadge 仅重绘角标文本 (+1 或同步数量)
→ useToast 弹出轻量微浮窗提示
→ 编辑器、主内容区与导航树完全不参与重渲染

/notifications 已读操作
→ markNotificationRead / markAllNotificationsRead Action 标记已读
→ Action 向 NotificationBroadcaster 广播 notification:count_sync
→ 其他打开的标签页即时同步清除未读角标
```

## 相关代码

- `src/models/Schema.ts`
- `src/features/notifications/Notification.ts`
- `src/features/notifications/server/NotificationBroadcaster.ts`
- `src/features/notifications/server/CreateNotification.ts`
- `src/features/notifications/server/GetNotifications.ts`
- `src/features/notifications/server/NotificationActions.ts`
- `src/features/notifications/context/RealtimeNotificationContext.tsx`
- `src/app/api/realtime/notifications/route.ts`
- `src/app/(workspace)/notifications/page.tsx`
- `src/components/layout/AppSidebar/SidebarMenus.tsx`

## 相关文档

- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库 Schema 与迁移](../database/schema-and-migrations.md)
- [项目业务](projects.md)
- [ADR 0010：使用 SSE 实现实时站内通知](../adr/0010-use-sse-for-realtime-notifications.md)

