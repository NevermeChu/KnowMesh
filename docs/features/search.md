# 搜索

状态：Current

本文描述 KnowMesh 当前的文档搜索入口、相关度排序、正文权限边界和客户端最近访问缓存。

## 产品入口

搜索有两个入口，共用 `searchWorkspaceContent` Server Action：

- `/search` 页面从 URL 读取查询词和范围筛选，在服务端渲染当前结果。
- `CommandPalette` 挂载在登录后的 `AppShell`，通过 `Cmd+K` 或 `Ctrl+K` 打开，并在当前页面内执行搜索、导航和少量全局操作。

两个入口都支持全部、个人空间和团队协作范围。范围只限制 `workspaces.kind`，不会改变项目正文授权规则。

## 查询与排序

`searchWorkspaceContent` 先通过 `requireUser()` 取得当前 Better Auth 用户，再按标题或 `documents.content` 的 JSON 文本表示执行不区分大小写的包含匹配。空白查询不访问数据库。结果按以下顺序排序，最多返回 30 条：

1. 标题完全匹配，权重 100。
2. 标题包含查询词，权重 50。
3. 正文 JSON 包含查询词，权重 10。
4. 相同权重按文档更新时间倒序。

数据库查询返回内容后，服务端递归提取 ProseMirror 文本，并围绕首次匹配位置生成最长 140 个字符的上下文片段。当前查询直接匹配 JSONB 的文本表示，而不是预先构建的纯文本搜索索引，因此节点属性中的文本也可能命中；这属于当前搜索语义。

`/search` 直接等待 Server Action 返回。`CommandPalette` 在输入停止 180ms 后调用同一 Action，并使用递增请求编号丢弃晚到的旧结果，避免较早查询覆盖较新的输入。

## 权限边界

搜索正文必须以 Project 直接成员关系为边界。查询通过 `project_members.user_id` 限制结果，不因用户能在 Team Workspace 导航中发现 Project 或 Document 名称而返回正文或片段。Personal 与 Team 筛选同样不能扩大此权限。

客户端传入的查询词和筛选只用于构造候选结果，身份始终由 Server Action 的 Better Auth Session 提供。返回浏览器的数据只包含结果导航所需的 Workspace、Project、Document 元数据和正文片段，不包含完整 ProseMirror JSON。

## 命令面板与最近访问

没有查询词时，命令面板显示快捷导航、主题与专注模式等操作，以及最近从命令面板打开的最多四篇文档。当前实现把完整 `SearchResultItem` 写入固定的浏览器 `localStorage` 键 `knowmesh:recent-documents`，其中包含标题、Workspace、Project 和正文片段。

这份客户端缓存当前没有按 Better Auth 用户隔离，打开命令面板时也不会重新向服务端验证缓存项的读取权限。同一浏览器切换账户或用户失去 Project 权限后，旧结果可能继续显示，直到缓存被后续访问覆盖或由用户清理。该问题已记录在 `docs/PROBLEMS.md`，在修复前不得把最近访问缓存视为授权来源；真正打开文档时仍由文档页面重新鉴权。

## 相关代码

- `src/app/(workspace)/search/page.tsx`
- `src/features/search/Search.ts`
- `src/features/search/server/SearchWorkspaceContent.ts`
- `src/features/search/components/SearchInterface.tsx`
- `src/features/search/components/CommandPalette.tsx`
- `src/components/layout/AppShell.tsx`

## 相关文档

- [文档业务](documents.md)
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [ADR 0006：分离 Workspace 结构发现与 Project 内容访问](../adr/0006-separate-workspace-discovery-from-project-content-access.md)
