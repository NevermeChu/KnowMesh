# 文档业务

状态：Current

本文描述项目内文档的内容模型、访问控制，以及 Personal 单人编辑与 Team 实时协作编辑流程。

## 领域模型

文档属于一个项目，标题与内容分别存储。`documents.content` 使用版本化的 ProseMirror JSON，当前版本为 `1`；它是 Personal 正文的权威持久化状态，也是 Team Yjs 权威状态经过验证的派生投影。Markdown 不是持久化格式。当前支持从 ProseMirror JSON 转换后导出 Markdown，尚未实现 Markdown 导入。

当前内容根节点必须为 `doc`。应用在 Server Action 写入前验证递归节点、marks、attrs 和文本均为可序列化 JSON，并使用与编辑器相同的 Tiptap Starter Kit Schema 拒绝未知或嵌套关系无效的节点。

## 当前编辑器 Schema

`documentExtensions` 是客户端编辑器和服务端内容校验共同使用的 Schema 来源。除 Tiptap Starter Kit 节点和 marks 外，当前还持久化以下自定义节点：

| 节点 | 内容与属性 |
| --- | --- |
| `callout` | 可包含多个 block；`attrs.type` 为 `info`、`note`、`success` 或 `warning` |
| `details` | 内容顺序为一个 `detailsSummary`，后接零个或多个 `detailsContent` |
| `detailsSummary` | 可包含行内内容 |
| `detailsContent` | 可包含多个 block |
| `taskList` | 包含一个或多个 `taskItem` |
| `taskItem` | `attrs.checked` 保存复选状态，内容以 paragraph 开头并可继续包含 block |

`DocumentSchema` 使用同一扩展集合从 JSON 构建 ProseMirror Node 并执行结构检查，因此未知节点、非法嵌套或无效属性不能通过 `updateDocument` 保存。新增、删除或改变以上节点语义时，必须同时评估旧 JSON 读取、`content_schema_version` 和 Markdown 导出兼容性。

## 访问控制

导航结构与正文访问使用不同边界。Workspace 成员可以读取项目、文件夹和文件名称及其导航从属关系；当前系统尚无文件夹表，因此实际导航元数据是 Project 与 Document 名称。导航查询不得返回正文、正文层级、摘要、搜索片段或预览。

正文访问以项目直接成员关系为边界：

| 操作 | 允许角色 | 执行位置 |
| --- | --- | --- |
| 列出和读取文档 | `owner`、`editor`、`viewer` | `getProjectDocuments` 和 `getProjectAuthorization` |
| 创建文档 | `owner`、`editor` | `createDocument` Server Action |
| 修改标题 | `owner`、`editor` | `updateDocument` Server Action |
| 修改 Personal 正文 | `owner` | `updateDocument` Server Action |
| 修改 Team 正文 | `owner`、`editor` | Hocuspocus 鉴权连接与 Yjs 更新 |
| 删除文档 | `owner`、`editor` | `deleteDocument` Server Action |

客户端传入的 `workspaceId`、`projectId`、`documentId`、角色和能力都不能作为授权依据。Server Action 必须通过 `requireUser()` 从 Better Auth Session 取得 `userId`，再由统一权限模块解析资源、项目及所属 Workspace。Personal Workspace 中的项目只允许 owner；Team Workspace 中只有 `project_members` 直接角色授予正文权限，Workspace 角色只授予结构发现能力。

## 读取和编辑流程

`/personal` 与 `/collaboration` 是两个界面区域，通过查询参数选择项目和文档，并复用同一个文档页面组件。Workspace Layout 先解析当前有效用户的 Personal Workspace 和活动 Workspace：个人区域读取前者，协作区域仅在活动 Workspace 为 Team 时读取后者。页面 Server Component 调用 `getProjectDocuments`，同时验证项目所属 Workspace 及其类型。它只读取所选文档的根到节点路径；只有授权决策包含 `document.read` 时才继续查询并传递所选文档的 `content`。非项目成员点击文件时只得到标题和访问申请状态。

