# ADR 0015：按节点加载文档导航树

- 状态：Accepted
- 日期：2026-08-25
- 部分替代：[ADR 0001](0001-use-server-components-for-workspace-data.md) 的文档导航首载与写入后刷新方式

## 背景

ADR 0001 让共享 Workspace Server Component 在首屏读取项目和文档导航，再把结果传给客户端外壳。该方案避免了空侧边栏闪烁，但文档数量增长后，每个受保护页面都会读取并序列化所有可见项目的完整文档树，即使用户从未展开任何项目。

项目列表仍是所有工作区页面的稳定首屏导航；文档层级则天然适合按项目和父节点展开。直接访问深层文档还需要恢复其祖先路径，但不需要扫描同项目的其他分支。

## 决策

- `WorkspaceLayout` 继续通过 server-only 的 `getWorkspaceNavigation()` 首载 Personal Workspace 与可选活动 Team Workspace 的项目列表，但不读取任何文档节点。
- 项目或文档节点首次展开时，客户端调用 `getDocumentNavigationChildren` Server Action。Action 重新验证 Session 和 `project.structure.read`，只读取一个父节点的直接子节点。
- 子节点按 `(sort_order, id)` 使用稳定游标分页，并单独返回 `hasChildren` 与下一页游标；客户端按项目和父节点隔离加载、错误与分页状态。
- 直接访问深层文档时，页面调用 `getDocumentNavigationPath`，只返回经过循环检测和最大深度限制的祖先路径，再把该路径注入客户端导航树。
- 文档创建、移动和删除只刷新受影响的父节点；项目列表变化继续由 Server Action 使共享 Workspace Layout 失效。客户端树状态只用于呈现，不是权限或文档结构权威。

## 原因

- 共享布局的查询、序列化和浏览器状态不再随全部文档数量线性增长。
- 每次文档读取都在服务端重新授权，保留 Workspace 结构发现与 Project 正文权限的既有边界。
- 稳定游标和局部失效允许大节点分页，同时避免用客户端已加载的局部集合推断完整兄弟顺序。
- 有界祖先路径支持深链直达，而无需为单个活动文档加载整个项目树。

## 后果

- 首屏仍包含可访问项目，但文档节点首次展开时会出现局部加载状态，也需要局部错误重试。
- 客户端必须合并重复请求并丢弃项目切换后的过期响应；这些并发保护不能扩大服务端授权。
- 新的导航读取和排序索引必须保持 `(project_id, parent_id, sort_order, id)` 一致。
- ADR 0001 关于共享 Server Component 首载项目数据的核心决定继续有效；其中首载完整文档导航和统一依赖 `router.refresh()` 的实现方式由本 ADR 替代。

## 备选方案

### 继续首载完整文档树

未采用，因为所有受保护页面都会为未展开节点支付数据库、RSC 序列化和客户端内存成本。

### 首载每个项目的第一页根文档

未采用，因为项目数量增长时仍会形成每项目一次读取，并把用户没有展开的节点发送到浏览器。

### 建立客户端全局查询缓存

当前没有采用。导航读取频率和共享需求尚不足以抵消额外缓存失效、身份隔离与授权同步成本；局部组件状态已经能够表达加载和分页生命周期。

## 相关代码和文档

- `src/app/(workspace)/layout.tsx`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- `src/features/documents/server/GetDocumentNavigation.ts`
- `src/components/layout/AppSidebar/SidebarWorkspaceNavigation.tsx`
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [文档业务](../features/documents.md)
- [项目业务](../features/projects.md)
