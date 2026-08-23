# KnowMesh 文档实时协作写作实施计划

状态：In Progress（阶段 0–6 已实现；真实 PostgreSQL CI、生产双服务部署与公网 WSS Upgrade 已通过，真实登录双会话业务验收和阶段 7 尚未完成）

本文规划现有 Tiptap 文档编辑器从单人自动保存迁移到实时协作写作的实施路径。计划只覆盖文档正文协作、在线成员和光标、权限、持久化、部署与验证；当前实现事实仍以代码、Schema、迁移和当前状态文档为准。

## 1. 目标

对 Team Workspace 文档使用 Yjs 作为正文协作状态模型，使用 Hocuspocus v4 提供 WebSocket 同步与服务端生命周期，在保持现有统一文档模型、Project 成员和权限边界不变的前提下支持多人同时编辑同一篇文档。Personal Workspace 文档继续使用当前单人自动保存，不接入协作服务。

完成后应满足：

- 多个已授权用户可以同时编辑同一篇文档，正文变更不会再以最后写入覆盖其他用户内容。
- `viewer` 可以实时读取正文和其他成员的变更，但不能向协作状态写入更新。
- `editor` 和 `owner` 可以编辑正文；服务端必须重新验证身份与 `document.update`，不得信任客户端角色。
- 客户端展示连接、同步、离线和错误状态，并展示在线成员、远端光标及选区。
- Team 文档以 Yjs 二进制状态作为正文协作的权威状态，`documents.content` 保留为经过验证的 ProseMirror JSON 派生快照。
- Personal 文档继续以 `documents.content` 作为权威正文，并通过现有 Server Action 自动保存。
- 首次启用协作的 Team 文档只进行一次 ProseMirror JSON → Y.Doc 初始化；后续连接必须加载已经持久化的 Yjs 状态。
- Personal 和 Team 文档继续共用 `documents`、ProseMirror Schema、权限、读取、搜索、收藏和导出能力，只分开正文写入引擎。
- 协作服务重启、浏览器断线重连和短时间离线后，已确认同步的内容不会丢失或重复插入。
- 权限撤回、成员移除、文档删除和 Session 失效能够终止或降级相关实时连接。

## 2. 范围边界

### 包含

- Tiptap 正文的 Yjs CRDT 协作。
- Hocuspocus WebSocket 服务、Provider 和 React 生命周期绑定。
- PostgreSQL 中的 Yjs 二进制持久化。
- 从 Yjs 状态生成经过现有 Tiptap Schema 验证的 ProseMirror JSON 快照。
- Better Auth 身份验证和现有 Project 直接成员授权。
- `owner`、`editor`、`viewer` 的实时读写差异。
- 在线成员、远端光标、选区和连接状态 UI。
- Team 文档从现有正文自动保存迁移到协作写入链路。
- 本地开发、CI、Nginx、systemd、健康检查、日志和基础运行指标。
- 单元测试、集成测试、双浏览器 E2E、迁移验证和当前状态文档更新。

### 不包含

- Excalidraw、白板或其他画布协作；另行规划。
- 评论、回复、提及和评论解决状态。
- 审阅模式、修订建议、逐字作者归属或 tracked changes。
- 用户可见的版本历史、快照浏览、差异比较和恢复版本。
- 文档标题的实时协作；标题继续通过现有 Server Action 保存。
- 文档级独立 ACL；正文权限继续完全继承 Project 直接成员能力。
- 长期离线编辑队列和 IndexedDB 持久化；第一阶段只依赖 Provider 断线缓存与重连同步。
- 端到端加密；服务端必须能够验证、投影和持久化正文状态。
- 多实例 Hocuspocus、Redis 广播和跨区域部署；第一阶段保持单实例。
- SSE 通知通道改造；现有 SSE 继续只承担低频站内通知。
- Personal Workspace 文档协作；Personal 文档继续使用现有单人写入路径。

## 3. 当前基线

当前文档编辑流程为：

```text
Server Component 读取 documents.content
  → DocumentEditor 使用 ProseMirror JSON 初始化 Tiptap
  → 正文 onUpdate 合并 700 ms
  → updateDocument Server Action
  → requireUser + authorizeDocument(document.update)
  → 覆盖 documents.content JSONB
```

当前约束：

