# 架构决策记录

ADR 记录具有真实替代方案和长期影响的架构决定。它回答“为什么这样选择”，不替代描述当前行为的 architecture 或 feature 文档。

## 状态

- `Proposed`：正在讨论，不能作为强制约束。
- `Accepted`：当前有效，代码修改必须遵循。
- `Superseded`：被新的 ADR 替代，保留历史。
- `Rejected`：明确评估后未采用。

## 当前决策

| ADR | 状态 | 决策 |
| --- | --- | --- |
| [0001](0001-use-server-components-for-workspace-data.md) | Accepted | 工作区初始数据使用 Server Component 查询 |
| [0002](0002-use-versioned-prosemirror-json.md) | Accepted | Personal 文档内容使用版本化 ProseMirror JSON 持久化 |
| [0003](0003-introduce-workspace-resource-boundary.md) | Superseded | 引入真实 Workspace 资源边界并分阶段实现权限继承 |
| [0004](0004-use-capability-authorization-and-collaboration-inheritance.md) | Superseded | 使用能力授权并继承协作项目权限 |
| [0005](0005-use-workspace-kind-as-project-mode.md) | Superseded | 使用 Workspace 类型作为项目权限模式 |
| [0006](0006-separate-workspace-discovery-from-project-content-access.md) | Accepted | 分离 Workspace 结构发现与 Project 内容访问 |
| [0007](0007-provision-personal-workspace-from-clerk-webhook.md) | Superseded | 通过 Clerk 注册 Webhook 创建 Personal Workspace |
| [0008](0008-delete-owned-resources-on-account-removal.md) | Accepted | 统一按 owner 删除资源、按 member 退出资源 |
| [0009](0009-use-better-auth-for-local-identity.md) | Accepted | 使用 Better Auth 管理本地身份并保持业务授权独立 |
| [0010](0010-use-sse-for-realtime-notifications.md) | Superseded | 使用进程内总线配合 SSE 实现实时站内通知 |
| [0011](0011-use-postgresql-notify-for-realtime-delivery.md) | Accepted | 使用事务性 PostgreSQL 通知驱动跨进程 SSE |
| [0012](0012-use-yjs-for-team-document-collaboration.md) | Accepted | Team 文档使用 Yjs 权威状态与 ProseMirror JSON 派生快照 |
| [0013](0013-use-request-nonces-for-content-security-policy.md) | Accepted | 页面使用请求级 nonce 执行严格脚本 CSP |
| [0014](0014-use-browser-yjs-replicas-for-crash-recovery.md) | Accepted | 使用浏览器 Yjs 副本缩小协作硬崩溃丢失窗口 |
| [0015](0015-lazy-load-document-navigation.md) | Accepted | 按节点加载文档导航树 |
| [0016](0016-use-document-kind-and-excalidraw-scene-protocol.md) | Accepted | 使用统一 Document 类型与独立 Excalidraw scene 协议承载白板 |

## 新 ADR 模板

```md
# ADR NNNN：决策标题

- 状态：Proposed
- 日期：YYYY-MM-DD

## 背景

问题、约束和触发决策的事实。

## 决策

明确说明选择什么，以及适用边界。

## 原因

为什么该方案优于真实存在的替代方案。

## 后果

正面结果、代价、限制和未来需要重新评估的条件。

## 备选方案

评估过但未采用的方案及原因。

## 相关代码和文档

稳定的相对路径和文档链接。
```

Accepted ADR 不改写核心决策。需要改变时新增 ADR，并将旧 ADR 标记为 `Superseded by ADR NNNN`。
