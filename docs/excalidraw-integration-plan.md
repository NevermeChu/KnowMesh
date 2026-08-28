# KnowMesh Excalidraw 白板集成计划

状态：In progress（阶段 1–4 代码完成；阶段 0 浏览器 spike、生产灰度，以及重连/进程重启类验收仍待完成）

本文规划把 Excalidraw 白板纳入现有 Document 领域模型的实施路径。计划中的表、字段、组件、服务和环境变量均为建议名称，不代表当前仓库已经存在；实施时必须以当时的代码、已安装包和 Accepted ADR 为准。

## 1. 目标

Excalidraw 白板应成为一种可寻址的文档，而不是项目外的独立资源：

- 白板与富文本文档共用 `documents.id`、标题、Project 归属、父子关系、排序、权限、收藏和导航入口。
- 白板既可以是项目根文档，也可以作为任意富文本文档或白板的子文档；父子关系不限制内容类型。
- 同一个文档 ID 在移动或改名后保持稳定，为未来从富文本或其他白板链接跳转提供目标身份。
- Personal Workspace 白板使用单人自动保存，不建立实时连接。
- Team Workspace 白板最终支持 `owner`、`editor` 实时协作和 `viewer` 实时只读，并沿用当前 Project 直接成员授权边界。
- 富文本继续使用 Tiptap/ProseMirror；Team 富文本继续使用 Yjs/Hocuspocus。白板不得把 Excalidraw scene 写入 ProseMirror JSON 或 `document_collaboration_states`。
- 白板首次上线不改变现有富文本文档的读取、保存、协作和导出行为。

目标结构：

```text
Document 资源（统一身份、树、权限、标题、收藏）
├─ rich-text
│  ├─ Personal → documents.content（ProseMirror JSON 权威）
│  └─ Team     → document_collaboration_states.state（Yjs 权威）
│                └─ documents.content（ProseMirror JSON 派生投影）
└─ whiteboard
   ├─ Personal → document_whiteboard_states.scene（Excalidraw scene 权威）
   └─ Team     → Whiteboard Collaboration Adapter（Excalidraw 合并语义）
                  └─ document_whiteboard_states.scene（持久化权威快照）
```

## 2. 当前基线

当前实现只有一种文档内容类型：

- `documents` 已支持 `parent_id` 自引用，因此根文档、子文档、拖拽移动、深层路径和级联删除不需要为白板重新建树。
- `documents.content` 非空且固定保存版本化 ProseMirror JSON；`DocumentSchema` 只接受当前 Tiptap Schema。
- `createDocument` 只接收 `projectId`、可选 `parentId` 和 `title`，创建时默认写入空 ProseMirror 文档。
- `DocumentEditorDispatcher` 只根据 Workspace 和协作功能开关推导的 `single-user | collaborative | collaborative-readonly` 选择 Tiptap 编辑器。
- Personal 正文通过 `updateDocument(content)` 和 `updated_at` 乐观并发控制保存；Team 正文通过 Hocuspocus/Yjs 保存。
- 导航、搜索、收藏、面包屑和最近访问当前默认所选资源都是富文本文档。
- 文件链接和反向链接尚未实现。

因此不能只在页面中渲染 `<Excalidraw />`。必须先增加服务端可信的文档内容类型，再让读取、写入、编辑器、搜索、导出和协作按类型分流。

## 3. 范围

### 3.1 第一条可交付链路

- 新建 `rich-text` 或 `whiteboard` 文档。
- 在项目根节点或任意文档下创建白板。
- 侧边栏、面包屑、收藏和最近访问使用白板图标并保持现有导航行为。
- Personal 白板加载、编辑、自动保存、冲突提示和重新打开恢复。
- 基础绘图能力：形状、文本、箭头、连线、自由绘制、选择、缩放、撤销和重做。
- 白板导出为 `.excalidraw`、PNG 和 SVG。
- 标题搜索可以找到白板；白板正文暂不参与全文索引和摘要。
- 通过功能开关灰度发布，并可在不修改或丢失已保存 scene 的情况下切回只读。

### 3.2 Team 协作交付链路