- `documents.content` 是版本化 ProseMirror JSON，当前由 `content_schema_version` 标识 Schema 版本。
- `documentExtensions` 同时定义客户端编辑器和服务端 JSON 校验使用的节点集合。
- 正文读取和写入必须经过 Project 直接成员关系；Workspace 结构发现能力不能授予正文访问。
- `updateDocument` 同时承担标题和正文保存，正文请求虽然串行发送，但不同浏览器之间仍是后写覆盖。
- 当前没有 Yjs 状态、双向实时通道、冲突合并或离线队列。
- 现有 Accepted ADR 0002 明确把 ProseMirror JSON 定义为权威持久化格式；将 Team 文档改为以 Yjs 二进制作为正文权威状态前，必须新增 ADR 替代该范围内的决策，不能静默修改 ADR 0002 的历史内容。Personal 文档继续遵守 ADR 0002 的 JSON 权威模型。

## 4. 核心设计决策

### 4.1 Team 协作状态与派生快照分离

Yjs 二进制状态承担：

- 并发合并；
- 协作历史结构；
- 断线后的增量同步；
- Hocuspocus 客户端与服务端之间的权威同步。

`documents.content` 继续承担：

- Server Component 初始读取和非编辑视图；
- 全文搜索与摘要生成；
- Markdown 导出及其他服务端转换；
- 未直接理解 Yjs 的现有查询路径。

对于 Team 文档，`documents.content` 是由 Yjs 状态生成的派生快照，不得再接受普通客户端正文写入。对于 Personal 文档，`documents.content` 仍是权威正文并接受经过授权和 Schema 验证的 Server Action 自动保存。标题继续通过现有 Server Action 保存。

不得在每次 Team 文档连接时把 `documents.content` 重新转换成新的 Y.Doc。这样会创建新的协作历史并可能重复插入内容。只有 Team 文档不存在持久化协作状态时，才能进行一次性初始化。Personal 文档不得创建 Y.Doc 或协作状态记录。

### 4.2 统一文档模型，分开正文写入模式

Personal 和 Team 文档继续使用同一张 `documents` 表、同一套 ProseMirror Schema、同一权限模块以及相同的搜索、收藏、导出和导航能力，不拆分为两种文档资源或两套业务表。

正文写入模式由服务端根据文档所属 `workspaces.kind` 推导：

```text
personal → single-user → updateDocument(content) → documents.content
team     → collaborative → Hocuspocus/Yjs → document_collaboration_states.state
                                         → 投影 documents.content
team（已有状态且开关关闭）→ collaborative-readonly → 只读 documents.content 派生快照
```

客户端可以接收服务端计算的 `single-user | collaborative | collaborative-readonly` 用于选择编辑器连接方式，但客户端传入的模式不得作为授权或写入依据。服务端不得使用当前页面、`area` 查询参数或 UI 状态判断正文写入模式。

该分流不改变业务授权：

- Personal Project 仍只允许 owner。
- Team Project 仍要求 `project_members` 直接成员记录。
- Workspace owner 仍不能读取或编辑自己未直接加入的 Project 正文。
- Personal 文档不得建立 Hocuspocus 房间；Team 文档不得回退到 JSON 正文自动保存。

### 4.3 Hocuspocus 作为独立运行服务

协作服务作为独立 Node.js 进程运行，由 Nginx 将专用 WebSocket 路径转发到本机端口。它与 Next.js 应用共享：

- Better Auth 用户和 Session 数据；
- PostgreSQL 数据库与 Drizzle Schema；
- `DocumentAuthorization` 和 Project 权限策略；
- `Env.ts` 环境变量验证；
- 发布版本、日志规范和健康检查。

它不嵌入 Next.js Route Handler，也不复用 SSE 通知连接。SSE 是服务端单向低频推送，协作文档需要独立的双向、有状态 WebSocket 生命周期。

### 4.4 标题与正文暂时分离

第一阶段只同步正文。标题继续在失焦时调用 `updateDocument`：

- 避免同时改造侧边栏导航、搜索结果、路由刷新和标题唯一交互。
- `updateDocument` 继续支持 Personal 文档正文和所有文档标题；当输入包含 `content` 时，服务端必须重新解析文档所属 Workspace，并拒绝 Team 文档正文写入。
- 若未来需要实时标题，再单独决定使用 Y.Map 还是保留数据库写入；不得在本计划中提前加入双写。

### 4.5 Presence 不是业务权威状态

在线成员、光标和选区通过 Yjs Awareness 传播：

- Awareness 不写入数据库。
- 客户端不得自报任意用户身份；姓名、头像和稳定颜色由服务端认证上下文或受保护接口提供。
- Presence 不用于授权、审计或“当前谁拥有文档”判断。
- 不在 Awareness 中发送邮箱、Session、权限令牌或正文片段。

## 5. 依赖计划

新增依赖应与现有 Tiptap 主版本保持一致，并统一检查 lockfile 中所有 `@tiptap/*` 包，避免编辑器核心与协作扩展版本漂移。

客户端和共享状态：