全局侧边栏是当前唯一的项目和文档导航层。当前项目节点提供创建文档入口；编辑区不再重复呈现项目名称和文档列表。格式工具栏通过 `DocumentEditorToolbarProvider` 注册当前 Tiptap 实例，并由共享 `ContentToolbar` 在内容全屏按钮左侧呈现。工具栏直接显示最多八个常用格式命令，左侧箭头使用共享 `PopupMenu` 展开其余 StarterKit 格式命令，每行最多八个；该浮层只由同一箭头切换开关。撤销和重做独立固定在工具栏右侧。ContentToolbar 和编辑器正文右键菜单复用 `useDocumentEditorCommands`，因此两处使用相同的格式命令、激活状态和撤销/重做可用状态；右键菜单通过共享 `ContextMenu` 和 `PopupMenu` 纵向呈现。

应用根布局通过客户端事件边界禁用浏览器默认右键菜单。工作区、项目、文件和可编辑正文等明确注册了自定义菜单的区域显示对应菜单；其他区域右键不显示任何菜单。只读正文不会显示格式菜单。

项目节点本身可以折叠，首次展开时才调用 `getDocumentNavigationChildren` 读取根节点；文档节点也只在首次展开时读取直接子节点。每页使用 `(sort_order, id)` 稳定游标，节点分别保存加载中、失败、已加载与下一页状态，并提供局部重试和“加载更多”；重复请求会合并，项目切换后的旧响应不会写回当前树。直接访问深层文档时，服务端以单条有界递归 CTE 一次读取根到节点路径，循环检测、最大深度 100 层和项目边界在 SQL 内保持，文档不属于请求项目时返回 null，客户端注入并展开这条路径，不扫描项目全树；共享内容顶栏复用这条已加载路径，以文件夹或文档图标加名称呈现 `项目 > 父文档 > ... > 当前文档`，祖先项支持点击跳转，编辑区不再重复显示第二套层级导航。项目加号创建根文档，文件悬停的加号或右键“新建子文件”创建子级文档；创建、删除和移动后只刷新受影响节点。侧边栏支持**原生拖拽（Drag & Drop）**：客户端只提交目标文档及 `before`、`inside` 或 `after` 语义，服务端按项目 ID 稳定排序锁定来源和目标项目，在锁内重新验证权限及文档仍属于授权时看到的来源项目，再基于完整目标同级集合计算 `sort_order`、必要时重排、校验防环并级联迁移子树；来源已变化时返回冲突，不使用陈旧项目权限继续移动。跨项目移动的后代集合由单条递归 CTE 一次读取，所有节点必须保持在源项目内，超过 10,000 个后代时整个事务拒绝且不产生部分更新。右键文件节点支持查看权限、修改名称、弹窗移动文件（`MoveDocumentDialog`）以及级联删除。文件权限完全继承项目，当前没有文档级 ACL。编辑器正文支持**Notion 风格块级悬浮手柄与文档内拖拽（`DocumentBlockHandle` 与 `BlockDragDropExtension`）**：鼠标悬停在顶层块或左侧空白边距（Gutter）时显示浮动手柄，提供快捷添加新行（`+`）、按住拖拽把手（`⠿`）在文档内任意上下重排块级节点，以及点击 6-dot 手柄呼出块级快捷菜单（`DocumentBlockMenu`，支持删除块、创建副本、转换为其他块类型、上移/下移等）。拖拽过程中通过 `BlockDragDropExtension` 计算块级包围盒中线实现精确的块边界吸附（Block Boundary Snapping），呈现全宽蓝色落点指示线（Drop Indicator），并在单次原子事务（Atomic Transaction）内执行位置重排，确保与 Yjs 实时协同及单人 Undo/Redo 历史无缝兼容。

编辑模式由 `getProjectDocuments` 根据服务端已验证的 Workspace 类型和协作功能开关推导，客户端不能自行选择存储链路。Personal 文档继续以 ProseMirror JSON 初始化 Tiptap；标题失焦时保存，正文变更经过短延迟合并后调用 `updateDocument`，编辑器失焦会立即触发一次保存。正文保存串行执行，待保存快照独立于编辑器实例保留；页面隐藏或组件卸载会立即冲刷，仍有未完成保存时浏览器离页保护会提示用户。每次正文保存必须携带页面读取或上次成功保存返回的 `updated_at` 版本令牌；事务锁行后版本不一致时保留本地内容并显示冲突，不得整篇覆盖其他页面已经提交的修改。Personal 文档不创建 Provider 或 Y.Doc。