- Team 白板的双向同步、在线成员和远端指针。
- `owner`、`editor` 可写，`viewer` 只读。
- Project 角色变化、成员移除、Session 失效、文档删除或移出可访问 Project 后及时冻结或关闭连接。
- 服务重启、短时断线重连、持久化失败和发布回滚时保持明确的保存状态与权威边界。
- 两个真实浏览器上下文验证同一元素、不同元素、删除与编辑等并发场景。

### 3.3 暂不包含

- 富文本到白板、白板到富文本或白板元素到其他文档的内部链接与反向链接。
- 把白板嵌入富文本正文；本计划只实现“白板作为子文档”，不是内联画布节点。
- 文档类型转换；`rich-text` 与 `whiteboard` 创建后不可互转。
- 白板正文全文搜索、OCR、图形语义检索或缩略图搜索。
- 评论、审阅、版本历史、时间旅行、公开分享链接和匿名协作。
- 长期离线编辑和跨设备离线合并。
- Excalidraw+、外部 Excalidraw 房间或 Firebase 作为 KnowMesh 的持久化权威。
- 第一条可交付链路中的图片上传、粘贴图片和文件附件；见第 10 节的独立资产阶段。

## 4. 核心设计决策

### 4.1 一个 Document 资源，多种内容载荷

在 `documents` 增加非空内容类型字段，建议领域值为：

```text
rich-text | whiteboard
```

现有记录迁移为 `rich-text`，数据库默认值也暂设为 `rich-text`，确保旧创建路径在迁移和回滚窗口内不会产生未分类数据。新代码必须显式传入类型，不能长期依赖默认值。

内容类型只描述载荷，不改变以下语义：

- `project_id` 决定资源与授权边界。
- `parent_id` 决定树位置；父子文档可以是任意类型组合。
- `sort_order`、标题、收藏、创建者和审计继续属于 Document 资源。
- 文档类型不能由客户端路由、图标、父文档类型或 Workspace 类型推断；服务端必须读取数据库值。

### 4.2 白板 scene 使用独立表

建议新增一对一表 `document_whiteboard_states`：

| 字段 | 计划语义 |
| --- | --- |
| `document_id` | 主键并外键引用 `documents.id`，删除文档时级联删除 |
| `scene` | 经过服务端结构与大小校验的 Excalidraw scene JSON |
| `scene_schema_version` | KnowMesh 对持久化 envelope 的版本，不等同于 npm 包版本 |
| `revision` | 单调递增的持久化版本；Personal 乐观并发和 Team 保存确认共同使用 |
| `created_at` / `updated_at` | 初始化与最近成功持久化时间 |

不把 scene 直接放入 `documents.content`，原因是：

- Accepted ADR 0002 和 0012 已分别定义 Personal/Team 富文本内容的 ProseMirror/Yjs语义。
- `DocumentSchema`、Markdown 导出和 `extractPlainText` 都假定 `documents.content` 是 ProseMirror 树。
- 独立表可以为 scene 版本、并发 revision、大小限制和未来资产引用建立白板专用不变量。
- `document_collaboration_states` 只保存 Tiptap 使用的 Yjs 二进制状态；混用会让 transformer、恢复和迁移无法判断载荷协议。

为减少首轮迁移范围，`documents.content` 和 `search_text` 可暂时为白板保留现有空 ProseMirror 默认值，但任何白板读写、导出或搜索逻辑都不得把它当作白板正文。后续若要把富文本载荷也规范化到独立表，应另立迁移计划，不在本功能中顺带重构。

白板创建必须在同一数据库事务中插入 `documents(kind = whiteboard)` 和空 scene；失败时不得留下只有 Document 而没有白板状态的半成品。服务端拒绝：

- 为 `rich-text` 文档创建或更新白板状态；
- 为 `whiteboard` 文档初始化 Yjs 富文本协作状态；
- 通过 `updateDocument(content)` 修改白板；
- 通过白板保存入口修改 Team 白板或其他类型文档。

实施阶段应决定由数据库触发器还是应用事务加集成测试执行跨表类型约束。若只由应用执行，当前状态文档必须明确数据库不能独立保证该不变量。

### 4.3 scene envelope 与校验

KnowMesh 保存自己的版本化 envelope，内容至少包含：

- Excalidraw `elements`；
- 允许持久化的 `appState` 白名单；
- `files` 映射（第一阶段必须为空）；
- KnowMesh scene schema 版本和来源标识。