- `@tiptap/extension-collaboration`
- `@tiptap/extension-collaboration-caret`
- `@tiptap/y-tiptap`
- `yjs`
- `y-protocols`
- `@hocuspocus/provider`
- `@hocuspocus/provider-react`

服务端和持久化：

- `@hocuspocus/server` v4
- `@hocuspocus/extension-database` v4
- `@hocuspocus/transformer` v4

认证令牌仅在确认 WebSocket 握手中的 Better Auth Session 不能满足独立服务的续期和撤销要求后引入。若采用短期签名能力令牌，应使用成熟的 JOSE 实现并在 `Env.ts` 中验证独立密钥；不得复用或在客户端暴露 `BETTER_AUTH_SECRET`。

第一阶段不安装：

- `socket.io`、`y-websocket` 或另一套 WebSocket Provider；
- `y-indexeddb`；
- Hocuspocus Redis 扩展；
- Tiptap Pro 评论、快照、历史或审阅扩展。

## 6. 数据模型与迁移

### 6.1 新增协作状态表

建议新增独立表：

```text
document_collaboration_states
├─ document_id UUID PRIMARY KEY
│    → documents.id ON DELETE CASCADE
├─ state BYTEA NOT NULL
├─ document_schema_version INTEGER NOT NULL
├─ initialized_at TIMESTAMP NOT NULL
└─ updated_at TIMESTAMP NOT NULL
```

约束：

- `state` 保存 `Y.encodeStateAsUpdate()` 生成的原始二进制，不保存 Y.Doc JSON。
- `document_schema_version` 与生成该状态时使用的 `DOCUMENT_CONTENT_SCHEMA_VERSION` 对齐，用于判断自定义 Tiptap 节点兼容性；它不是 Yjs 或 npm 包版本。
- 文档删除必须通过外键级联删除协作状态。
- 只有 Team 文档允许存在协作状态；该跨表规则由应用初始化入口和测试执行，不能仅凭客户端模式保证。
- 第一阶段每篇 Team 文档只保存合并后的完整状态，不建立逐 update 事件日志；版本历史不属于本计划。

### 6.2 一次性初始化

首次打开尚无协作状态的 Team 文档时：

```text
授权读取文档
  → 读取并验证 documents.content
  → 使用完整 documentExtensions 转换成 Y.Doc
  → 编码 Uint8Array
  → INSERT document_collaboration_states ON CONFLICT DO NOTHING
  → 无论是否抢到初始化权，都重新读取数据库中的最终 state
  → 把最终 state 交给 Hocuspocus
```

服务端必须先确认文档所属 Workspace 为 `team`。并发首次连接时只能有一个初始化结果成为权威状态；未成功插入的连接不得继续使用自己临时创建的 Y.Doc。Personal 文档请求协作房间时必须被拒绝，不能借该入口隐式切换存储模式。

### 6.3 持久化与 JSON 投影

Hocuspocus 的 store 生命周期应做节流，在一次处理内：

1. 编码当前 Y.Doc 二进制状态。
2. 使用 `@hocuspocus/transformer` 和完整 `documentExtensions` 转成 ProseMirror JSON。
3. 通过现有 `isDocumentContent` 或等价的共享校验验证派生 JSON。
4. 在同一个 PostgreSQL 事务中更新协作二进制、`documents.content`、`content_schema_version` 和 `documents.updated_at`。

任一步失败时不得只提交其中一种状态。协作服务应记录文档 ID、失败阶段和可关联请求信息，但不得输出正文或二进制状态。

搜索和服务端读取允许落后于内存中尚未持久化的短暂编辑，但持久化节流上限必须明确，并在“已同步”状态中区分：

- 已发送到协作服务；
- 已由服务端确认持久化。

如果 Provider 无法提供严格的持久化确认，UI 只显示“已同步”，不得宣称“已保存到数据库”。

### 6.4 Expand/contract 与回滚

迁移按以下顺序执行：

1. 增加协作状态表和向后兼容代码，功能开关默认关闭。
2. 部署并验证协作服务能够连接数据库、鉴权、初始化和存储测试文档。
3. 部署能够按服务端模式选择单人或协作写入的编辑器，但在生产开关打开前仍不创建真实协作状态。
4. 打开功能开关后，Team 文档按首次访问逐步激活协作状态；Personal 文档保持现有状态。
5. 确认 Team 正文写入都已离开 `updateDocument(content)`，并在服务端拒绝 Team 正文的旧写入入口；Personal 正文自动保存继续保留。

