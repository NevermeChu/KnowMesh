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
- `kind` 为 `personal` 或 `team`，决定其中所有项目的权限模式。
- `owner_id` 保存唯一所有者的 Clerk 用户 ID，是 Workspace 所有权的权威字段。
- Personal Workspace 的 `(owner_id) WHERE kind = 'personal'` 部分唯一索引同时支持按 owner 定位个人空间，并保证同一 owner 最多拥有一个。
- 包含创建和更新时间。

### `workspace_members`

- `(workspace_id, user_id)` 联合主键。
- `workspace_id` 外键指向 `workspaces.id`，删除 Workspace 时级联删除。
- 角色复用 `owner`、`editor`、`viewer` 枚举，并由应用权限策略映射为能力。
- `(user_id, workspace_id)` 索引支持查询用户可切换的 Workspace。
- 每个 Workspace 至多存在一条 `role = owner` 的成员记录；延迟约束触发器在事务提交时验证它必须与 `workspaces.owner_id` 一致。
- Team Workspace 成员关系控制工作区操作和项目导航结构发现；Project 与文件内容权限由项目直接成员关系控制。Personal Workspace 只允许 owner。

### `projects`

- UUID 主键。
- 名称最长 80 字符。
- `workspace_id` 非空外键指向 `workspaces.id`；删除 Workspace 时级联删除其项目。
- `owner_id` 保存 Clerk 用户 ID。
- `(workspace_id, owner_id)` 复合外键指向 `workspace_members(workspace_id, user_id)`，保证项目 owner 属于项目的 Workspace。
- 项目的个人或协作语义由所属 Workspace 的 `kind` 推导，不重复保存项目类型。
- 定义 `(workspace_id, created_at)` 索引，支持读取 Workspace 项目列表。
- 包含创建和更新时间；`updated_at` 的 `$onUpdate` 是 Drizzle 写入行为，迁移中没有数据库自动更新时间的触发器。

### `project_members`

- `(project_id, user_id)` 联合主键。
- `workspace_id` 保存成员关系所属 Workspace，由数据库触发器根据 Project 自动填充，应用写入时也显式提供。
- `(project_id, workspace_id)` 复合外键指向 `projects(id, workspace_id)`，保证成员关系不能连接到错误 Workspace，删除项目时级联删除。
- `(workspace_id, user_id)` 复合外键指向 `workspace_members(workspace_id, user_id)`，保证 Project 成员一定是同一 Workspace 的成员；移除 Workspace 成员时由数据库级联清理其项目成员关系。
- 角色为 `owner`、`editor` 或 `viewer`。
- 每个 Project 至多存在一条 `role = owner` 的成员记录；延迟约束触发器在事务提交时验证它必须与 `projects.owner_id` 一致。
- 联合主键以 `project_id` 开头，支持当前按项目进行的授权、成员读取和清理查询；当前没有从 `user_id` 开始扫描项目成员的查询，因此不保留反向索引。
- 包含成员关系创建时间。
- `project_invitations` 保存对已有 Workspace 成员的待接受项目邀请；接受后以 viewer 写入 `project_members`。
- `project_access_requests` 保存非项目成员申请 viewer 或 Project viewer 申请 editor 的待审批状态。
- `workspace_access_requests` 保存 Workspace viewer 申请 editor 的待审批状态。
- `workspace_invitations` 保存邮箱、预设角色、令牌哈希、有效期和接受状态；原始令牌不持久化。
- 邀请通过令牌哈希接受；当前没有按 Workspace 与邮箱列出邀请的查询，因此只保留令牌哈希唯一索引。

### `documents`

- UUID 主键，每篇文档通过 `project_id` 属于一个项目；删除项目时级联删除文档。
- 标题最长 200 字符。
- `content` 使用 `JSONB` 保存 ProseMirror JSON，默认内容是包含一个空段落的 `doc` 根节点。
- `content_schema_version` 记录应用文档结构版本，当前为 `1`。
- `created_by_id` 通常保存创建者的 Clerk user ID，不建立本地用户外键；账户删除但 Document 保留在其他人 Project 中时改为 `deleted_user`。
- `(project_id, updated_at)` 索引支持读取项目文档并按更新时间排序。
- 与项目相同，`updated_at` 由 Drizzle 写入路径更新，不是数据库触发器。

### `notifications`

