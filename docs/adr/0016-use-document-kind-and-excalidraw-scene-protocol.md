# ADR 0016：使用 Document 类型与 Excalidraw scene 协议承载白板

- 状态：Accepted
- 日期：2026-08-28

## 背景

KnowMesh 的层级、项目归属、权限、收藏、搜索发现和审计都围绕 Document 资源建立。白板需要作为根文档或任意子文档参与这些公共能力，但 Excalidraw scene 不是 ProseMirror JSON，也不能进入 ADR 0012 定义的 Team Yjs 富文本权威状态。

锁定版本 `@excalidraw/excalidraw@0.18.1` 的 `reconcileElements` 可以从公共包根在 React 19 与 Next.js 16 的客户端构建中使用；该包根依赖浏览器环境，不能作为纯 Node 服务端运行时依赖。官方应用也把 scene reconciliation 放在浏览器端，服务端持久化边界必须独立设计。

## 决策

- `documents` 增加非空 `kind`，当前领域值为 `rich-text` 与 `whiteboard`。所有存量记录和旧创建路径默认保持 `rich-text`。
- 标题、层级、项目归属、权限、收藏与审计继续属于统一 Document；载荷按类型分离。
- 白板权威 scene 保存在一对一的 `document_whiteboard_states`，包含版本化 envelope、单调递增 revision 与更新时间。它不写入 `documents.content`、`search_text` 或 `document_collaboration_states`。
- Personal 白板以 PostgreSQL scene 与 revision 为权威，通过服务端 compare-and-swap 保存。
- Team 白板仍以 PostgreSQL scene 与 revision 为持久化权威。服务端负责身份、权限、消息校验、CAS、提交后广播和保存确认；浏览器使用 Excalidraw 公共 `reconcileElements` 处理 scene 语义冲突并有界重试。
- Team 白板使用独立 Whiteboard Collaboration Adapter，不复用 Yjs 文档内容协议。现有 Better Auth、Project 授权、连接治理、失效订阅和运维能力可以作为共享平台能力。
- `excalidraw-room` 仅作为 Socket.IO 房间生命周期和消息流参考，不直接作为生产服务，因为它不提供 KnowMesh 所需的资源授权、只读角色、PostgreSQL 权威持久化、CAS、权限撤回和保存确认。
- 图片与二进制资产在独立资产 ADR 完成前保持禁用；scene 的 `files` 必须为空。

## 原因

- 统一 Document 保留已有资源树和授权模型，不需要建立第二套白板导航与成员关系。
- 独立载荷表避免让 ProseMirror、Yjs transformer、Markdown 导出和正文搜索误解 scene。
- 客户端 reconciliation 使用 Excalidraw 自身的元素版本、删除 tombstone 与绑定语义；服务端不需要依赖不稳定的私有模块或模拟浏览器环境。
- 服务端 CAS 仍能拒绝基于旧 revision 的覆盖，客户端合并不会削弱数据库权威和权限边界。

## 后果

- 所有读取和写入入口必须从数据库确认 Document kind，不能从路由、父节点类型或客户端声明推断。
- 白板创建必须在同一事务中创建 Document 与 scene；数据库延迟约束保证错误类型载荷和缺失 scene 不能提交。
- 富文本服务端入口必须拒绝 whiteboard，白板入口也必须拒绝 rich-text 和错误 Workspace 模式。
- Excalidraw 浏览器包只能从 client-only 模块导入；服务端协议和持久化模块只能依赖 KnowMesh 自有 scene 类型。
- Team 协作只有在浏览器 reconciliation、服务端 CAS、断线恢复和权限失效 spike 通过后才能进入产品实现。

## 备选方案

### 把 scene 放入 `documents.content`

未采用。它会破坏现有 ProseMirror Schema、正文投影与 Yjs 派生快照的不变量，并使类型错误只能在运行时发现。

### 使用 Yjs 保存白板

未采用。当前 Yjs 状态和恢复协议只服务 Tiptap；引入非官方白板绑定会扩大升级、恢复和 tombstone 风险，也偏离 Excalidraw 官方 scene 合并模型。

### 直接部署 `excalidraw-room`

未采用。示例房间服务只转发客户端消息，缺少 KnowMesh 的业务授权和持久化成功语义。

## 相关代码和文档

- `src/features/documents/Document.ts`
- `src/features/whiteboards/WhiteboardScene.ts`
- `src/models/Schema.ts`
- [Excalidraw 白板文档集成计划](../excalidraw-integration-plan.md)
- [文档业务](../features/documents.md)
- [ADR 0002](0002-use-versioned-prosemirror-json.md)
- [ADR 0012](0012-use-yjs-for-team-document-collaboration.md)
- [ADR 0014](0014-use-browser-yjs-replicas-for-crash-recovery.md)