一篇 Team 文档一旦创建 Yjs 状态，就不得回退到旧 JSON 编辑路径。应用回滚只允许把已激活的 Team 文档置为只读并保留 JSON 派生快照；不得允许旧客户端修改其 `documents.content`，否则后续 Yjs 投影会覆盖回滚期间的写入。Personal 文档不受该限制，继续使用 JSON 自动保存。出现协作故障时只降级 Team 文档，不能连带中断 Personal 文档写作。

## 7. 身份与授权

### 7.1 连接建立

协作房间名称采用稳定、可验证的格式，例如 `document:<uuid>`。服务端必须：

1. 验证请求来源和允许的 Host/Origin。
2. 从 Better Auth Session 或受保护接口签发的短期令牌取得用户身份。
3. 严格解析文档 ID，不接受客户端传入的 Project、Workspace、角色或能力。
4. 查询文档所属 Workspace 并确认 `workspaces.kind = 'team'`；Personal 文档不得进入协作房间。
5. 调用统一文档授权查询验证 `document.read`。
6. 只有具有 `document.update` 时允许写入；其他已授权连接设置为 read-only。
7. 将服务端解析的用户 ID、显示名称、头像和权限放入连接上下文。

客户端传入的 room name 和 Awareness 用户信息都不是授权依据。

### 7.2 Session 和权限变化

长连接不能只在首次握手时永久信任权限。实施时必须同时覆盖：

- Session 到期或被撤销；
- Project 成员被移除；
- `editor` 降级为 `viewer`；
- `viewer` 升级为 `editor`；
- Project、Workspace 或文档被删除；
- 所有权转让导致的能力变化。

推荐组合：

- 短周期重新验证 Session 与数据库权限，缓存时间必须明确且较短。
- 权限事务提交后发布不含正文的连接失效信号，协作服务按用户和资源关闭或降级连接。
- 每次接收客户端写更新前确认连接当前不是 read-only；失效连接不得继续向其他用户广播更新。

若即时失效信号复用 PostgreSQL `NOTIFY`，应建立独立频道和事件类型，不能把站内通知正文或收件箱事件当作授权事件总线。

### 7.3 基础防护

- 限制单用户连接数、单文档连接数、单条消息大小和空闲时间。
- 拒绝格式非法或不存在的文档房间。
- WebSocket 路径必须使用生产 HTTPS/WSS。
- Nginx 必须正确转发 Upgrade、Connection、Host 和来源信息，并设置适合协作的超时。
- 日志不得包含 Session cookie、令牌、Yjs 更新或正文。
- 协作服务不可通过公网端口绕过 Nginx 直接访问。

## 8. 编辑器与界面改造

### 8.1 Provider 生命周期

- Server Component 必须根据数据库中的 Workspace 类型返回编辑模式；客户端不得自行推断。
- Personal 文档沿用当前 Tiptap 初始化和正文自动保存，不创建 Provider、Awareness 或 Y.Doc。
- 以下 Provider 生命周期约束只适用于 Team 文档。
- Provider、Y.Doc 和 Tiptap Editor 必须以文档 ID 为生命周期边界。
- 切换文档时销毁旧 Provider、Awareness 和 Y.Doc，防止跨文档状态泄漏。
- 使用 Hocuspocus React bindings 管理 React Strict Mode 下的连接，避免重复建立连接。
- 必须等待 Provider 完成初始同步后再挂载可编辑 Tiptap 实例。
- 协作编辑器不得同时传入 `content` 初始化正文；首次内容由服务端一次性初始化流程提供。
- Team 文档 Provider 连接失败时不得静默回退到 `updateDocument(content)`，否则会形成双写和内容分叉；该故障不得影响 Personal 文档继续保存。

### 8.2 Tiptap 扩展

- Personal 和 Team 编辑器继续共用相同的文档节点、marks 和自定义扩展集合；不得形成两套内容 Schema。
- 扩展组装必须按编辑模式配置：Personal 保留 StarterKit Undo/Redo；Team 关闭 StarterKit `undoRedo`，由 Collaboration/Yjs 处理协作撤销和重做。
- 服务端验证和 Transformer 必须复用同一份不含客户端生命周期状态的 Schema 扩展集合。
- callout、details、task list 等自定义节点必须覆盖首次转换、同步、持久化、重连和 Markdown 导出测试。
- 新增或修改节点时仍遵守 `DOCUMENT_CONTENT_SCHEMA_VERSION` 演进规则，并额外验证旧 Yjs 状态能否被当前 Transformer 读取。

### 8.3 状态和 Presence UI

Team 文档的 `DocumentSaveStatus` 改为表达协作状态：

- 正在连接；
- 正在同步；
- 已同步；
- 已离线，等待重连；
- 同步失败，需要重试；
- 只读。

