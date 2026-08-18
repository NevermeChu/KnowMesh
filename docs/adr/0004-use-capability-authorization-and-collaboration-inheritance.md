# ADR 0004：使用能力授权并继承协作项目权限

- 状态：Superseded by [ADR 0005](0005-use-workspace-kind-as-project-mode.md)
- 日期：2026-08-11

## 背景

ADR 0003 已建立 Workspace 资源边界，但有意推迟角色继承。随着工作区、项目和文件需要支持查看、修改与删除，仅在各 Server Action 中判断成员角色会重复权限矩阵，也无法区分 Workspace owner 与 Project owner。

系统当前只有固定的 `owner`、`editor`、`viewer` 角色，不需要自定义角色、邀请、转让、显式拒绝规则或文件级 ACL。

## 决策

新增统一权限模块，将成员角色映射为 `workspace.*`、`project.*` 和 `document.*` 能力。服务端读取和写入必须通过资源授权查询计算能力；客户端收到的能力仅用于界面呈现，不作为服务端授权依据。

权限按以下规则计算：

- Workspace owner 可以查看、修改和删除 Workspace，并创建项目；editor 可以查看和创建项目；viewer 只读。
- `personal` 项目只使用 `project_members` 和 `projects.owner_id`，不继承 Workspace 内容权限。
- `collaboration` 项目合并项目直接成员与 Workspace 成员授予的能力。Workspace owner 可以管理和删除协作项目，editor 可以编辑协作项目及文件，viewer 只读。
- Project owner 是 `projects.owner_id` 指定的唯一所有者。Workspace owner 获得管理能力时不会被表示为 Project owner。
- 文件完全继承所属项目能力，不新增文件成员表；Project owner 和 editor 可以创建、修改、删除文件，viewer 只读。
- Workspace 和项目属于资源容器，仅 owner 或明确的 Workspace 管理能力可以删除；文件删除属于内容编辑能力。

`owner_id` 是唯一所有权的权威字段，owner 同时存在于成员表的跨表不变量继续由创建事务维护。权限矩阵保存在 TypeScript 代码中，不新增权限配置表。

## 原因

- 能力检查比散落的角色比较更明确，新增操作时可以复用同一策略。
- 保留授权来源可以避免把继承得到的管理能力误表示为资源所有权。
- Personal 不继承可以维持个人内容边界；Collaboration 继承可以避免为每个 Workspace 成员重复写项目成员记录。
- 固定策略与当前产品规模相符，比数据化权限规则更容易测试和审查。

## 后果

- Workspace viewer 不再能够创建项目。
- Workspace 成员自动获得 Collaboration 项目对应能力，项目和文档导航查询必须同时考虑 Workspace 与项目成员关系。
- 所有资源写入必须从服务端认证会话取得身份并调用统一授权函数。
- 权限总览必须区分项目直接权限和 Workspace 继承权限。
- 删除 Workspace 和项目继续使用数据库外键级联；界面必须提示级联影响。
- 将来实现邀请、角色变更和转让时，可以继续写入现有成员关系，但必须保持唯一所有者不变量。

## 备选方案

### 只比较成员角色

未采用。它会在多个入口复制角色矩阵，也无法表达 Workspace owner 继承管理能力但不是 Project owner。

### 所有项目都继承 Workspace

未采用。它会使 Personal 项目失去独立内容边界。

### 新增权限和角色配置表

未采用。当前没有自定义角色或动态策略需求，数据化规则会增加迁移、管理界面和错误配置风险。

### 为文件增加独立 ACL

未采用。当前文件始终属于项目，独立 ACL 会显著增加导航查询和权限管理复杂度。

## 相关代码和文档

- `src/features/permissions/`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- `src/features/projects/server/GetPermissionOverview.ts`
- [项目业务](../features/projects.md)
- [文档业务](../features/documents.md)
- [ADR 0003](0003-introduce-workspace-resource-boundary.md)
