# ADR 0005：使用 Workspace 类型作为项目权限模式

- 状态：Superseded by [ADR 0006](0006-separate-workspace-discovery-from-project-content-access.md)
- 日期：2026-08-12

## 背景

ADR 0003 为项目增加 Workspace 归属后，仍保留 `projects.kind` 表示同一 Workspace 内的个人与协作分区。该过渡模型让个人项目随团队 Workspace 删除，并允许同一 Workspace 同时出现两种互相冲突的成员和权限语义。成员退出时，个人项目的永久归属也无法得到表达。

产品现已确定每个用户永久拥有一个个人空间；团队 Workspace 才承载协作内容。Project 已经通过 `workspace_id` 唯一归属 Workspace，继续保存项目类型会重复表达父资源已经确定的权限模式。

## 决策

为 `workspaces` 增加 `kind = personal | team`，并删除 `projects.kind`。项目的个人或协作语义仅由所属 Workspace 类型推导：

- 每个用户拥有且只拥有一个 `personal` Workspace；它不可删除、退出、邀请成员或管理项目成员。
- `personal` Workspace 中的项目只允许 owner 访问，不继承成员能力。
- 用户创建的普通 Workspace 均为 `team`；其中项目合并 Workspace 继承权限与项目直接权限。
- 个人项目在选择任意团队 Workspace 时仍显示；协作区域只在活动 Workspace 为 `team` 时显示。
- `user_onboarding` 不再保存第二份初始化状态。是否已经初始化由个人 Workspace 及其 owner 部分唯一索引表达。

## 原因

- Project 与 Workspace 类型不会出现非法组合，授权、查询和迁移只有一个分类事实来源。
- Personal Workspace 保留现有非空外键和级联结构，同时让个人项目脱离团队 Workspace 生命周期。
- 与让 `projects.workspace_id` 可空相比，该方案对文档归属、项目授权和路由边界的改动更小。
- Personal Workspace 本身可表达初始化状态，不需要额外 onboarding 标记。

## 后果

- 项目查询和授权必须连接 `workspaces` 读取 `kind`。
- 创建 Personal 项目必须由服务端定位当前用户的 Personal Workspace；创建团队项目使用活动 Team Workspace。
- 旧 Personal 项目迁移到其 owner 的 Personal Workspace；旧 Collaboration 项目保留在 Team Workspace。
- 历史 ADR 0003 和 0004 中由 `projects.kind` 表达的过渡决策由本 ADR 替代。
- 所有权转让和主动退出仍需后续实现，但移除 Team Workspace 成员时必须拒绝留下任何由其拥有的项目。

## 备选方案

### Personal 项目不属于 Workspace

未采用。它要求 `workspace_id` 可空，并重写项目、文档导航、授权和路由中的 Workspace 边界。

### 保留 Workspace 与 Project 两层类型

未采用。Project 类型完全可由 Workspace 推导，两层字段会产生不一致组合和重复分支。

### 使用 `personal_workspace_id`

未采用。单独指针会与 Workspace 自身的类型和所有权形成重复状态；部分唯一索引可以直接表达每个 owner 只有一个 Personal Workspace。

## 相关代码和文档

- `src/models/Schema.ts`
- `src/features/workspaces/server/EnsureUserWorkspace.ts`
- `src/features/permissions/PermissionPolicy.ts`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- [项目业务](../features/projects.md)
- [数据库与迁移](../database/schema-and-migrations.md)