编辑器顶部展示在线成员头像或紧凑成员列表；正文显示远端光标和选区。UI 更新必须局部化，不能因为 Presence 高频变化触发工作区布局、侧边栏或整个编辑器重建。

Personal 文档继续显示当前保存中、已保存和保存失败状态，不展示协作连接状态、在线成员或远端光标。

### 8.4 标题、搜索和导出

- 标题保存维持现有 Server Action 和服务端授权。
- Team 正文变更不调用 Server Action 或 `router.refresh()`；Personal 正文继续使用当前自动保存行为。
- 搜索、收藏列表、最近文档和 Markdown 导出继续读取 `documents.content` 派生快照。
- 服务端投影成功后更新 `documents.updated_at`，使最近文档排序反映已持久化的正文变更。
- 导出时若当前客户端存在尚未持久化的本地更新，应先请求 Provider flush 或明确提示导出基于当前编辑器状态，不能把数据库旧快照误称为最新内容。

## 9. 分阶段实施

### 阶段 0：基线与架构决策

- 记录当前 lint、类型、单元、E2E 和生产构建基线。
- 新增 ADR，决定 Team 文档以 Yjs 二进制为正文协作权威状态、ProseMirror JSON 为派生快照，Personal 文档继续以 JSON 为权威正文，并说明对 ADR 0002 的替代范围。
- 确认单实例 Hocuspocus、独立进程、同源 WSS、PostgreSQL 持久化和不引入 Redis。
- 确认功能开关、激活后不可回退写入的运维边界。

验收：关键取舍和回滚限制已经得到确认；当前状态文档仍明确标记协作尚未实现。

### 阶段 1：依赖、Schema 与转换验证

- 安装并锁定 Tiptap Collaboration、Yjs 和 Hocuspocus v4 依赖。
- 新增 `document_collaboration_states` Schema 和 expand-only migration。
- 实现 ProseMirror JSON ↔ Y.Doc 转换适配器。
- 覆盖空文档、StarterKit 和全部自定义节点 round-trip 测试。
- 实现并测试 Team 文档并发一次性初始化和 Personal 文档拒绝初始化。

验收：迁移可在当前数据库上向前执行；所有当前合法文档 JSON 可以初始化、编码、加载并生成等价有效快照。

### 阶段 2：协作服务与持久化

- 建立独立 Hocuspocus 启动入口和健康检查。
- 接入现有数据库连接、泛型数据库扩展或等价 fetch/store hooks。
- 实现节流持久化、事务性二进制与 JSON 投影更新。
- 增加优雅关闭，在进程退出前停止接收连接并 flush 待持久化文档。
- 增加文档数、连接数、存储失败和投影失败的结构化指标。

验收：服务重启后能够从数据库恢复相同 Yjs 状态；存储失败不会只更新二进制或只更新 JSON。

### 阶段 3：身份、权限与失效

- 建立 WebSocket 身份验证边界。
- 将 room name 解析为文档 ID并调用 `authorizeDocument`。
- 将 viewer 连接设为 read-only。
- 实现 Session/成员/角色变化后的连接重新验证和失效。
- 覆盖 Origin、连接数、消息大小和日志脱敏。

验收：未登录、非 Project 成员和伪造 room name 无法读取状态；viewer 发送的更新不会被应用或广播；权限撤回后现有连接在定义的时限内失效。

### 阶段 4：编辑器接入

- 服务端根据 Workspace 类型和协作开关返回 `single-user | collaborative | collaborative-readonly` 编辑模式；协作状态只决定 Team 首次连接是初始化还是恢复，不参与客户端写入引擎选择。
- 使用 Provider React bindings 建立按文档隔离的 Provider/Y.Doc 生命周期。
- 复用同一内容 Schema，按模式组装 Personal 和 Team 编辑器扩展；只在 Team 模式接入 Collaboration、CollaborationCaret 并关闭 StarterKit Undo/Redo。
- 等待初始同步后再显示可编辑正文。
- 只移除 Team 文档正文的 700 ms Server Action 自动保存和失焦 flush；Personal 文档保留现有行为。
- 保留标题保存，改造协作状态和远端光标 UI。

验收：两个浏览器能够同时编辑 Team 文档；Personal 文档不建立 WebSocket 且正常自动保存；撤销行为符合各自模式；切换文档不会串房间或泄漏光标。