启用功能开关后的 Team 文档使用按文档隔离的 Hocuspocus Provider 和 Y.Doc。客户端和服务端 transformer 必须统一把正文存放在名为 `content` 的 Y.XmlFragment；加载早期版本写入的 `default` 字段时，服务端会在读取二进制状态后转换为 canonical `content` 状态。服务端认证为 `read-write` 后，客户端才按 `knowmesh:<userId>:<documentId>:v<schemaVersion>` 创建 `y-indexeddb` 本地副本，并让它与 Hocuspocus Provider 复用同一个 Y.Doc；viewer、认证失败和 Personal 文档不会加载该副本。客户端等待服务端首次同步和本地副本首次加载后才创建 Tiptap，不把服务端传入的 JSON 再次写入 Y.Doc；本地存储失败时显示降级状态但不切换正文权威。Team 正文更新只进入 Collaboration 扩展，StarterKit Undo/Redo 在该模式关闭。标题仍由 `updateDocument` Server Action 持久化，并以独立 `title_version` 拒绝旧基线；提交后的 PostgreSQL 通知由协作进程转为房间 stateless 消息，使远端标题输入框和面包屑更新。存在本地未保存标题时收到更高版本不会覆盖输入，而是进入冲突状态；页面隐藏、卸载或离页也会冲刷或提示标题变更。文档组件只在协作编辑器挂载期间创建 WebSocket；传输构造时禁用自动连接，并在 React Effect 稳定后才启动，避免开发模式重复渲染产生无主连接。卸载时先销毁本地副本与房间 Provider、发送关闭消息，再异步销毁外层传输，避免路由切换遗留连接。界面区分连接、同步、本地恢复不可用、离线、失败、已同步和 viewer 只读状态；文档连接关闭、底层断线或认证失败会立即冻结正文，认证失败也会撤销基于旧页面权限的标题编辑入口。重新认证后只有服务端返回 `read-write` scope 且页面授权仍允许写入时才恢复编辑。离线期间本地副本不开放继续编辑；退出登录和删除账户会尽力删除当前用户命名空间下的副本。在线成员、远端光标与选区来自服务端净化后的 Awareness，成员列表按用户 ID 防御性去重。

客户端用 50ms 固定窗口合并本地光标与选区位置，只发送窗口内最后一次 `cursor` 状态；用户身份、Presence 移除和 Yjs 正文更新不经过该限流，失焦或卸载时立即清除远端光标。

Team 文档不会进入 JSON 正文写入。功能开关关闭时，服务端对所有 Team 文档返回 `collaborative-readonly` 模式，页面直接读取当前 `documents.content` 快照，不建立 Provider，也不允许正文编辑或调用 `updateDocument(content)`；标题仍按独立的 `document.update` 授权保存。重新启用开关后，已有协作状态的文档继续使用既有 Yjs 权威状态，尚未初始化的文档才从经过验证的 JSON 快照首次初始化。

Provider 报告本地未同步正文更新后，界面保持“保存中”直到协作服务完成 Yjs 状态与 JSON 投影的事务写入；服务通过房间内无状态消息反馈成功或失败。持久化失败会显示保存失败但不会启用 JSON 正文写入。首次同步前若服务不可用或认证失败，页面显示服务端读取的只读 JSON 快照；连接恢复并完成首次 Yjs 同步后才重新创建可编辑协作编辑器。Markdown 导出与打印使用当前编辑器内容，搜索继续读取最近一次成功持久化的 `documents.content` 投影，最近文档和收藏只消费文档元数据。

