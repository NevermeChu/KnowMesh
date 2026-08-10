# 文档业务

状态：Current

本文描述项目内文档的内容模型、访问控制和当前单人编辑流程。

## 领域模型

文档属于一个项目，标题与内容分别存储。`documents.content` 的权威格式是版本化的 ProseMirror JSON，当前版本为 `1`；Markdown 不是持久化格式，未来如需支持，应作为导入或导出转换。

当前内容根节点必须为 `doc`。应用在 Server Action 写入前验证递归节点、marks、attrs 和文本均为可序列化 JSON，并使用与编辑器相同的 Tiptap Starter Kit Schema 拒绝未知或嵌套关系无效的节点。

## 访问控制

所有文档访问都以项目成员关系为边界：

| 操作 | 允许角色 | 执行位置 |
| --- | --- | --- |
| 列出和读取文档 | `owner`、`editor`、`viewer` | `getProjectDocuments` 和 `getProjectAccess` |
| 创建文档 | `owner`、`editor` | `createDocument` Server Action |
| 修改标题或内容 | `owner`、`editor` | `updateDocument` Server Action |

客户端传入的 `projectId`、`documentId` 和角色都不能作为授权依据。Server Action 必须从 Clerk 会话取得 `userId`，再通过 `project_members` 验证资源级权限。

## 读取和编辑流程

`/personal` 与 `/collaboration` 通过查询参数选择项目和文档，两者复用同一个文档页面组件。Workspace Layout 调用 `getDocumentNavigation`，把当前成员可访问的文档元数据放入全局侧边栏并按项目分组；页面 Server Component 调用 `getProjectDocuments`，只把当前项目的文档元数据及所选文档内容传给编辑区。

全局侧边栏是当前唯一的项目和文档导航层。当前项目节点提供创建文档入口；编辑区不再重复呈现项目名称和文档列表。格式工具栏通过 `DocumentEditorToolbarProvider` 注册当前 Tiptap 实例，并由共享 `ContentToolbar` 在内容全屏按钮左侧呈现。工具栏直接显示最多八个常用格式命令，左侧箭头使用共享 `PopupMenu` 展开其余 StarterKit 格式命令，每行最多八个；该浮层只由同一箭头切换开关。撤销和重做独立固定在工具栏右侧。ContentToolbar 和编辑器正文右键菜单复用 `useDocumentEditorCommands`，因此两处使用相同的格式命令、激活状态和撤销/重做可用状态；右键菜单通过共享 `ContextMenu` 和 `PopupMenu` 纵向呈现。

应用根布局通过客户端事件边界禁用浏览器默认右键菜单。工作区、项目、文件和可编辑正文等明确注册了自定义菜单的区域显示对应菜单；其他区域右键不显示任何菜单。只读正文不会显示格式菜单。

项目节点本身可以折叠，展开后才显示其文档。项目节点的加号和右键菜单中的“新建文件”共用同一创建弹窗；用户输入文件名并提交后，应用创建文档、展开所属项目并导航到新文件。创建文件、链接编辑和权限总览使用共享 `ModalDialog`，其遮罩与 Escape 关闭行为由调用方显式开启；创建请求进行中会临时禁用关闭。右键文件节点还可以查看文件权限；文件权限完全继承项目成员关系，当前没有文档级 ACL。

编辑器使用 Tiptap，初始内容来自 ProseMirror JSON。标题失焦时保存；正文变更经过短延迟合并后调用 `updateDocument`，编辑器失焦会立即触发一次保存。正文保存串行执行，避免较早的请求覆盖较新的本地内容。

当前是单人编辑模型，没有版本历史、冲突检测、离线队列、Yjs 状态或实时连接。多个浏览器同时编辑同一文档时仍是后写覆盖；在引入多人协作前不得把当前自动保存描述为协同编辑。

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
- `src/features/documents/components/ProjectDocumentsPage.tsx`
- `src/features/documents/components/CreateDocumentDialog.tsx`
- `src/features/documents/components/DocumentWorkspace.tsx`
- `src/features/documents/components/DocumentEditor.tsx`
- `src/features/documents/components/DocumentEditorToolbar.tsx`
- `src/components/layout/GlobalContextMenuBoundary.tsx`
- `src/components/ui/ContextMenu.tsx`
- `src/components/ui/ModalDialog.tsx`
- `src/components/ui/PopupMenu.tsx`
- `src/features/documents/server/DocumentAccess.ts`
- `src/features/documents/server/GetProjectDocuments.ts`
- `src/features/documents/server/GetDocumentNavigation.ts`
- `src/features/documents/server/CreateDocument.ts`
- `src/features/documents/server/UpdateDocument.ts`
- `src/models/Schema.ts`

## 相关决策

- [ADR 0002：文档内容使用版本化 ProseMirror JSON](../adr/0002-use-versioned-prosemirror-json.md)