当前进度：阶段 4 已通过真实 Chrome/Edge 验收。已确认双向编辑、Presence、站内离开立即清理与重新进入不重复连接、Yjs 二进制和 JSON 投影持久化、完整服务重启恢复、editor 降为 viewer 后连接失效并最终冻结客户端写入，以及功能开关关闭时从最新快照只读显示、重新启用后恢复同一协作正文。Personal 文档不建立协作连接，正文自动保存后刷新和重新打开均能恢复；Personal 撤销结果在刷新后保持，Team 临时写入会先同步到另一浏览器，撤销后两端及数据库投影都不再包含临时文本且既有正文保持完整。跨区域和站内路由切换没有串用协作写入路径或残留活动房间。自动化测试已覆盖 Hocuspocus viewer 原生写入拒绝，以及 Chromium 中的 viewer 只读、Project 角色降级、Workspace 成员移除和 Session 删除；Project 成员删除与角色降级共用 `project_members` 通知和复查路径，不重复保留浏览器场景。GitHub Actions CI #41 已在真实 PostgreSQL 与 Hocuspocus 服务下确认全部 19 项 E2E 通过。通知与周期复查按连接隔离查询异常，单个失败不会阻断后续连接撤权。

### 阶段 5：投影消费者与故障体验

- 验证搜索、最近文档、收藏、Markdown 导出和打印读取最新已持久化快照。
- 明确断线、重连、服务不可用和持久化失败时的 UI。
- 禁止协作失败时回退到 JSON 正文写入。
- 在 `updateDocument` 中根据服务端资源关系允许 Personal 正文、拒绝 Team 正文；删除仅属于 Team 模式的旧保存分支。

验收：现有非实时消费者不需要理解 Yjs；故障期间不会形成第二个正文权威来源。

当前进度：搜索读取 `documents.content` 派生快照，最近文档和收藏只读取文档元数据，Markdown 导出与打印读取当前编辑器状态。Team 正文的 `updateDocument(content)` 已改为只按服务端解析的 Workspace 类型拒绝，不再依赖功能开关或是否已经初始化协作状态；开关关闭时所有 Team 文档都只读显示现有 JSON 快照，重新启用后再从既有 Yjs 状态恢复或首次初始化。协作服务通过房间内无状态消息反馈持久化成功和失败，客户端只在 Provider 报告本地未同步更新时显示保存中。失败文档会保留在服务内存并周期重试，任一失败尚未恢复时 readiness 保持失败；最后一个客户端离开后恢复数据库仍可在无需新编辑的情况下完成持久化。真实 Chromium 双会话验收确认正文双向同步与数据库投影一致，注入不兼容状态版本后两端显示保存失败且数据库快照不前进，恢复版本后同一 Yjs 正文继续持久化；拦截 WebSocket 后页面显示只读快照，连接恢复后自动回到可编辑的相同正文。自动化 E2E 已覆盖最后客户端断开后的持久化重试场景，并为每个浏览器测试生成独立数据库资源；GitHub Actions CI #41 已在真实 PostgreSQL 下确认该场景通过。阶段 5 的实现与验收已经完成。

### 阶段 6：本地运行、CI 与生产部署

- 扩展 `scripts/local-runtime.ts`，在本地同时管理 Next.js、PGlite/PostgreSQL 和 Hocuspocus。
- 为 CI 启动协作服务并提供稳定端口、健康等待和清理。
- 增加生产协作 systemd unit、Nginx WSS 路由、环境变量和健康检查。
- 更新 release artifact 和部署脚本，使应用与协作服务来自同一 Git SHA。
- 在启用功能开关前完成公网 WSS 冒烟测试。

验收：本地、CI 和生产使用同一协议与授权路径；部署失败不会把应用切换到缺少协作服务的半版本。

当前进度：本地 `dev` 与 Playwright 模式已经按 `COLLABORATION_ENABLED` 条件启动 Hocuspocus，在数据库迁移后等待协作 `/ready` 再启动 Next.js，并监控异常退出和请求 Hocuspocus 优雅关闭。Windows 后台服务统一隐藏窗口，Next.js 直接通过 CLI 启动；退出时先请求 Hocuspocus 优雅持久化，再由独立隐藏的清理进程终止 Next.js/PGlite 进程树，并按本次实际 `PORT` 与协作端口配置复核监听 PID。真实 Windows 验收已连续两次确认默认开发栈在 `Ctrl+C` 后一秒内全部释放，清理辅助进程不残留且中间可以立即无冲突重启；运行时服务进程均没有可见主窗口。无 JavaScript Playwright 验收也确认使用 3008 时正常启动、通过并释放 3008、5432、1234 和 1235。CI E2E job 使用 PostgreSQL 17 service，并显式启用协作服务、真实 PostgreSQL 标记、稳定端口和 WebSocket URL；运行时在该模式下不启动 PGlite，而是迁移并复用外部数据库。GitHub Actions 已确认 build、static、40 个测试文件中的 137 项测试、19 项 E2E 和容器清理通过。生产 release 打包同 SHA 的 `collaboration-server.cjs`、systemd unit 与 Nginx snippets；部署通过独立 GitHub 开关与服务器开关一致性检查，依次验证协作 readiness、应用健康和公网 WSS Upgrade，失败时回滚软链接并重启两个服务。生产服务器已经完成 unit、Nginx 与环境变量安装，协作开关已启用，手动触发的完整 CI 再次通过双服务部署与公网 WSS Upgrade；阶段 6 已完成。真实登录双会话业务验收仍属于阶段 7 的启用确认。