独立 Hocuspocus 服务使用 Better Auth Cookie 验证身份，重新计算 Project 文档权限，将 viewer 设为只读，并通过数据库通知和最长 15 秒周期复查使权限与 Session 变化失效；每条连接独立执行复查，一个数据库查询失败只记录脱敏错误，不跳过其余连接。Origin、连接数、消息大小和 Presence 身份也由服务端限制。进程启动时必须持有 PostgreSQL session advisory lock；同一数据库只允许一个协作写实例，租约连接丢失会触发失败关闭。存储在同一事务中更新 Yjs 二进制权威状态与 `documents.content` JSON 派生投影。协作服务以显式 `yDocOptions: { gc: true }` 创建文档：Yjs GC 在事务清理时剥离已删除内容的载荷，持久化快照因此不保留墓碑文本；该隐私不变量是对库默认值的显式声明，改动此配置前必须重新评估。store 失败后服务按文档保留内存状态并周期重试；任一失败文档未恢复时 `/ready` 保持失败，最后一个客户端离开也不会卸载它。关闭时逐篇执行最终持久化，一个文档失败不会跳过后续文档；资源清理完成后仍以失败状态退出。内存重试不能覆盖 `SIGKILL`、OOM、主机故障或进程租约连接突然丢失：这些事件可能丢失最近一次成功持久化之后的更新。浏览器本地 Yjs 副本现在可在授权用户重新打开文档并重连时把未落库更新重新合并，但浏览器数据被清除、存储失败或所有客户端副本都丢失时仍只能恢复最近一次成功的服务端快照；当前没有服务端持久更新日志、长期离线编辑或版本历史，因此运维仍须把剩余窗口纳入 RPO，并在 `/ready` 失败时避免强制重启或发布切换。Windows 长生命周期子进程使用独立进程组，避免控制台中断先关闭数据库。开关关闭时不会启动它。CI E2E 使用 PostgreSQL service 并显式启用协作服务；`E2E_REAL_POSTGRES=true` 时本地运行器不会创建 PGlite，而是迁移并使用外部数据库。每个测试使用独立资源 ID，避免并行执行互相删除数据库状态；Chromium 覆盖 viewer 只读、Project 角色降级、Workspace 成员移除和 Session 撤销，Firefox 继续运行通用 E2E。Project 成员删除与角色降级共用 `project_members` 通知和复查路径，不重复保留浏览器场景。生产 release 包含同 SHA 的协作可执行文件和 systemd/Nginx 模板；部署在显式开关开启时先验证协作 readiness，再启动应用并执行公网 WSS Upgrade 冒烟，失败时回滚两个服务。生产 systemd、Nginx、readiness、HTTPS 与公网 WSS Upgrade 已验证并启用，真实登录双会话业务验收仍需单独确认。

## 导出

编辑区提供 Markdown 文件下载、Markdown 正文复制和浏览器打印。Markdown 由当前 ProseMirror JSON 在客户端转换，不改变数据库中的权威内容。任务清单转换为 GitHub 风格复选列表；callout 转换为 Markdown alert；折叠区块保留为 `<details>`/`<summary>` HTML。其他复杂节点或 marks 的导出可能有损。当前没有 Markdown 导入流程。

## 收藏与全站搜索

- **文档收藏**：用户可在文档编辑区顶部点击星标切换收藏状态。客户端提交明确的目标状态，服务端通过冲突安全插入或联合键删除保持重复请求幂等。收藏持久化于 `starred_documents`，在 `/starred` 页面列出所有当前用户已收藏且仍具有 `document.read` 权限的文档；用户或文档被删除时数据库外键级联清理收藏记录。
- **全站搜索**：`/search` 页面支持跨个人空间与团队协作项目对文档标题及 ProseMirror 正文进行检索，并提供上下文片段高亮摘要。搜索严格受项目直接成员关系限制，无权读取正文的文档不会被检索或呈现内容片段。


## Schema 演进

`content_schema_version` 记录内容结构版本。新增或改变节点语义时，必须同时评估：

- Tiptap extension 是否能读取已有 JSON。
- 服务端内容校验是否接受新节点数据。
- 旧文档是否需要迁移或读取时升级。
- `DOCUMENT_CONTENT_SCHEMA_VERSION` 是否需要递增。

数据库版本字段不等于 Tiptap 包版本，不应因为普通依赖升级自动递增。

## 白板领域基础

Document 已具有 `rich-text` 与 `whiteboard` 两种内容类型。存量文档和未显式传入类型的旧创建调用保持 `rich-text`，因此现有 Personal ProseMirror 与 Team Yjs 行为不变。

