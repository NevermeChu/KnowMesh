# 数据库 Schema 与迁移

状态：Current

本文说明当前业务表、Drizzle Schema 与迁移的职责，以及开发数据库的安全维护方式。

## 技术边界

- 数据库方言：PostgreSQL。
- ORM 与迁移工具：Drizzle ORM / Drizzle Kit。
- Schema 入口：`src/models/Schema.ts`。
- 迁移目录：`migrations/`。
- 本地开发数据库：PGlite Socket，持久化目录为 `local.db/`。
- 应用通过 `src/libs/DB.ts` 获取共享数据库实例。

`pg` 是 Node.js PostgreSQL 驱动，不是可视化数据库工具。查看本地数据优先使用 `npm run db:studio`。

## 当前业务表

### `workspaces`

- UUID 主键，名称最长 80 字符。
- `owner_id` 保存创建者的 Clerk 用户 ID；当前用于记录所有者，不代表完整的 Workspace 权限矩阵已经实现。
- `(owner_id)` 索引支持按所有者定位 Workspace。
- 包含创建和更新时间。

### `workspace_members`

- `(workspace_id, user_id)` 联合主键。
- `workspace_id` 外键指向 `workspaces.id`，删除 Workspace 时级联删除。
- 角色复用 `owner`、`editor`、`viewer` 枚举；第一阶段只用于记录成员身份和展示。
- `(user_id, workspace_id)` 索引支持查询用户可切换的 Workspace。
- 第一阶段中，该表只控制 Workspace 可见性和切换资格，不向项目或文档继承权限。

### `projects`

- UUID 主键。
- 名称最长 80 字符。
- 类型为 `personal` 或 `collaboration`。
- `workspace_id` 非空外键指向 `workspaces.id`；删除 Workspace 时级联删除其项目。
- `owner_id` 保存 Clerk 用户 ID。
- 定义 `(workspace_id, kind)` 索引，支持读取选中 Workspace 内的 Private/Shared 分区。
- 包含创建和更新时间；`updated_at` 的 `$onUpdate` 是 Drizzle 写入行为，迁移中没有数据库自动更新时间的触发器。

### `project_members`

- `(project_id, user_id)` 联合主键。
- `project_id` 外键指向 `projects.id`，删除项目时级联删除。
- 角色为 `owner`、`editor` 或 `viewer`。
- `(user_id, project_id)` 索引支持查询当前用户参与的项目。
- 包含成员关系创建时间。

### `documents`

- UUID 主键，每篇文档通过 `project_id` 属于一个项目；删除项目时级联删除文档。
- 标题最长 200 字符。
- `content` 使用 `JSONB` 保存 ProseMirror JSON，默认内容是包含一个空段落的 `doc` 根节点。
- `content_schema_version` 记录应用文档结构版本，当前为 `1`。
- `created_by_id` 保存创建者的 Clerk user ID，不建立本地用户外键。
- `(project_id, updated_at)` 索引支持读取项目文档并按更新时间排序。
- 与项目相同，`updated_at` 由 Drizzle 写入路径更新，不是数据库触发器。

当前没有本地用户表、用户镜像同步逻辑或用户外键；`owner_id` 和 `user_id` 直接保存 Clerk user ID 字符串。

## 数据库约束与应用层不变量

数据库当前直接保证：主键和外键有效、成员关系唯一、关键字段非空，以及删除项目时级联删除成员和文档。

数据库当前不能独立保证：

- `projects.owner_id` 对应的成员一定存在且角色为 `owner`。
- `workspaces.owner_id` 对应的 Workspace 成员一定存在且角色为 `owner`。
- Workspace 成员自动获得其下项目的访问权；第一阶段明确不做权限继承。
- `personal` 项目没有 `editor` 或 `viewer`。
- 修改项目所有权时，成员关系同步更新。
- `documents.content` 中的 JSON 符合 ProseMirror Schema。
- `content_schema_version` 与实际 JSON 结构语义一致。

当前 `createProject` Server Action 和成员迁移回填维护 owner 成员关系。Schema 本身无法阻止其他直接数据库写入破坏这些跨表关系，因此不能把“Schema 中存在字段”误认为数据库已经保证完整业务语义。

文档内容结构和版本一致性由文档 Server Action 维护。数据库只保证值是合法 JSON，不理解 ProseMirror 节点语义；绕过应用直接写入可能产生编辑器无法解释的内容。

## Schema 和迁移的区别

- `src/models/Schema.ts` 描述数据库最终应有的结构。
- 迁移 SQL 描述现有数据库如何按顺序变化到该结构。
- `migrations/meta` 保存 Drizzle 用于比较和执行的快照与日志，不手工删除单个记录。

普通结构变更流程：

```text
修改 Schema.ts
→ npm run db:generate -- --name=<descriptive-name>
→ 审查生成 SQL
→ 必要时增加安全的数据回填
→ npm run db:migrate
→ 运行类型、Lint 和测试
```

自动生成迁移不会推断业务数据回填。例如新增成员表时，需要明确把已有项目 owner 回填为 owner 成员。

`0003_add-workspaces.sql` 为已有项目所有者创建 Workspace，将项目按原 `owner_id` 归入对应 Workspace，并把既有 `project_members` 汇总回填为 `workspace_members`。同一用户在同一 Workspace 参与多个项目时保留最高角色（`owner` 高于 `editor`，`editor` 高于 `viewer`）；完成回填后才把 `projects.workspace_id` 设为非空。

## 迁移不变量

- 已共享或已用于生产的迁移不得改写历史，应新增后续迁移。
- 只有确认所有环境都可重建、没有需要保留的数据时，才允许压缩早期开发迁移。
- 删除表、列、枚举或重建数据库前，必须先检查实际数据和依赖。
- Schema、SQL、快照和 `_journal.json` 必须保持同步。
- 迁移文件必须提交 Git，并与对应业务代码一起审查。
- 不直接编辑 `local.db/` 内部文件。

## 创建项目的一致性

创建 Workspace 同时写入 `workspaces` 和 owner 的 `workspace_members`，必须使用事务。创建项目前必须验证当前用户属于目标 Workspace；项目与 owner 的 `project_members` 也必须在同一事务写入，避免产生无成员项目。

## 本地操作

```powershell
npm run dev
npm run db:generate -- --name=<descriptive-name>
npm run db:migrate
npm run db:studio
```

`npm run dev` 启动 PGlite、应用迁移，再启动 Next.js。`npm run dev:next` 只启动 Next.js，不负责启动本地数据库编排。

`npm run db:migrate` 和 `npm run db:studio` 都不会自行启动 PGlite。操作本地持久化数据库时，应先在一个终端保持 `npm run dev` 运行，再在另一个终端执行相应命令；也可以连接已经可用的 PostgreSQL。`npm run build-local` 使用临时 PGlite 实例，不写入 `local.db/`，不用于查看或维护本地持久化数据。

生产迁移由 CI 构建的自包含迁移程序从新 release 执行，不依赖服务器源码工作树。迁移必须先于应用软链接切换，并遵守 [`../operations/deployment.md`](../operations/deployment.md) 中的向后兼容与应用回滚边界。

文档和日志不得记录 `DATABASE_URL`、密钥或真实用户数据。

## 相关代码

- `src/models/Schema.ts`
- `src/libs/DB.ts`
- `src/libs/DBConnection.ts`
- `scripts/local-runtime.ts`
- `drizzle.config.ts`

## 相关业务

- [项目业务](../features/projects.md)
- [文档业务](../features/documents.md)