### 阶段 7：文档、清理与启用

- 新 ADR Accepted 后更新 ADR 索引，并标记 ADR 0002 的被替代范围。
- 更新架构、渲染与数据流、文档业务、数据库和部署当前状态文档。
- 更新 `docs/PROBLEMS.md` 中本次实际发现并解决的重大问题，不记录机械改动。
- 功能开关小范围启用，验证真实双会话和权限撤回后再全面开启。
- 删除旧正文保存路径和临时兼容代码。

验收：当前状态文档只描述实际启用后的行为；全仓不再把正文协作描述为“计划中”或把旧自动保存描述为权威写入路径。

## 10. 测试计划

### 单元测试

- 服务端根据文档所属 Workspace 推导编辑模式，拒绝客户端伪造模式。
- room name 的合法、非法和跨资源解析。
- Presence 用户信息的服务端生成和敏感字段过滤。
- 当前全部 Tiptap 节点的 JSON → Y.Doc → JSON round-trip。
- Personal 保留 StarterKit Undo/Redo；Team 关闭它且协作撤销命令仍可用。
- 连接状态到 UI 文案的映射。
- 持久化节流和 flush 状态转换。

### 集成测试

- 同一 Team 文档并发首次初始化只产生一条协作状态。
- Personal 文档不能建立协作状态或进入 Hocuspocus 房间。
- `updateDocument(content)` 允许 Personal 文档并拒绝 Team 文档，且判断不信任客户端模式。
- Team 文档已有 Yjs 状态始终优先于 `documents.content` 初始化输入。
- store 在一个事务内更新二进制、JSON 快照、Schema 版本和更新时间。
- 投影失败、数据库失败和进程关闭不会提交半状态。
- viewer 写更新被拒绝，owner/editor 写更新成功。
- 非 Project 成员不能加载正文状态。
- 成员移除、角色降级、Session 撤销和文档删除使连接失效。
- 文档删除级联清理协作状态。
- 自定义节点在服务重启后保持结构和属性。

### E2E

- Personal 文档不连接协作服务，正文自动保存、刷新和重开后内容正确。
- 两个独立浏览器同时修改同一 Team 文档段落并看到合并结果。
- 两个用户同时插入、删除和格式化相邻内容。
- 远端光标、选区、用户名和离线状态正确更新。
- viewer 能看到实时更新但不能修改正文。
- editor 被降级或移除后，当前页面失去写入能力。
- 浏览器断线编辑、恢复网络并重连后不重复内容。
- 协作服务重启后客户端重连并恢复正文。
- 文档切换、返回和多标签页不会串用 Y.Doc。
- callout、details、task list、链接和代码块跨客户端保持一致。
- 搜索与 Markdown 导出在持久化完成后读取最新快照。
- 协作服务不可用时 Team 文档显示明确错误且不回退到旧自动保存，Personal 文档继续正常编辑和保存。

### 生产冒烟

- 公网 WSS 握手、认证、心跳和重连。
- 两个真实 Better Auth 账号的 owner/editor/viewer 权限组合。
- Nginx 空闲超时超过正常编辑停顿时间。
- systemd 重启、应用发布和数据库迁移顺序正确。
- 日志和错误响应不包含 cookie、令牌或正文。

## 11. 运行与可观察性

第一阶段至少记录以下指标：

- 当前连接数和活动文档数；
- 每分钟连接、重连和认证失败次数；
- read-only 写入拒绝次数；
- Yjs 状态加载和存储耗时；
- JSON 投影耗时与失败次数；
- 待持久化文档数量；
- 单文档状态大小和超过阈值的次数；
- 因 Session、权限或文档删除关闭的连接数。

告警优先覆盖持久化连续失败、投影连续失败、连接异常增长和进程反复重启。Presence 丢失可以通过重连恢复；正文持久化失败必须显式呈现并告警。

单实例达到容量边界后再评估：

- 按文档 ID 分片多个 Hocuspocus 实例；
- Hocuspocus Redis 扩展或其他跨实例同步；
- 大文档压缩、状态更新日志与定期 compact；
- 独立协作服务部署和容量隔离。

