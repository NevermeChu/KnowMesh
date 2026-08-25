# KnowMesh 基于 SSE 的实时站内通知技术设计方案

> [!WARNING]
> 这是 PostgreSQL 事务通知接入前的历史技术方案，其中的代码片段、性能目标和实施路线不描述当前实现。当前通知行为以 [`features/notifications.md`](features/notifications.md)、[`architecture/rendering-and-data-flow.md`](architecture/rendering-and-data-flow.md) 和 [`adr/0011-use-postgresql-notify-for-realtime-delivery.md`](adr/0011-use-postgresql-notify-for-realtime-delivery.md) 为准。

本文档基于此前的技术讨论，整理了一份面向 KnowMesh 的**轻量级、零外部依赖、无打扰（Zero-Interruption）**的实时站内通知方案。

---

## 1. 方案背景与设计目标

### 1.1 现状与痛点
- **现状**：通知系统为纯服务端被动拉取（SSR 请求驱动）。只有在页面导航、页面主动刷新或当前用户执行 Server Action 时，未读数与列表才会更新。
- **痛点**：跨用户/跨会话协作时（如被他人邀请、权限被审批、被移出项目等），停留于当前页面的用户无法即时感知红点与状态变动。

### 1.2 核心目标
1. **毫秒级即时跳点**：服务端写入通知后，客户端在 100ms 内收到事件。
2. **完全无打扰（Zero-Interruption）**：
   - 绝不触发全页重载或丢失用户当前输入焦点（如 Tiptap 编辑器打字、滚动条位置、展开菜单等）。
   - 采用**精细化局部渲染**，通知到达时仅局部更新侧边栏角标数字。
3. **零外部服务依赖 & 极低资源占用**：
   - 采用 Web 标准的 **SSE (Server-Sent Events)** 单向流，无需引入复杂的双向 WebSocket 或第三方 SaaS（如 Pusher/Novu）。
   - 本地开发与生产自建保持一致体验。
4. **支持集群水平扩展**：利用 PostgreSQL 原生 `LISTEN / NOTIFY` 机制，支持多 Node 实例集群部署，无需引入 Redis。

---

## 2. 系统架构与数据流

```mermaid
sequenceDiagram
    autonumber
    actor Actor as 触发者 (如管理员)
    participant Server as Next.js API / Server Action
    participant DB as PostgreSQL (Drizzle ORM)
    participant Bus as 实时广播总线 (PG NOTIFY / Memory)
    participant SSE as SSE Route Handler (/api/realtime/notifications)
    actor Recipient as 接收者 (前端 AppShell)

    Note over Recipient, SSE: 登录进入工作台，建立 SSE 长连接
    Recipient->>SSE: GET /api/realtime/notifications
    SSE-->>Recipient: 200 OK (text/event-stream 持续挂起)

    Note over Actor, DB: 管理员执行业务操作 (如发送工作区邀请)
    Actor->>Server: inviteWorkspaceMember(input)
    Server->>DB: 事务内写入业务表 + 插入 notifications 表
    Server->>Bus: publish(recipientUserId, notificationPayload)
    Bus->>SSE: 派发事件给目标用户的 SSE 连接
    SSE-->>Recipient: event: notification:new\ndata: { unreadCount, item }

    Note over Recipient: 前端精准局部响应
    Recipient->>Recipient: 1. 局部更新 AppSidebar <Badge> (+1)<br/>2. 弹出 3秒 轻量 Toast 浮窗<br/>3. 若当前在 /notifications 页面，将新项 prepend 到列表
```

---

## 3. 消息协议与数据格式

SSE 使用轻量 JSON 文本流，主要包含以下 3 类事件：

### 3.1 心跳保活事件 (`ping`)
- **频率**：每 25 秒一次。
- **作用**：防止 Nginx / 代理网关因 TCP 空闲超时断开长连接。
```text
event: ping
data: "1724056345000"
```

### 3.2 新通知到达事件 (`notification:new`)
- **作用**：下发新通知摘要与最新未读总数。
```text
event: notification:new
data: {
  "unreadCount": 3,
  "notification": {
    "id": "a3b8e7c1-...",
    "type": "workspace_invited",
    "title": "收到工作区邀请",
    "body": "张三 邀请你加入工作区“前端研发组”。",
    "targetKind": "workspace",
    "targetId": "w-1001",
    "createdAt": "2026-08-19T08:30:00.000Z"
  }
}
```

### 3.3 未读数校准事件 (`notification:count_sync`)
- **场景**：用户在另一个标签页将全部通知标为已读时，跨标签页同步清除角标。
```text
event: notification:count_sync
data: {
  "unreadCount": 0
}
```

---

## 4. 服务端架构与核心实现

### 4.1 消息广播总线 (`src/features/notifications/server/NotificationBroadcaster.ts`)
支持**单机内存分发**与**PostgreSQL 原生分布式广播**：

```ts
import 'server-only';
import { EventEmitter } from 'node:events';

type NotificationPayload = {
  notification?: {
    body: string;
    createdAt: string;
    id: string;
    targetId: string | null;
    targetKind: string | null;
    title: string;
    type: string;
  };
  unreadCount?: number;
};

class NotificationBroadcaster {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0); // 支持大量并发客户端订阅
  }

  subscribe(userId: string, listener: (payload: NotificationPayload) => void) {
    const channel = `user:${userId}`;
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  publish(userId: string, payload: NotificationPayload) {
    this.emitter.emit(`user:${userId}`, payload);
  }
}

export const notificationBroadcaster = new NotificationBroadcaster();
```