不得原样保存整个运行时 `appState`。选区、当前工具、视口、协作者、弹窗、错误状态和其他临时 UI 状态不属于业务内容。服务端必须使用 Zod 和显式限制验证：

- envelope 与字段类型；
- 序列化后的最大字节数、元素数和嵌套深度；
- 非有限数字、超长文本和异常坐标；
- 第一阶段不存在二进制文件或 data URL；
- 不接受客户端提交的权限、用户身份、revision 或服务端保存状态。

读取时先经过 KnowMesh envelope 升级，再交给当前已安装版本的 Excalidraw `restore`/`initialData` 路径。升级依赖时必须用真实旧 scene fixture 验证兼容性；不能因为 npm 版本变化自动递增 `scene_schema_version`。

### 4.4 编辑器按“内容类型 × 运行模式”分发

编辑器选择需要两个服务端可信维度：

| 内容类型 | Personal | Team 服务可用 | Team 服务关闭或不可用 |
| --- | --- | --- | --- |
| `rich-text` | 现有 `DocumentEditor` | 现有 `CollaborativeDocumentEditor` | 现有只读快照 |
| `whiteboard` | `PersonalWhiteboardEditor` | `CollaborativeWhiteboardEditor` | 最近成功 scene 的只读白板 |

建议让 `DocumentEditorDispatcher` 先按 `document.kind` 分流，再按 Workspace 类型和相应功能开关选择运行模式。不要把白板伪装成现有 `collaborative` 模式后复用 Tiptap 分支，也不要让客户端自行声明 Personal/Team。

Excalidraw 是浏览器组件。Next.js 集成应使用 client component 和关闭 SSR 的动态加载，同时导入包样式并保证画布父容器有明确高度。白板加载不得阻塞未选择白板时的主应用 bundle。

共享 `ContentToolbar` 只保留标题、收藏、导出、保存状态和全屏等资源级命令。Tiptap 格式命令不得在白板激活时出现；画布工具由 Excalidraw 自身 UI 管理。

### 4.5 复用协作治理，不复用 Yjs 状态协议

KnowMesh 可以复用现有协作平台中的：

- Better Auth Cookie 身份验证；
- `document.read` / `document.update` 与 Project 直接成员授权；
- same-origin、连接数、消息大小、速率限制和脱敏日志；
- Session、成员、角色、文档移动和删除的失效通知模式；
- readiness、单写实例租约、失败持久化重试、发布和回滚规范。

不得复用：

- Hocuspocus Provider；
- Tiptap `Collaboration` / `CollaborationCaret`；
- Y.Doc、Y.XmlFragment 或 `document_collaboration_states`；
- 富文本 transformer 和 ProseMirror JSON 投影。

官方 `@excalidraw/excalidraw` React 包提供画布组件，但实时协作仍由 Excalidraw 应用层实现。官方应用当前使用 Socket.IO、浏览器端 scene reconciliation、Firestore 事务和独立文件持久化；`excalidraw-room` 自身标明为示例协作服务器。因此 KnowMesh 不应直接部署示例服务，也不应未经专项验证引入社区 `y-excalidraw` 绑定。

`excalidraw-room` 可以作为 Socket.IO 事件和房间生命周期的参考，但其当前实现只是转发客户端提交的房间消息：默认 CORS 可开放为任意 Origin，房间 ID 由客户端提交，没有 Better Auth、Document/Project 授权、viewer 只读、消息 Schema/大小限制、PostgreSQL 持久化、保存确认、权限撤回或业务 readiness。Nginx 只能在握手层验证请求，无法对握手后的 `join-room` 和 `server-broadcast` 事件执行文档级能力判断。若在它上面补齐这些边界，实质上就是实现 KnowMesh 的 Whiteboard Collaboration Adapter，而不是直接部署原示例。

推荐新增独立 Whiteboard Collaboration Adapter，首版以独立进程和独立 WebSocket 路径部署，使其故障、功能开关和回滚不影响已稳定的 Tiptap 协作服务。它可以复用权限与失效模块，但必须拥有白板专用协议、存储和指标。若实施前 spike 证明可以无耦合地共享 HTTP 监听与生命周期，再通过 ADR 决定是否合并部署单元。

## 5. Personal 白板保存流程

计划新增白板专用 Server Action，例如 `updatePersonalWhiteboard`：