这些不进入第一阶段实现。

## 12. 建议提交拆分

1. `docs: define the document collaboration architecture`
2. `build: add Yjs and Hocuspocus dependencies`
3. `feat: persist document collaboration states`
4. `feat: add the authenticated collaboration server`
5. `feat: connect the document editor to Yjs`
6. `test: cover concurrent document collaboration`
7. `build: deploy the collaboration service`
8. `docs: document the collaborative writing flow`

若某个行为与对应 ADR、Schema 或当前状态文档必须一起变更，应放在同一个可审查提交中，不机械拆开。

## 13. 完成定义

只有同时满足以下条件，文档实时协作写作才算完成：

- 文档资源、ProseMirror Schema、权限、读取、搜索、收藏和导出保持统一，没有拆分 Personal/Team 文档业务模型。
- Personal 正文唯一权威写入路径仍是经过服务端授权和校验的 `updateDocument(content)`，且不创建协作状态或 WebSocket。
- Team 正文唯一权威写入路径是 Yjs/Hocuspocus，`updateDocument(content)` 必须拒绝 Team 文档。
- 每篇已激活的 Team 文档存在可恢复的 Yjs 二进制状态，ProseMirror JSON 是经过验证的派生快照。
- 编辑模式只由服务端根据 Workspace 类型推导，客户端不能扩大权限或切换存储模式。
- 未登录和非 Project 成员无法读取协作状态；viewer 无法写入。
- 权限与 Session 变化能够使已有连接在定义时限内失效。
- 两个浏览器并发编辑、断线重连、服务重启和自定义节点测试通过。
- 搜索、最近文档、收藏、Markdown 导出和打印继续正常工作。
- 本地运行、CI、Nginx、systemd、健康检查和日志脱敏已完成。
- 功能启用后的回滚边界和只读降级流程已经验证。
- 新 ADR 已正确替代 ADR 0002 的相关决策；架构、文档业务、数据库和部署文档与实现一致。
- `npm run lint`、`npm run check:types`、`npm run test`、`npm run test:e2e`、`npm run build-local` 和 `git diff --check` 全部通过。

## 14. 预计工期

单人预计 9–14 个工作日：

- 架构、Schema 和转换验证：2–3 天；
- 协作服务、持久化与权限：3–4 天；
- 编辑器、Presence 和故障体验：2–3 天；
- 测试、部署、文档和生产启用：2–4 天。

推荐严格按“ADR → Schema/转换 → 服务端持久化 → 身份授权 → 编辑器 → 投影消费者 → E2E/部署 → 小范围启用”执行。在服务端持久化、权限失效和回滚策略验证前，不应先把正文编辑器切换到 Yjs。

## 15. 相关代码和文档

- `src/features/documents/Document.ts`
- `src/features/documents/DocumentSchema.ts`
- `src/features/documents/DocumentExtensions.ts`
- `src/features/documents/components/DocumentEditor.tsx`
- `src/features/documents/components/DocumentEditorToolbar.tsx`
- `src/features/documents/components/DocumentSaveStatus.tsx`
- `src/features/documents/server/GetProjectDocuments.ts`
- `src/features/documents/server/UpdateDocument.ts`
- `src/features/permissions/server/DocumentAuthorization.ts`
- `src/features/permissions/server/ProjectAuthorization.ts`
- `src/features/notifications/server/NotificationDatabaseSubscriber.ts`
- `src/libs/Auth.ts`
- `src/libs/DB.ts`
- `src/libs/Env.ts`
- `src/models/Schema.ts`
- `scripts/local-runtime.ts`
- `.github/workflows/CI.yml`
- `docs/features/documents.md`
- `docs/architecture/rendering-and-data-flow.md`
- `docs/database/schema-and-migrations.md`
- `docs/operations/deployment.md`
- `docs/adr/0002-use-versioned-prosemirror-json.md`
- `docs/adr/0006-separate-workspace-discovery-from-project-content-access.md`
- `docs/adr/0011-use-postgresql-notify-for-realtime-delivery.md`

## 16. 实施参考

- Tiptap Collaboration：https://tiptap.dev/docs/editor/extensions/functionality/collaboration
- Tiptap Collaboration Caret：https://tiptap.dev/docs/editor/extensions/functionality/collaboration-caret
- Hocuspocus Provider React bindings：https://tiptap.dev/docs/hocuspocus/provider/react
- Hocuspocus Authentication：https://tiptap.dev/docs/hocuspocus/guides/authentication
- Hocuspocus Persistence：https://tiptap.dev/docs/hocuspocus/guides/persistence
- Hocuspocus Database extension：https://tiptap.dev/docs/hocuspocus/server/extensions/database