> **集群说明**：若部署多副本容器，只需在 `publish` 中额外执行 `SELECT pg_notify('notifications_channel', json_payload)`，并在后台启动一个全局 `pgClient.query('LISTEN notifications_channel')`，即可实现多节点广播，零额外中间件。

### 4.2 SSE 路由处理程序 (`src/app/api/realtime/notifications/route.ts`)
基于 Web Streams 标准实现长连接：

```ts
import 'server-only';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { notificationBroadcaster } from '@/features/notifications/server/NotificationBroadcaster';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | undefined;
  let heartbeatTimer: NodeJS.Timeout | undefined;

  const stream = new ReadableStream({
    start(controller) {
      // 1. 发送建立连接确认
      controller.enqueue(encoder.encode(': connected\n\n'));

      // 2. 订阅当前用户的实时消息
      unsubscribe = notificationBroadcaster.subscribe(user.id, (payload) => {
        const eventData = `event: notification:new\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(eventData));
      });

      // 3. 25 秒定时心跳保活
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeatTimer);
        }
      }, 25000);
    },
    cancel() {
      // 客户端断开连接时清理
      if (unsubscribe) {
        unsubscribe();
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    },
  });
}
```

### 4.3 业务写入点集成 ([`CreateNotification.ts`](../src/features/notifications/server/CreateNotification.ts))
在数据库插入成功后，向总线触发广播：

```ts
// 在 createNotification 完成 insert 后：
notificationBroadcaster.publish(input.recipientUserId, {
  notification: {
    body: input.body,
    createdAt: new Date().toISOString(),
    id: insertedId,
    targetId: input.target?.id ?? null,
    targetKind: input.target?.kind ?? null,
    title: input.title,
    type: input.type,
  },
});
```

---

## 5. 前端架构与精细化局部渲染

为了彻底杜绝“打断用户打字/重刷全页”的问题，前端采用 **独立 Context 状态管理**。

### 5.1 实时通知状态上下文 (`src/features/notifications/context/RealtimeNotificationContext.tsx`)

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { NotificationItem } from '@/features/notifications/Notification';

type NotificationContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  decrementUnread: () => void;
  clearUnread: () => void;
};

const RealtimeNotificationContext = createContext<NotificationContextValue | null>(null);

export function RealtimeNotificationProvider(props: {
  children: React.ReactNode;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(props.initialUnreadCount);
  const [latestNotification, setLatestNotification] = useState<NotificationItem | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = new EventSource('/api/realtime/notifications');

    eventSource.addEventListener('notification:new', (event) => {
      const payload = JSON.parse(event.data);
      // 1. 精准更新角标数字
      setUnreadCount((prev) => prev + 1);
      // 2. 触发短暂轻量 Toast 浮窗提示
      if (payload.notification) {
        setLatestNotification(payload.notification);
      }
    });

    eventSource.addEventListener('notification:count_sync', (event) => {
      const payload = JSON.parse(event.data);
      setUnreadCount(payload.unreadCount);
    });

    return () => {
      eventSource?.close();
      eventSource = null;
    };
  }, []);

  return (
    <RealtimeNotificationContext.Provider
      value={{
        clearUnread: () => setUnreadCount(0),
        decrementUnread: () => setUnreadCount((prev) => Math.max(0, prev - 1)),
        notifications: latestNotification ? [latestNotification] : [],
        unreadCount,
      }}
    >
      {props.children}
    </RealtimeNotificationContext.Provider>
  );
}

export function useRealtimeUnreadCount() {
  const context = useContext(RealtimeNotificationContext);
  return context?.unreadCount ?? 0;
}
```

### 5.2 消费组件局部对接
1. **侧边栏通知入口** ([`SidebarMenus.tsx`](../src/components/layout/AppSidebar/SidebarMenus.tsx))：
   - 提取 `<NotificationSidebarBadge />` 独立小组件，通过 `useRealtimeUnreadCount()` 订阅未读数。
   - **效果**：通知到达时，**仅重绘这个小 Badge 的数字文本**，主内容区、编辑器、导航树完全不参与任何 React 渲染。
2. **轻量浮窗提示 (Toast)**：
   - 屏幕右下角自动弹出 3 秒通知卡片，不抢夺编辑器焦点，支持点击一键跳转。

---

## 6. 鲁棒性与异常处理保障

1. **自动断线重连（Browser Built-in Reconnect）**：
   - 浏览器原生 `EventSource` 在遭遇网络波动或休眠唤醒时，会自动以 3 秒间隔不断尝试重连，无需手写重试逻辑。
2. **标签页休眠与多标签页多路复用**：
   - 使用 Web `BroadcastChannel` 在同一浏览器的多个标签页之间共享一个 SSE 连接（或允许独立连接，SSE 极轻量，10 个标签页也仅占用 10 个轻量 TCP channel）。
3. **已读状态跨窗口即时同步**：
   - 用户在标签页 A 标记某条通知已读时，服务端广播 `notification:count_sync`，标签页 B 的红点角标立即同步消除。

---

## 7. 实施路线建议（预计工期：1.5 人天）

| 阶段                                 | 核心任务                                                     | 预计耗时 |
| :----------------------------------- | :----------------------------------------------------------- | :------- |
| **阶段一：服务端流通道**             | 编写 `NotificationBroadcaster` 总线、创建 `/api/realtime/notifications` 路由并与 `CreateNotification` 串联。 | 0.5 天   |
| **阶段二：前端 Context 与角标改造**  | 封装 `RealtimeNotificationProvider`，改造侧边栏角标使其支持局部即时跳点。 | 0.5 天   |
| **阶段三：Toast 体验与已读跨页同步** | 增加右下角无打扰微浮窗提示，并在 `markNotificationRead` Server Action 中加入计数广播同步。 | 0.5 天   |