- UUID 主键，通知按 Clerk `recipient_user_id` 归属用户，不随当前 Workspace 切换。
- `actor_user_id` 可空；触发者账户删除后置空，收件人账户删除后删除其通知。
- `type` 使用通知事件枚举；`title` 和 `body` 保存事件发生时的展示快照。
- 可选的 `target_kind` 与 `target_id` 必须同时为空或同时存在。目标是 Workspace 或 Project 的多态历史上下文，不建立外键，因此资源删除不会删除通知。
- `read_at` 为空表示未读；`(recipient_user_id, created_at DESC)` 支持最近通知列表，收件人未读部分索引支持角标统计。

当前没有本地用户表、用户镜像同步逻辑或用户外键；`owner_id` 和 `user_id` 直接保存 Clerk user ID 字符串。Clerk `user.deleted` 由应用事务清理：先删除该用户拥有的 Workspace 和 Project，再移除其他资源中的成员、申请、邀请和收件人通知；其他通知中的触发者引用置空，其他人 Project 中保留的 Document 使用 `deleted_user` 替换 `created_by_id`。

## 数据库约束与应用层不变量

数据库当前直接保证：主键和外键有效、成员关系唯一、关键字段非空、Project 成员一定属于同一 Workspace、资源 owner 与唯一 owner 成员一致，以及删除上级资源或 Workspace 成员时按外键级联清理下级关系。

数据库当前仍不能独立保证：

- Workspace 类型和角色如何映射为项目能力；该规则由应用权限策略执行。
- Personal Workspace 没有额外成员，且其中项目没有 `editor` 或 `viewer`。
- `documents.content` 中的 JSON 符合 ProseMirror Schema。
- `content_schema_version` 与实际 JSON 结构语义一致。

Owner 完整语义由部分唯一索引和 PostgreSQL `DEFERRABLE INITIALLY DEFERRED` 约束触发器共同维护。触发器在事务结束时检查，因此创建或转让可以在同一事务中依次写资源表与成员表；如果最终 `owner_id`、owner 成员身份或 owner 角色不一致，事务提交会失败。Drizzle Schema 能声明索引和外键，但不能表达这些跨表延迟触发器，其权威实现位于 `0010_silly_nomad.sql`。

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

`0005_add-workspace-kind.sql` 识别个人空间、为缺少个人空间的已知用户补建 Workspace，并将旧 Personal 项目迁移到 owner 的个人空间。`0006_remove-project-kind.sql` 随后删除 `projects.kind`、旧枚举、分类索引和冗余的 `user_onboarding` 表。`0007_remove-redundant-indexes.sql` 删除已经被部分唯一索引或联合主键覆盖、且没有当前查询消费者的三个索引。`0008_dashing_vivisector.sql` 为 Project owner 增加 Workspace 成员复合外键。`0009_cheerful_mockingbird.sql` 增加 Project 邀请和 Workspace/Project 权限申请状态，并移除 Workspace 邀请的可选角色，使接受邀请固定为 viewer。`0010_silly_nomad.sql` 回填 `project_members.workspace_id`，预检既有成员和 owner 数据，增加两级成员复合外键、唯一 owner 索引及事务结束时执行的 owner 不变量触发器。

`0011_add-notifications.sql` 增加用户级通知表、事件和目标枚举、目标字段成对约束，以及列表与未读统计索引。

## 迁移不变量

- 已共享或已用于生产的迁移不得改写历史，应新增后续迁移。
- 只有确认所有环境都可重建、没有需要保留的数据时，才允许压缩早期开发迁移。
- 删除表、列、枚举或重建数据库前，必须先检查实际数据和依赖。
- Schema、SQL、快照和 `_journal.json` 必须保持同步。
- 迁移文件必须提交 Git，并与对应业务代码一起审查。
- 不直接编辑 `local.db/` 内部文件。

## 创建项目的一致性

创建 Workspace 同时写入 `workspaces` 和 owner 的 `workspace_members`，必须使用事务。Personal Workspace 由已验证的 Clerk `user.created` Webhook 初始化；与 Team Workspace 相同，owner 删除时通过数据库外键级联清理。用户创建的普通 Workspace 一律为 Team。创建项目前必须验证当前用户具有目标 Workspace 的 `project.create` 能力；项目与包含同一 `workspace_id` 的 owner `project_members` 也必须在同一事务写入。Workspace 或 Project member 退出时只删除自己的关系；Workspace member 若仍拥有下级 Project，必须先在同一事务删除这些 Project，再删除 Workspace 成员关系。

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
- [通知](../features/notifications.md)