```text
Excalidraw onChange
  → 过滤持久化字段并合并短时间内的变化
  → updatePersonalWhiteboard(documentId, scene, expectedRevision)
  → requireUser
  → authorizeDocument(document.update)
  → 事务内锁定 Document 与 whiteboard state
  → 重新验证 kind = whiteboard、Workspace = personal、revision 一致
  → revision + 1 并保存 scene
  → 返回新 revision
```

保存行为沿用 Personal 富文本已验证的生命周期原则：

- 保存请求串行执行；编辑继续发生时保留待保存的最新 scene。
- 页面隐藏、路由切换和卸载前立即冲刷。
- 仍有未完成保存时启用离页提示。
- revision 冲突时停止覆盖，保留本地 scene 并提示刷新或导出备份；不得静默以后写覆盖。
- 保存失败时显示明确状态，不把失败误报为“已保存”。
- 标题仍使用当前独立 `title_version` 路径；scene 保存不应制造标题冲突。

Personal 白板不建立 Socket.IO、Hocuspocus、Y.Doc 或 Awareness 连接。

## 6. Team 白板协作流程

### 6.1 已验证的 Excalidraw API 边界

2026-08-28 使用官方 npm registry 锁定并验证 `@excalidraw/excalidraw@0.18.1`：

- 包根公共类型和运行时入口均导出 `reconcileElements`，peer dependency 声明支持 React 19。
- 使用 KnowMesh 对应的 React 19.2.6、Next.js 16.2.6 和 TypeScript `moduleResolution: bundler` 时，类型检查与 client-only Turbopack 生产构建通过。
- Node 24 直接导入包根会因包内 JSON import 缺少 attribute 而失败；尝试打包后仍会在模块初始化时访问 `window`。
- `@excalidraw/excalidraw/data/reconcile` 只有类型子路径，运行时深层导入被包 `exports` 阻止。

因此 `reconcileElements` 在该锁定版本中只作为浏览器端公共 API 使用。Whiteboard Collaboration Adapter 不得直接导入 `@excalidraw/excalidraw`，也不得从未公开的 `dist` 路径取出算法。升级版本时必须重新执行类型、Next.js 生产构建和双客户端 fixture；当前验证不自动证明未来版本兼容。

### 6.2 实施前协议 spike

Team 阶段开始前先做一个不进入生产的 spike，并形成新的 ADR。Spike 必须回答：

1. 客户端提交全量 syncable elements 还是有界增量，以及服务端对候选 scene 执行哪些结构、大小和版本校验。
2. 浏览器收到 revision 冲突后如何使用官方 `reconcileElements` 合并本地候选与最新 canonical scene，并进行有界重试。
3. 删除 tombstone 保留多久，何时可压缩，以及旧连接如何被阻止复活已删除元素。
4. scene revision、房间内存状态与 PostgreSQL 提交确认如何对应；广播不得早于数据库提交。
5. 同一元素同时编辑、元素删除与编辑、绑定箭头、文本容器和复制粘贴的收敛结果。
6. 服务崩溃、数据库失败、网络重连和权限撤回时客户端何时冻结编辑。
7. 独立进程还是共享监听器，以及 Socket.IO 依赖对现有部署的影响。

只有 spike 的双客户端自动化场景稳定收敛、旧 scene 可恢复、类型/API 入口可锁定后，才能进入 Team 实现。若不满足，不得用最后写入覆盖冒充协作。

### 6.3 推荐房间与持久化语义

推荐流程：

```text
连接 whiteboard:<documentId>
  → same-origin + Better Auth Session
  → 查询 Document kind、Project 直接成员能力
  → 加载 canonical scene + revision
  → 浏览器使用官方 reconcileElements 合并基线与本地状态
  → 客户端提交 candidate scene + expectedRevision
  → 服务端校验身份、能力、kind、scene Schema 与大小
  → PostgreSQL 事务执行 compare-and-swap
      ├─ revision 一致：保存 candidate，revision + 1
      │   → 提交后广播 persisted scene + revision，并确认保存
      └─ revision 冲突：返回最新 canonical scene + revision
          → 浏览器 reconcile 后携带新 revision 有界重试
```