白板 scene 独立保存在 `document_whiteboard_states`，不进入 `documents.content`、`search_text` 或 `document_collaboration_states`。创建 whiteboard 时，Document 和空 scene 在同一事务写入；删除继续依赖 Document 外键级联。数据库延迟约束同时保证 whiteboard 必须且只能具有白板状态，并拒绝 whiteboard 建立富文本协作状态。应用的 `updateDocument(content)` 与富文本协作初始化也会读取数据库 kind 并拒绝 whiteboard。

当前仅完成领域模型、迁移和服务端隔离，不代表白板创建 UI、读取、编辑、导出或实时协作已经开放。scene envelope 当前只允许空 `files`；图片与二进制资产仍不可用。

## 相关代码

- `src/features/documents/Document.ts`
- `src/features/whiteboards/WhiteboardScene.ts`
- `src/features/documents/DocumentSchema.ts`
- `src/features/documents/DocumentExtensions.ts`
- `src/features/documents/extensions/BlockDragDropExtension.ts`
- `src/features/documents/extensions/CalloutExtension.ts`
- `src/features/documents/extensions/DetailsExtension.ts`
- `src/features/documents/extensions/TaskListExtension.ts`
- `src/features/documents/components/ProjectDocumentsPage.tsx`
- `src/features/documents/components/CreateDocumentDialog.tsx`
- `src/features/documents/components/MoveDocumentDialog.tsx`
- `src/components/layout/ContentBreadcrumbs.ts`
- `src/features/documents/components/DocumentBlockHandle.tsx`
- `src/features/documents/components/DocumentBlockMenu.tsx`
- `src/features/documents/components/DocumentWorkspace.tsx`
- `src/features/documents/components/DocumentEditor.tsx`
- `src/features/documents/components/DocumentEditorDispatcher.tsx`
- `src/features/documents/components/CollaborativeDocumentEditor.tsx`
- `src/features/documents/components/DocumentEditorSurface.tsx`
- `src/features/documents/components/DocumentEditorToolbar.tsx`
- `src/features/documents/components/DocumentExportMenu.tsx`
- `src/features/documents/DocumentMarkdown.ts`
- `src/features/documents/collaboration/DocumentCollaborationTransform.ts`
- `src/features/documents/collaboration/DocumentCollaborationState.ts`
- `src/features/documents/collaboration/DocumentCollaborationLocalPersistence.ts`
- `src/components/layout/AppShell.tsx`
- `src/components/ui/ContextMenu.tsx`
- `src/components/ui/ModalDialog.tsx`
- `src/components/ui/PopupMenu.tsx`
- `src/features/permissions/server/ProjectAuthorization.ts`
- `src/features/permissions/server/DocumentAuthorization.ts`
- `src/features/documents/server/GetProjectDocuments.ts`
- `src/features/documents/server/GetDocumentNavigation.ts`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- `src/features/documents/server/CreateDocument.ts`
- `src/features/documents/server/MoveDocument.ts`
- `src/features/documents/server/UpdateDocument.ts`
- `src/features/documents/server/DeleteDocument.ts`
- `src/features/permissions/`
- `src/models/Schema.ts`

## 相关决策

- [ADR 0002：文档内容使用版本化 ProseMirror JSON](../adr/0002-use-versioned-prosemirror-json.md)
- [ADR 0012：Team 文档使用 Yjs 权威状态与 ProseMirror JSON 派生快照](../adr/0012-use-yjs-for-team-document-collaboration.md)
- [ADR 0014：使用浏览器 Yjs 副本缩小协作硬崩溃丢失窗口](../adr/0014-use-browser-yjs-replicas-for-crash-recovery.md)
- [ADR 0015：按节点加载文档导航树](../adr/0015-lazy-load-document-navigation.md)
- [ADR 0016：使用 Document 类型与 Excalidraw scene 协议承载白板](../adr/0016-use-document-kind-and-excalidraw-scene-protocol.md)
- [ADR 0003：引入 Workspace 资源边界](../adr/0003-introduce-workspace-resource-boundary.md)
- [ADR 0004：使用能力授权并继承协作项目权限](../adr/0004-use-capability-authorization-and-collaboration-inheritance.md)
- [ADR 0006：分离 Workspace 结构发现与 Project 内容访问](../adr/0006-separate-workspace-discovery-from-project-content-access.md)
