# 文档业务

状态：Current

本文描述项目内文档的内容模型、访问控制和当前单人编辑流程。

## 领域模型

文档属于一个项目，标题与内容分别存储。`documents.content` 的权威格式是版本化的 ProseMirror JSON，当前版本为 `1`；Markdown 不是持久化格式。当前支持从 ProseMirror JSON 转换后导出 Markdown，尚未实现 Markdown 导入。

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
| 修改标题或内容 | `owner`、`editor` | `updateDocument` Server Action |
| 删除文档 | `owner`、`editor` | `deleteDocument` Server Action |

客户端传入的 `workspaceId`、`projectId`、`documentId`、角色和能力都不能作为授权依据。Server Action 必须通过 `requireUser()` 从 Better Auth Session 取得 `userId`，再由统一权限模块解析资源、项目及所属 Workspace。Personal Workspace 中的项目只允许 owner；Team Workspace 中只有 `project_members` 直接角色授予正文权限，Workspace 角色只授予结构发现能力。

## 读取和编辑流程

`/personal` 与 `/collaboration` 是两个界面区域，通过查询参数选择项目和文档，并复用同一个文档页面组件。Workspace Layout 先解析当前有效用户的 Personal Workspace 和活动 Workspace：个人区域读取前者，协作区域仅在活动 Workspace 为 Team 时读取后者。页面 Server Component 调用 `getProjectDocuments`，同时验证项目所属 Workspace 及其类型。它先读取导航元数据；只有授权决策包含 `document.read` 时才继续查询并传递所选文档的 `content`。非项目成员点击文件时只得到标题和访问申请状态。

全局侧边栏是当前唯一的项目和文档导航层。当前项目节点提供创建文档入口；编辑区不再重复呈现项目名称和文档列表。格式工具栏通过 `DocumentEditorToolbarProvider` 注册当前 Tiptap 实例，并由共享 `ContentToolbar` 在内容全屏按钮左侧呈现。工具栏直接显示最多八个常用格式命令，左侧箭头使用共享 `PopupMenu` 展开其余 StarterKit 格式命令，每行最多八个；该浮层只由同一箭头切换开关。撤销和重做独立固定在工具栏右侧。ContentToolbar 和编辑器正文右键菜单复用 `useDocumentEditorCommands`，因此两处使用相同的格式命令、激活状态和撤销/重做可用状态；右键菜单通过共享 `ContextMenu` 和 `PopupMenu` 纵向呈现。

应用根布局通过客户端事件边界禁用浏览器默认右键菜单。工作区、项目、文件和可编辑正文等明确注册了自定义菜单的区域显示对应菜单；其他区域右键不显示任何菜单。只读正文不会显示格式菜单。

项目节点本身可以折叠，展开后才显示其文档。项目节点的加号和右键菜单中的“新建文件”共用同一创建弹窗；只有具有 `document.create` 能力时入口才可用。右键文件节点可以查看权限、修改名称和删除文件；服务端仍会独立验证对应能力。文件权限完全继承项目，当前没有文档级 ACL。

编辑器使用 Tiptap，初始内容来自 ProseMirror JSON。标题失焦时保存；正文变更经过短延迟合并后调用 `updateDocument`，编辑器失焦会立即触发一次保存。正文保存串行执行，避免较早的请求覆盖较新的本地内容。

当前是单人编辑模型，没有版本历史、冲突检测、离线队列、Yjs 状态或实时连接。多个浏览器同时编辑同一文档时仍是后写覆盖；在引入多人协作前不得把当前自动保存描述为协同编辑。

## 导出

编辑区提供 Markdown 文件下载、Markdown 正文复制和浏览器打印。Markdown 由当前 ProseMirror JSON 在客户端转换，不改变数据库中的权威内容。任务清单转换为 GitHub 风格复选列表；callout 转换为 Markdown alert；折叠区块保留为 `<details>`/`<summary>` HTML。其他复杂节点或 marks 的导出可能有损。当前没有 Markdown 导入流程。

## 收藏与全站搜索

- **文档收藏**：用户可在文档编辑区顶部点击星标切换收藏状态。持久化于 `starred_documents`，在 `/starred` 页面列出所有当前用户已收藏且仍具有 `document.read` 权限的文档。文档被删除时外键级联清理收藏记录。
- **全站搜索**：`/search` 页面支持跨个人空间与团队协作项目对文档标题及 ProseMirror 正文进行检索，并提供上下文片段高亮摘要。搜索严格受项目直接成员关系限制，无权读取正文的文档不会被检索或呈现内容片段。


## Schema 演进

`content_schema_version` 记录内容结构版本。新增或改变节点语义时，必须同时评估：

- Tiptap extension 是否能读取已有 JSON。
- 服务端内容校验是否接受新节点数据。
- 旧文档是否需要迁移或读取时升级。
- `DOCUMENT_CONTENT_SCHEMA_VERSION` 是否需要递增。

数据库版本字段不等于 Tiptap 包版本，不应因为普通依赖升级自动递增。

## 相关代码

- `src/features/documents/Document.ts`
- `src/features/documents/DocumentSchema.ts`
- `src/features/documents/DocumentExtensions.ts`
- `src/features/documents/extensions/CalloutExtension.ts`
- `src/features/documents/extensions/DetailsExtension.ts`
- `src/features/documents/extensions/TaskListExtension.ts`
- `src/features/documents/components/ProjectDocumentsPage.tsx`
- `src/features/documents/components/CreateDocumentDialog.tsx`
- `src/features/documents/components/DocumentWorkspace.tsx`
- `src/features/documents/components/DocumentEditor.tsx`
- `src/features/documents/components/DocumentEditorToolbar.tsx`
- `src/features/documents/components/DocumentExportMenu.tsx`
- `src/features/documents/DocumentMarkdown.ts`
- `src/components/layout/GlobalContextMenuBoundary.tsx`
- `src/components/ui/ContextMenu.tsx`
- `src/components/ui/ModalDialog.tsx`
- `src/components/ui/PopupMenu.tsx`
- `src/features/permissions/server/ProjectAuthorization.ts`
- `src/features/permissions/server/DocumentAuthorization.ts`
- `src/features/documents/server/GetProjectDocuments.ts`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- `src/features/documents/server/CreateDocument.ts`
- `src/features/documents/server/UpdateDocument.ts`
- `src/features/documents/server/DeleteDocument.ts`
- `src/features/permissions/`
- `src/models/Schema.ts`

## 相关决策

- [ADR 0002：文档内容使用版本化 ProseMirror JSON](../adr/0002-use-versioned-prosemirror-json.md)
- [ADR 0003：引入 Workspace 资源边界](../adr/0003-introduce-workspace-resource-boundary.md)
- [ADR 0004：使用能力授权并继承协作项目权限](../adr/0004-use-capability-authorization-and-collaboration-inheritance.md)
- [ADR 0006：分离 Workspace 结构发现与 Project 内容访问](../adr/0006-separate-workspace-discovery-from-project-content-access.md)
