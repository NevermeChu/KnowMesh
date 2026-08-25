# 搜索

状态：Current

本文描述 KnowMesh 当前的文档搜索入口、相关度排序、正文权限边界和客户端最近访问缓存。

## 产品入口

搜索有两个入口，共用 `searchWorkspaceContent` Server Action：

- `/search` 页面从 URL 读取查询词和范围筛选，在服务端渲染当前结果。
- `CommandPalette` 挂载在登录后的 `AppShell`，通过 `Cmd+K` 或 `Ctrl+K` 打开，并在当前页面内执行搜索、导航和少量全局操作。

两个入口都支持全部、个人空间和团队协作范围。范围只限制 `workspaces.kind`，不会改变项目正文授权规则。

## 查询与排序

`searchWorkspaceContent` 先通过 `requireUser()` 取得当前 Better Auth 用户，再以运行时 Schema 限制查询词最多 200 个字符、筛选值只能为 `all | personal | team`、分页大小只能为 1–100，然后按标题 (`documents.title`) 或文档纯文本投影列 (`documents.search_text`) 执行不区分大小写的包含匹配。空白查询不访问数据库。结果按以下顺序排序：

1. 标题完全匹配，权重 100。
2. 标题包含查询词，权重 50。
3. 正文纯文本包含查询词，权重 10。
4. 相同权重按文档更新时间倒序。

数据库直接基于 `search_text` 与 `title` 列检索，并利用 PostgreSQL `pg_trgm` 扩展建立 GIN 三元组倒排索引（`documents_search_text_trgm_idx` 与 `documents_title_trgm_idx`）加速 `ILIKE` 模糊匹配，彻底避免全表扫描。系统在单人保存（`UpdateDocument`）与团队协同落库（`DocumentCollaborationPersistence`）时自动从 ProseMirror AST 提取并投影纯文本，彻底消除了检索时在数据库端全表序列化 JSON 以及在 Node.js 内存中反序列化 JSON 的开销，同时杜绝了匹配 JSON 结构标签词的假阳性干扰。数据库查询直接返回匹配的 `searchText`，服务端围绕首次匹配位置生成最长 140 个字符的上下文片段。

`/search` 直接等待 Server Action 返回。`CommandPalette` 在输入停止 180ms 后调用同一 Action，并使用递增请求编号丢弃晚到的旧结果，避免较早查询覆盖较新的输入。

## 权限边界

搜索正文必须以 Project 直接成员关系为边界。查询通过 `project_members.user_id` 限制结果，不因用户能在 Team Workspace 导航中发现 Project 或 Document 名称而返回正文或片段。Personal 与 Team 筛选同样不能扩大此权限。

客户端传入的查询词和筛选只用于构造候选结果，身份始终由 Server Action 的 Better Auth Session 提供。返回浏览器的数据只包含结果导航所需的 Workspace、Project、Document 元数据和正文片段，不包含完整 ProseMirror JSON。

## 命令面板与最近访问

没有查询词时，命令面板显示快捷导航、主题与专注模式等操作，以及最近从命令面板打开的最多 6 篇文档。客户端仅在浏览器 `localStorage` 中按当前 Better Auth 用户隔离保存最近访问的文档 UUID 列表（键名 `knowmesh:recent-document-ids:${userId}`），不持久化正文片段或完整搜索结果。

打开命令面板时，客户端调用 `getRecentPaletteDocuments` Server Action，由服务端通过 `requireUser()` 重新验证当前用户对候选文档的 Project 直接读取权限并查询最新元数据；已删除或已失去访问权限的文档会被自动过滤。客户端缓存仅用于快速提供候选文档 ID，不作为授权来源。

## 相关代码

- `src/app/(workspace)/search/page.tsx`
- `src/features/search/Search.ts`
- `src/features/search/server/SearchWorkspaceContent.ts`
- `src/features/search/server/GetRecentPaletteDocuments.ts`
- `src/features/search/components/SearchInterface.tsx`
- `src/features/search/components/CommandPalette.tsx`
- `src/components/layout/AppShell.tsx`

## 相关文档

- [文档业务](documents.md)
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [ADR 0006：分离 Workspace 结构发现与 Project 内容访问](../adr/0006-separate-workspace-discovery-from-project-content-access.md)