该流程把两类责任分开：浏览器使用官方算法解决 Excalidraw 元素版本、删除、绑定和顺序的语义冲突；服务端通过强制 `expectedRevision` 和数据库事务阻止陈旧 scene 覆盖已提交更新。服务端不重新实现 Excalidraw 合并算法，但仍是持久化顺序、授权和成功确认的权威。

关键不变量：

- 房间 ID 只标识资源，不能证明访问权。
- `viewer` 可以接收 scene 和 Presence，但服务端拒绝其 scene 更新。
- 每次重连先取得服务端完整基线；第一阶段不允许断线期间继续编辑。
- Team scene 写入必须携带 `expectedRevision`；服务端不得提供无条件覆盖入口。
- revision 冲突不是保存失败终态。浏览器必须先把最新 canonical scene 与仍待保存的本地变更 reconcile，再以新 revision 重试；重试超过上限时冻结编辑并保留可导出的本地副本。
- 同一客户端的本地编辑、远端广播、冲突响应和保存确认必须进入一个串行状态机，避免旧响应覆盖更晚的本地变更。
- 客户端只有收到与本地提交对应的数据库成功确认后才显示“已保存”。
- 数据库失败时不得把内存广播标记成已持久化；readiness 失败并冻结或明确标记未保存状态。
- 服务端只广播已经提交的 scene 与 revision；房间内存状态不能单独成为权威。
- 服务端广播的身份和颜色来自认证上下文；客户端 Presence 不得自报用户身份。
- Project 角色降级、成员移除、Session 撤销和 Document 删除必须复用数据库提交后失效机制并在有界时间内关闭或降级连接。
- 白板协作功能关闭时只读取最近一次成功 scene，不允许回退到 Personal Server Action 写入。

删除元素的 tombstone 是浏览器 reconciliation 的一部分，但也可能保留已删除文本。ADR 必须记录 tombstone 压缩、隐私和旧客户端重连策略；服务端不得自行删除不理解的元素字段，没有可证明的防复活条件前不得直接移除 tombstone。

## 7. 创建、树与导航

### 7.1 创建入口

项目加号、文档悬停加号和右键“新建子文件”统一增加类型选择：

- 富文本文档；
- Excalidraw 白板。

`createDocumentSchema` 增加显式 `kind`。`createDocument` 在现有事务和项目锁内：

1. 重新验证 `document.create`；
2. 验证父文档仍属于目标 Project；
3. 计算同级 `sort_order`；
4. 插入 Document；
5. 若为白板，插入初始 scene；
6. 返回包含 `kind` 的导航项。

创建白板不要求父节点也是白板。创建、移动、删除和跨项目迁移继续以整棵文档子树为单位，白板状态通过 Document 外键级联，不增加第二套移动逻辑。

### 7.2 导航读取

以下元数据 DTO 和查询都需要增加 `kind`，但不能增加 scene：

- Workspace 初始导航；
- `getDocumentNavigationChildren`；
- `getDocumentNavigationPath`；
- 面包屑、搜索、收藏和最近访问结果。

导航只能用类型选择图标和路由，不得返回内容预览。白板沿用当前 `?project=<id>&document=<id>` 定位方式，直接打开深层白板时继续只加载祖先路径，不扫描整棵树。

## 8. 读取、搜索、收藏与导出

- `getProjectDocuments` 先读取 Document 元数据和授权，再按 `kind` 只读取所需载荷。无正文权限时不得查询或序列化 scene。
- `Document` 前端类型应改为以 `kind` 为判别字段的联合类型，避免白板组件误收到 ProseMirror content，也避免大量可选字段和强制断言。
- 收藏仍以 `document_id` 为键，无需新增白板收藏表。
- 全站搜索第一阶段只匹配白板标题；结果不显示正文片段。富文本标题与正文排序保持不变。
- Markdown 下载、复制 Markdown 和富文本打印只在 `rich-text` 显示。
- 白板使用当前画布状态导出 `.excalidraw`、PNG 和 SVG；导出不改变数据库权威状态。
- 导入 `.excalidraw` 属于破坏性整场景替换，第一阶段不开放。后续若增加，必须经过大小/类型校验、权限检查、revision 冲突保护和明确确认。

## 9. 文件链接的未来兼容边界

本计划不实现文件链接，但白板作为 Document 后天然具备稳定目标 ID。当前阶段必须保留以下兼容性：

