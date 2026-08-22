# ADR 0012：Team 文档使用 Yjs 权威状态与 ProseMirror JSON 派生快照

- 状态：Accepted
- 日期：2026-08-21
- 部分替代：[ADR 0002](0002-use-versioned-prosemirror-json.md) 的 Team 文档正文范围

## 背景

ADR 0002 以版本化 ProseMirror JSON 作为所有文档正文的权威持久化格式，适合当前单人自动保存，但多个浏览器提交完整 JSON 时仍会后写覆盖。Team Workspace 需要并发合并、断线重连以及在线成员和光标；Personal Workspace 仍只需要低成本的单人写作。

生产环境已有 PostgreSQL、Nginx 和 systemd。第一阶段只需要单实例协作服务，不要求跨实例广播、长期离线队列、评论或版本历史。

## 决策

- Team 文档使用 Yjs 二进制状态作为正文协作的权威状态，`documents.content` 是从该状态生成并通过现有 Schema 验证的 ProseMirror JSON 派生快照。
- Personal 文档继续遵循 ADR 0002，以 `documents.content` 作为权威正文并使用现有 Server Action 自动保存。
- Team 与 Personal 文档继续共用 `documents`、ProseMirror Schema、权限、搜索、收藏和导出能力；服务端根据文档所属 Workspace 类型选择正文写入引擎。
- Hocuspocus v4 作为独立单实例 Node.js 进程运行，通过同源 WSS 接入，并在 PostgreSQL 的 `document_collaboration_states` 中保存合并后的完整 Yjs 状态。第一阶段不引入 Redis。
- Team 文档只在不存在协作状态时从已验证的 JSON 初始化一次。协作状态建立后不得回退到 JSON 正文写入；服务故障时 Team 正文只能降级为只读。
- 标题仍通过 Server Action 保存。Awareness 只承载瞬时 Presence，不作为授权、审计或持久化事实源。

## 原因

- Yjs 能合并并发变更并支持增量重连，避免完整 JSON 的后写覆盖。
- 保留 JSON 派生快照使搜索、服务端渲染和导出无需理解 Yjs，同时保持现有内容 Schema 边界。
- 独立 Hocuspocus 进程提供明确的 WebSocket 生命周期、鉴权与优雅关闭边界，不把有状态双向协议塞入 Next.js 请求生命周期。
- 单实例和 PostgreSQL 持久化符合当前部署规模，避免过早增加 Redis 与跨区域一致性成本。

## 后果

- 协作状态与 JSON 快照必须在同一数据库事务中更新；任一转换或写入失败都不得提交半套状态。
- Team 正文的普通 Server Action 写入必须被服务端拒绝，客户端传入的编辑模式不能作为依据。
- 首次初始化必须使用冲突安全的插入并重新读取胜出的数据库状态，避免并发连接创建不同历史。
- 长连接需要定期重新验证 Session 与 `document.update` 权限；viewer 只能接收状态，不能写入更新。
- 应用与协作服务必须来自同一 Git SHA，并通过功能开关按 expand/contract 顺序启用。回滚已激活的 Team 文档时只能只读，不能恢复旧 JSON 写入。

## 备选方案

### 继续覆盖完整 ProseMirror JSON

未采用，因为无法安全合并并发编辑，也无法表达协作客户端的增量同步状态。

### 所有文档统一使用 Yjs

未采用，因为 Personal 文档没有协作需求，引入 WebSocket 和双重持久化会增加不必要的运行成本与故障面。

### 在 Next.js Route Handler 中托管 WebSocket

未采用，因为当前部署和请求生命周期不适合承载长期、有状态的 Hocuspocus 连接与退出前 flush。

### 首阶段引入 Redis

未采用，因为当前明确保持单实例；需要水平扩展时再新增决策并设计跨实例文档广播。

## 相关代码和文档

- `src/features/documents/collaboration/`
- `src/models/Schema.ts`
- `migrations/0022_giant_annihilus.sql`
- [实时协作实施计划](../document-collaboration-plan.md)
- [文档业务](../features/documents.md)
- [数据库与迁移](../database/schema-and-migrations.md)
