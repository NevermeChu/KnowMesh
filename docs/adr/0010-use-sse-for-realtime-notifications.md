# ADR 0010：使用 SSE 实现实时站内通知

- 状态：Accepted
- 日期：2026-08-19

## 背景

KnowMesh 的站内通知原先依赖服务端被动拉取（SSR 请求与路由刷新）。跨用户协作（如邀请、权限审批、成员变更）时，停留在工作台的用户无法即时感知红点角标与状态变化，需要主动刷新页面。

同时，系统要求保持轻量化、零外部中间件依赖，且通知推送绝不能打断用户在 Tiptap 编辑器中的输入或引发全局重载。

## 决策

- 采用 Web 标准的 **Server-Sent Events (SSE)** 单向流（`/api/realtime/notifications`）向已登录客户端推送实时通知。
- 服务端使用内存广播总线 `NotificationBroadcaster` 进行用户级频道事件派发，业务写入点（`createNotification`）和已读操作（`NotificationActions`）在事务完成后触发广播。
- 前端使用 `RealtimeNotificationProvider` 建立并维护长连接，将侧边栏角标拆分为独立组件 `NotificationSidebarBadge` 进行精细化局部重绘，并通过 `useToast` 弹出无打扰轻量浮窗。
- 长连接包含 25 秒定时心跳（`event: ping`），并在网络中断时利用浏览器原生重连机制恢复。

## 原因

- **轻量与单向流适配**：站内通知是典型的服务端向客户端单向推送场景，SSE 基于标准 HTTP/HTTPS，比双向 WebSocket 更加轻量，天然支持断线自动重连与防火墙穿透。
- **零外部服务依赖**：无需引入 Pusher、Novu 或第三方 SaaS，也无需在单机/小规模部署时引入 Redis 中间件。
- **无打扰用户体验（Zero-Interruption）**：通过 Context 局部状态分发与独立的 Badge 子组件，通知到达时仅更新数字角标文本，不触发全页重绘，绝不抢夺编辑器焦点。

## 后果

- Node.js 服务端需要维持客户端挂起的 HTTP 长连接，需注意代理层（如 Nginx）的超时与缓冲配置（`X-Accel-Buffering: no`）。
- 多实例水平扩展集群时，可在 `NotificationBroadcaster` 中配合 PostgreSQL 原生 `LISTEN / NOTIFY` 机制扩展为跨节点总线。

## 备选方案

### 双向 WebSocket

未采用。站内通知不需要客户端向服务端高频上行数据（上行交互均由 Server Action 完成），WebSocket 增加了协议握手、连接鉴权与状态机维护复杂度。

### 客户端轮询（Polling）

未采用。定时短轮询带来无意义的空查询与服务器负载，且无法实现毫秒级即时跳点。

### 第三方云推送服务（Pusher / Novu）

未采用。增加外部 SaaS 依赖、网络延迟与部署复杂度，违背 KnowMesh 零外部服务依赖与私有化交付原则。

## 相关代码和文档

- `src/features/notifications/Notification.ts`
- `src/features/notifications/server/NotificationBroadcaster.ts`
- `src/features/notifications/server/CreateNotification.ts`
- `src/features/notifications/server/NotificationActions.ts`
- `src/features/notifications/context/RealtimeNotificationContext.tsx`
- `src/app/api/realtime/notifications/route.ts`
- `src/components/layout/AppSidebar/SidebarMenus.tsx`
- [通知](../features/notifications.md)
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