- 未来内部链接以 `documentId` 为目标身份，不能持久化父子路径或标题作为唯一目标；移动和改名不得使链接失效。
- 链接解析与路由跳转由统一 Document link resolver 负责，富文本 marks 和 Excalidraw element link 只作为编辑器适配器。
- 不在本计划中提前创建 backlinks 表、解析 ProseMirror marks 或把 Excalidraw 普通 URL 猜成内部链接。
- 第一阶段应隐藏或审计 Excalidraw 元素链接入口，至少拒绝不安全 URL scheme；不能因为内部链接尚未实现而留下可执行 `javascript:` 等导航入口。
- 将来实现链接时，必须分别验证目标存在、当前用户 `document.read`、跨 Workspace 可见性和目标删除后的降级显示。

## 10. 图片与二进制资产阶段

Excalidraw 图片元素只在 scene 中保存文件引用，二进制文件需要独立生命周期。KnowMesh 当前没有为白板设计的对象存储，因此第一条可交付链路应禁用图片工具、粘贴图片、拖入图片和带文件的 scene 导入，并给出明确提示；不得把 data URL 无上限写入 JSONB。

启用图片前必须另行完成：

- 选择 PostgreSQL 小对象或 S3 兼容对象存储并记录 ADR；
- `document_id + file_id` 所有权、MIME、大小、哈希和引用关系；
- 上传授权、下载授权、配额、病毒/内容检查和跨 Workspace 隔离；
- scene 提交与资产引用的一致性、孤儿回收和文档级联删除；
- Team 房间中文件可用状态、失败重试和 viewer 读取；
- 导出 `.excalidraw`、PNG、SVG 时的文件解析；
- 账户删除、Project 移动、备份、恢复和生产回滚。

## 11. 分阶段实施

### 阶段 0：架构验证与决策

状态：进行中。公共 API 边界与 ADR 已完成；浏览器 UI、导出和 Team 协作 spike 尚未完成。

- [x] 已锁定并验证 `@excalidraw/excalidraw@0.18.1` 的类型入口、浏览器根运行时入口、React 19 和 Next.js 16 client-only 生产构建；已确认该根入口不能直接运行于 Node 24。
- [ ] 用最小页面验证 CSS、动态加载、主题、中文 locale、容器尺寸和生产构建。
- [ ] 用 fixture 验证 scene restore、JSON/PNG/SVG 导出和包升级兼容性。
- [ ] 完成浏览器 reconciliation + 服务端 revision compare-and-swap 的 Team 双客户端 spike。
- [x] 新增 [ADR 0016](adr/0016-use-document-kind-and-excalidraw-scene-protocol.md)，明确文档 kind、白板状态表、Personal/Team 权威状态、协作协议和拒绝 Yjs 混用的原因。

验收：没有修改生产数据；浏览器运行时 API 均来自锁定包的公共根 `exports`；服务端不导入 Excalidraw 浏览器包；Team 协作未通过 spike 时只批准 Personal 阶段。

### 阶段 1：领域模型与迁移

状态：代码完成；PGlite 迁移集成测试已通过，真实 PostgreSQL 验收待完成。

- [x] 新增文档类型枚举、`documents.kind` 和 `document_whiteboard_states`。
- [x] 迁移把存量记录回填为 `rich-text`，集成 fixture 验证正文不变。
- [x] 更新 Drizzle Schema、迁移快照和数据库当前状态文档。
- [x] 增加 scene envelope、空 scene、Zod 校验、大小限制和 fixture。
- [x] 创建事务维护白板状态，删除使用数据库级联；数据库延迟约束禁止缺失或错误类型的载荷状态，未增加类型转换入口。

验收：旧文档全部仍可读取；白板状态与 Document 一对一；错误类型写入被拒绝；级联删除无孤儿记录；迁移可在真实 PostgreSQL 验证。

### 阶段 2：创建、导航与只读加载（已完成）

- [x] 创建对话框增加文档类型选择，根节点和子节点共用同一流程。
- [x] 所有导航 DTO、路径、面包屑、收藏、最近访问和搜索结果携带 `kind`。
- [x] 侧边栏使用不同图标，混合类型树仍支持懒加载、移动和删除。
- [x] `Document` 改为判别联合，读取路径按授权与类型加载载荷。
- [x] 新增只读白板组件，验证深链打开和无权限状态不泄露 scene。

