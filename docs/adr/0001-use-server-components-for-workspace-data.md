# ADR 0001：工作区初始数据使用 Server Component

- 状态：Accepted
- 日期：2026-08-04

## 背景

登录后的项目侧边栏出现在 `/dashboard`、搜索、收藏、个人、协作和设置等所有工作区页面。页面首次显示时需要当前用户可访问的项目。

可选方案包括：

1. 浏览器挂载后请求 `/api/projects`。
2. 只在 `/dashboard` 查询，再建立客户端全局状态共享。
3. 在共享 Workspace Server Component 中查询，并把结果传给客户端外壳。

## 决策

在 `src/app/(workspace)/layout.tsx` 中调用 server-only 的 `getWorkspaceNavigation()`，把项目和文档导航结果作为 props 传给 `AppShell`。

当前项目创建使用 Server Action。写入成功后客户端调用 `router.refresh()`，由 Workspace Layout 重新查询最新数据。

## 原因

- 侧边栏属于所有登录后页面，不只属于首页。
- Clerk 会话和数据库访问保留在服务器。
- 首屏响应已经包含项目数据，不需要额外客户端请求和空列表闪烁。
- 不需要为初始项目列表额外维护 API Route、`useEffect` 和客户端缓存。
- 查询和授权逻辑集中在 server-only 模块中。

## 后果

- 传给 Client Component 的项目数据必须安全且可序列化。
- 当前项目创建使用 Server Action；项目修改和删除尚未实现，本 ADR 不决定它们的传输方式。
- 当前写入后通过 `router.refresh()` 刷新服务端数据。
- 如果未来出现高频局部刷新、离线能力或复杂乐观更新，需要重新评估客户端缓存。
- 本 ADR 不决定外部客户端、Webhook、实时协作或其他尚未实现边界的传输方案。

## 备选方案

### 客户端请求 API

未用于当前初始列表，因为会增加一次请求、loading/error 状态和首屏空侧边栏。本 ADR 不评价尚未实现的外部客户端或稳定 HTTP 契约。

### 仅在首页查询

未采用，因为导航栏在所有工作区路由中共享。跳转到搜索或设置后仍然需要相同项目数据。

### 全局客户端状态

当前没有足够复杂的客户端缓存需求。提前引入会增加数据失效和服务器状态同步成本。

## 重新评估条件

- 项目列表变得很大，需要分页或虚拟化。
- 多个客户端界面需要独立的乐观更新和缓存失效。
- 引入移动端、桌面端或公开 API。
- 实时成员与项目状态成为核心需求。

## 相关代码和文档

- `src/app/(workspace)/layout.tsx`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- `src/features/projects/server/CreateProject.ts`
- `src/features/projects/components/CreateProjectDialog.tsx`
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [项目业务](../features/projects.md)
