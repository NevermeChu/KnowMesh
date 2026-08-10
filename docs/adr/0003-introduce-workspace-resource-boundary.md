# ADR 0003：引入真实 Workspace 资源边界

- 状态：Accepted
- 日期：2026-08-10

## 背景

项目最初通过 `projects.kind` 区分个人与协作内容，侧边栏中的“工作区”只是两个固定分区。该模型无法表示多个可切换 Team，也没有稳定位置承载工作区名称、成员、所有者和项目归属。

产品已经确定左上角切换 Workspace，并在每个 Workspace 内继续展示 Private/Shared 项目。完整角色继承、邀请和成员管理仍需单独设计，不能与资源归属迁移同时隐式上线。

## 决策

新增 `workspaces`、`workspace_members` 和 `projects.workspace_id`：

```text
Workspace
├─ Private projects (`kind = personal`)
└─ Shared projects (`kind = collaboration`)
   └─ Documents
```

左上角切换器选择一个活动 Workspace，侧边栏只展示该 Workspace 的项目和文件，不额外增加可见导航层级。活动 Workspace ID 保存在 HttpOnly、SameSite=Lax Cookie 中，服务端读取前必须确认当前用户存在对应 `workspace_members` 记录。

本阶段 `workspace_members` 只控制 Workspace 的可见和切换范围；项目与文件继续通过 `project_members` 执行授权。Workspace 角色继承、邀请、退出、角色变更和所有权转让属于第二阶段。

## 原因

- Workspace 成为多个项目的稳定父资源，可以支持多个 Team 和左上角切换器。
- 项目查询与路由读取具有明确 Workspace 边界，切换后不会继续呈现其他 Workspace 的项目。
- 保留 `projects.kind` 可以在不同时改写全部权限模型的情况下表达 Workspace 内的 Private/Shared 分区。
- 数据归属与角色继承分阶段实施，降低迁移同时改变授权语义的风险。

## 后果

- 所有项目必须属于一个 Workspace。
- 创建项目必须提供 Workspace ID，并由服务端验证调用者是该 Workspace 成员。
- 共享 Workspace 成员不会在本阶段自动获得其中所有 Shared 项目的访问权；仍需存在 `project_members` 记录。
- 迁移为每个现有项目 owner 创建一个默认 Workspace，按项目成员最高角色回填 Workspace 成员，并保留现有项目类型和项目授权。
- 第二阶段必须统一计算继承和直接授权，届时需要重新评估 `project_members` 与 `workspace_members` 的职责。

## 备选方案

### 继续只使用项目类型

未采用。它无法区分多个 Team，切换器没有稳定资源 ID，工作区操作只能批量复制到项目。

### 在侧边栏展示 Workspace → Project → File

未采用。Workspace 已由左上角切换器选择，再展示同一层会增加重复导航。数据层级保留 Workspace，界面只显示当前 Workspace 的项目和文件。

### 同时实现完整权限继承

未采用。资源归属和权限矩阵都是跨层变化，一次上线会扩大迁移与授权回归风险。

## 相关代码和文档

- `src/models/Schema.ts`
- `src/features/workspaces/`
- `src/app/(workspace)/layout.tsx`
- `src/components/layout/AppSidebar/SidebarMenus.tsx`
- `migrations/0003_add-workspaces.sql`
- [项目业务](../features/projects.md)
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库与迁移](../database/schema-and-migrations.md)
