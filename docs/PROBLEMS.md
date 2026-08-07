# 开发问题记录

本文记录开发中值得保留的重要问题、根因和解决方法。

## 1. 创建项目或文档后侧边栏未更新

### 问题

项目或文档已成功写入数据库，但侧边栏仍显示创建前的项目和文档列表，需要手动刷新后才能看到新数据。

### 根因

侧边栏数据由共享的 `(workspace)` 布局读取，创建 Server Action 成功后却没有使该布局数据失效。客户端只调用 `router.refresh()`，而文档流程还在 `router.push()` 后紧接刷新，刷新可能仍作用于旧路由。

### 解决方法

- `createProject` 和 `createDocument` 在写入成功后调用 `revalidatePath('/(workspace)', 'layout')`，让共享布局重新执行 `getProjects` 和 `getDocumentNavigation`。
- 文档创建返回新 ID 后，客户端只负责导航到新文档，不再紧接调用 `router.refresh()`。
- 单元测试覆盖成功写入后的布局失效，以及无效输入、无权限和写入失败时不得失效布局。