验收：已通过真实迁移数据库集成测试验证混合子树跨项目移动、viewer 读取与非成员隔离；已通过 Chromium 验证从侧边栏创建白板、跳转和只读画布加载。

### 阶段 3：Personal 编辑与导出（已完成）

- [x] 动态加载 Excalidraw 客户端和样式，关闭 SSR 并使用同源自托管字体资产。
- [x] 接入受控的 `initialData`、`onChange`、主题和语言。
- [x] 实现 scene 过滤、串行自动保存、revision 冲突、离页冲刷和状态 UI。
- [x] 接入 `.excalidraw`、PNG、SVG 导出。
- [x] 隐藏富文本格式与 Markdown 命令，禁用未支持的图片/导入/链接入口。

验收：已通过保存队列单元测试、真实迁移数据库 CAS 集成测试和 Chromium 端到端测试，覆盖编辑、刷新恢复、失败重试、冲突停写和三种导出。Personal 白板不建立实时连接；集成测试验证 scene 保存不改写 `documents.content` 或 `search_text`。

### 阶段 4：Team 协作服务与客户端（代码完成；真实 PostgreSQL 双上下文验收已通过；生产灰度待开启开关后完成）

- [x] 按阶段 0 ADR 实现独立 Whiteboard Collaboration Adapter（Socket.IO、CAS、Presence、失效订阅与单写租约）。
- [x] 接入 Better Auth、Project 权限、只读 scope、限流、readiness 和独立功能开关。
- [x] 服务端实现基线同步、scene 校验、revision compare-and-swap、提交后 canonical 广播和 PostgreSQL 保存确认；不执行 Excalidraw reconciliation。
- [x] Team 客户端使用官方 `reconcileElements` 实现远端合并、冲突重试及连接/同步/保存失败/只读/权限撤回状态，不回退 Personal 保存。
- [x] 增加 Env.ts 校验、本地运行编排、Nginx、systemd 和发布回滚配置。
- [x] 真实 PostgreSQL 与两个 Playwright Chromium 上下文覆盖 canonical 同步、viewer、角色降级、成员移除和 Session 撤销。
- [ ] 重连、协作进程重启和服务关闭只读仍待补验收。

### 阶段 5：资产能力

- 按第 10 节完成资产 ADR、存储、授权和生命周期。
- 重新启用图片工具、粘贴、拖入和带文件导出。

验收：图片在 Personal/Team、刷新、协作、导出、权限撤回和文档删除场景中均不泄露、不丢失、不产生永久孤儿。

### 阶段 6：文档链接（独立计划）

- 先定义跨编辑器的稳定 Document link 模型和授权解析器。
- 再分别接入 Tiptap link mark、Excalidraw element link、跳转和 backlinks。

该阶段不阻塞白板文档上线，也不得在前面阶段以临时 URL 格式提前固化协议。

## 12. 测试矩阵

### 单元测试

- scene envelope、持久化字段白名单、大小限制和旧 fixture 升级；
- `Document` 判别联合与编辑器分发；
- Personal 保存队列、revision 冲突、离页状态；
- 浏览器 `reconcileElements` fixture、冲突重试状态机和 tombstone 策略；
- Team 服务端协议消息校验、revision compare-and-swap、重试上限和 Presence 身份净化；
- 类型与 Workspace 不匹配时的服务端拒绝。

### 集成测试

- 存量迁移回填和初始白板事务；
- 根/子白板创建、混合树移动、跨项目移动、级联删除；
- 白板读取、保存、收藏和标题搜索的 Project 直接成员边界；
- `updateDocument(content)` 拒绝白板，Personal 白板入口拒绝 Team；
- 协作状态表和白板状态表不交叉写入；
- PostgreSQL 保存失败、并发 compare-and-swap、revision 单调递增和重启恢复。

### E2E

- 创建根白板和子白板，直接打开深层 URL，刷新后恢复；
- Personal 绘制、自动保存、离页提示、冲突和三种导出；
- Team 两会话编辑不同元素、同一元素、删除与编辑、文本容器和绑定箭头；
- viewer 只读、角色降级、成员移除、Session 撤销和重连；
- 功能开关关闭后只读，不调用错误写入链路；
- 无权用户只能看到允许发现的导航元数据，不能取得 scene；
- 图片、导入和内部链接在对应阶段前确实不可用。

Windows 本地浏览器测试继续串行运行以减少冷启动噪声；Team 最终验收必须使用真实 PostgreSQL，不能用 PGlite 证明 `LISTEN/NOTIFY` 和实时失效行为。

## 13. 发布、观测与回滚

建议使用两个独立开关：

- 白板文档读取/创建与 Personal 编辑；
- Team 白板实时协作。

环境变量必须在 `Env.ts` 验证，代码不得直接读取 `process.env`。发布顺序：

1. 先部署向后兼容迁移和只认识 `rich-text` 默认值的新代码。
2. 再开启内部白板创建和 Personal 编辑。
3. Team 服务通过 readiness、权限和双浏览器验收后单独灰度。
4. 观察 scene 保存失败、revision 冲突、房间数、连接数、拒绝写入、消息大小、持久化延迟和权限失效延迟。
5. 最后评估是否进入资产阶段。

回滚不得删除 `documents.kind` 或白板状态。应用回滚到不支持白板的版本前应先关闭创建与编辑，并提供白板只读/导出路径；禁止把 scene 转写为空 ProseMirror 文档以伪装兼容。

## 14. 完成定义

基础白板只有同时满足以下条件才可称为完成：

- 白板作为 Document 可在根或任意父文档下创建、移动、收藏、搜索标题和删除。
- Personal 白板的 scene 有独立权威状态、并发保护、错误状态和可恢复导出。
- 现有富文本 Personal/Team 全部回归通过，且没有白板载荷进入 ProseMirror/Yjs 路径。
- 所有服务端入口重新验证 Document kind、Workspace 类型和 Project 能力。
- Team 白板经过真实双会话合并、viewer 只读、权限撤回、断线重连、持久化失败和进程重启验证。
- 图片、导入和文件链接若尚未实施，在 UI、协议和验收中均明确不可用，而不是仅在文档里标注。
- 同一变更更新 `features/documents.md`、`database/schema-and-migrations.md`、相关 architecture/operations 文档；重要取舍进入新 ADR，发现的重大工程问题按规范写入 `PROBLEMS.md`。

## 15. 相关代码与决策

当前实现入口：

- `src/models/Schema.ts`
- `src/features/documents/Document.ts`
- `src/features/documents/DocumentSchema.ts`
- `src/features/documents/components/DocumentEditorDispatcher.tsx`
- `src/features/documents/components/DocumentWorkspace.tsx`
- `src/features/documents/components/CreateDocumentDialog.tsx`
- `src/features/documents/server/CreateDocument.ts`
- `src/features/documents/server/GetProjectDocuments.ts`
- `src/features/documents/server/GetDocumentNavigation.ts`
- `src/features/documents/server/MoveDocument.ts`
- `src/features/documents/server/UpdateDocument.ts`
- `src/features/documents/collaboration/`
- `src/features/permissions/server/DocumentAuthorization.ts`

现有约束：

- [文档业务当前状态](features/documents.md)
- [数据库 Schema 与迁移](database/schema-and-migrations.md)
- [ADR 0002：文档内容使用版本化 ProseMirror JSON](adr/0002-use-versioned-prosemirror-json.md)
- [ADR 0012：Team 文档使用 Yjs 权威状态与 ProseMirror JSON 派生快照](adr/0012-use-yjs-for-team-document-collaboration.md)
- [ADR 0014：使用浏览器 Yjs 副本缩小协作硬崩溃丢失窗口](adr/0014-use-browser-yjs-replicas-for-crash-recovery.md)
- [ADR 0015：按节点加载文档导航树](adr/0015-lazy-load-document-navigation.md)

外部一手资料（实施时重新核对当前版本）：

- [Excalidraw React 包 README](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/README.md)
- [Excalidraw 官方应用协作实现](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/collab/Collab.tsx)
- [Excalidraw 官方应用 Firebase 持久化实现](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/data/firebase.ts)
- [excalidraw-room 示例服务说明](https://github.com/excalidraw/excalidraw-room/blob/master/README.md)
- [excalidraw-room 当前服务端源码](https://github.com/excalidraw/excalidraw-room/blob/master/src/index.ts)
