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

应用进程的共享 `pg` Pool 最多使用 10 条连接；新连接与锁等待最多 5 秒，普通语句与空闲事务最多 15 秒。通知和协作失效的 `LISTEN` 各在所属进程中占用一条专用连接，连接报告 `error` 或干净 `end` 时均清除旧启动状态，断线重连使用最长 30 秒的指数退避。迁移脚本使用独立连接配置，不受应用语句时限影响。

`pg` 是 Node.js PostgreSQL 驱动，不是可视化数据库工具。查看本地数据优先使用 `npm run db:studio`。

## 当前业务表

### Better Auth 身份表

- `user` 保存本地用户 ID、唯一邮箱、邮箱验证状态、姓名和头像，是身份资料的权威来源。
- `session` 保存有过期时间的登录会话；`token` 唯一，`user_id` 外键在用户删除时级联清理。
- `account` 保存邮箱密码或其他认证提供方账户；`(issuer, account_id)` 唯一，`user_id` 外键在用户删除时级联清理。
- `verification` 保存邮箱验证和密码重置等短期令牌，按 `identifier` 建立查询索引。

认证表由 `src/libs/Auth.ts` 通过现有 `db` 实例交给 Better Auth Drizzle adapter 使用，不创建第二套连接池。Better Auth 只负责身份和账户生命周期；Workspace、Project、成员及权限仍由业务表和权限模块负责。

### `workspaces`

- UUID 主键，名称最长 80 字符。
- `kind` 为 `personal` 或 `team`，决定其中所有项目的权限模式。
- `owner_id` 保存唯一所有者的 Better Auth 用户 ID，是 Workspace 所有权的权威字段。
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
- `owner_id` 保存 Better Auth 用户 ID。
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
- `parent_id` 可空自引用外键指向 `documents.id`，实现项目内无限层级父子文档嵌套；删除父文档时级联删除其所有子孙文档。
- `sort_order` 双精度浮点数（`double precision`），用于兄弟节点间的排序（基于 Fractional Indexing）。
- 标题最长 200 字符。
- `content` 使用 `JSONB` 保存 ProseMirror JSON，默认内容是包含一个空段落的 `doc` 根节点。
- `content_schema_version` 记录应用文档结构版本，当前为 `1`。
- `search_text` 纯文本投影列，在单人保存或协作状态落库时同步由 ProseMirror 树提取并持久化，供全文检索直接匹配。
- `created_by_id` 通常保存创建者的 Better Auth user ID，不建立本地用户外键；账户删除但 Document 保留在其他人 Project 中时改为 `deleted_user`。
- `(project_id, updated_at)` 索引支持读取项目文档并按更新时间排序。
- `(project_id, parent_id, sort_order)` 索引支持层级树构建与同级排序。
- `documents_search_text_trgm_idx` 与 `documents_title_trgm_idx` 分别为 `search_text` 和 `title` 建立基于 `pg_trgm` 扩展的 GIN 三元组倒排索引，支持全文模糊检索直接命中索引。

### `document_collaboration_states`

- `document_id` 是指向 `documents.id` 的主键外键；删除文档时数据库级联删除协作状态。
- `state` 使用 `BYTEA` 保存 `Y.encodeStateAsUpdate()` 产生的完整二进制状态，不保存 Y.Doc JSON 或逐条更新日志。
- `document_schema_version` 记录生成状态时使用的应用文档 Schema 版本；`initialized_at` 和 `updated_at` 记录初始化与最近持久化时间。
- 数据库保证每篇文档至多一条状态；只有 Team 文档允许初始化的跨表规则由应用入口执行。功能开关启用时，普通 Team 文档页面通过 Provider 和协作服务初始化或更新该表；Personal 文档和功能开关关闭时的 Team 只读页面不会写入协作状态。
- 与项目相同，`updated_at` 由 Drizzle 写入路径更新，不是数据库触发器。
- `project_members` 角色变化或删除、Better Auth Session 到期字段变化或删除，以及文档移动或删除会在事务提交后向 `knowmesh_document_collaboration` 发布不含正文、Cookie 或 Token 的失效信号。协作进程收到信号后重新查询 Session 与权限，再决定是否关闭连接；15 秒周期复查用于覆盖监听器短暂断线。

### `notifications`

- UUID 主键，通知按 Better Auth `recipient_user_id` 归属用户，不随当前 Workspace 切换。
- `actor_user_id` 可空；触发者账户删除后置空，收件人账户删除后删除其通知。
- `type` 使用通知事件枚举；`title` 和 `body` 保存事件发生时的展示快照。
- 可选的 `target_kind` 与 `target_id` 必须同时为空或同时存在。目标是 Workspace 或 Project 的多态历史上下文，不建立外键，因此资源删除不会删除通知。
- `read_at` 为空表示未读；`(recipient_user_id, created_at DESC)` 支持最近通知列表，收件人未读部分索引支持角标统计。
- `(recipient_user_id, target_id) WHERE type = 'workspace_invited' AND target_kind = 'workspace'` 部分唯一索引保证同一用户和 Workspace 只有一条邀请通知；应用仍用 `ON CONFLICT DO NOTHING` 把并发冲突收敛为幂等成功。

### `user_preferences`

- UUID 主键；每个用户最多一行，`user_id` 唯一索引既是 upsert 冲突目标也是读取隔离条件。
- `theme` 为 `light`、`dark`、`system` 枚举，默认 `system`。
- 偏好是主题持久化真相源；根布局渲染读取的是 Server Action 同步写入的 `knowmesh-theme` cookie 镜像，不查询本表。
- Better Auth 删除账户前的业务清理流程删除该用户的偏好行。

### `starred_documents`

- `(user_id, document_id)` 联合主键。
- `document_id` 非空外键指向 `documents.id`，删除文档时数据库自动级联删除其收藏记录。
- `user_id` 保存 Better Auth 用户 ID 字符串。
- `(user_id, created_at DESC)` 索引支持按收藏时间倒序检索用户的收藏文档。
- 包含收藏记录创建时间。


当前已经加入 Better Auth 本地用户表。认证迁移完成后，业务表中的 `owner_id` 和 `user_id` 保存 Better Auth 字符串用户 ID；账户删除由应用事务同时删除该用户拥有的 Workspace、Project、其他业务关系和 Better Auth `user` 行。其他通知中的触发者引用置空，其他人 Project 中保留的 Document 使用 `deleted_user` 替换 `created_by_id`，因此这些业务引用不会全部直接级联到 `user`。

自 `0027_woozy_magus.sql` 起，上述用户引用关系由数据库外键兜底：归属类列（通知收件人、偏好、收藏、成员、访问请求、邀请双方、Workspace/Project 的 owner）对 `user.id` 级联删除；`notifications.actor_user_id` 为可空外键并随触发者删除置空，与既有清理语义一致。两个例外保持无外键：`audit_logs.actor_user_id` 在账户删除后必须保留审计历史，`documents.created_by_id` 会被替换为哨兵值 `deleted_user` 而非真实用户行。同一迁移把全部时间戳列统一为 `timestamptz`（按 UTC 解释存量值），为 `project_invitations` 补充七天过期的 `expires_at`（存量行按 `created_at + 7 天` 回填），并新增 `(workspace_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL` 部分唯一索引防止重复待处理工作区邀请；迁移在清理孤儿行与回填期间临时禁用 owner 不变量触发器。

自 `0029_majestic_orphan.sql` 起，`audit_logs.workspace_id` 也不再引用 `workspaces`：它保存产生事件时的稳定 Workspace UUID，而不是活跃资源关系。该边界保证删除 Workspace 后旧历史和同事务写入的 `workspace_deleted` 事件仍存在；普通业务子表仍继续通过外键级联清理。

自 `0030_flowery_domino.sql` 起，`documents.title_version` 独立记录标题保存版本，不受协作正文更新 `updated_at` 影响。标题更新递增版本并在事务提交后向协作失效频道发布标题、文档 ID 与新版本；协作进程只把该消息广播给当前文档房间，不把标题写入 Y.Doc。

## 数据库约束与应用层不变量

数据库当前直接保证：主键和外键有效、成员关系唯一、关键字段非空、Project 成员一定属于同一 Workspace、资源 owner 与唯一 owner 成员一致，以及删除上级资源或 Workspace 成员时按外键级联清理下级关系。

数据库当前仍不能独立保证：

- Workspace 类型和角色如何映射为项目能力；该规则由应用权限策略执行。
- Personal Workspace 没有额外成员，且其中项目没有 `editor` 或 `viewer`。
- `documents.content` 中的 JSON 符合 ProseMirror Schema。
- `content_schema_version` 与实际 JSON 结构语义一致。

Owner 完整语义由部分唯一索引和 PostgreSQL `DEFERRABLE INITIALLY DEFERRED` 约束触发器共同维护。触发器在事务结束时检查，因此创建或转让可以在同一事务中依次写资源表与成员表；如果最终 `owner_id`、owner 成员身份或 owner 角色不一致，事务提交会失败。Drizzle Schema 能声明索引和外键，但不能表达这些跨表延迟触发器，其权威实现位于 `0010_silly_nomad.sql`。

通知实时信号由 `0021_notification_realtime_delivery.sql` 建立并由 `0028_blushing_moonstone.sql` 扩展。`notifications` 插入、删除及 `read_at` 更新会调用事务性 `pg_notify`；PostgreSQL 仅在事务提交后投递信号，载荷只包含收件人、事件种类和通知 ID，应用收到信号后重新读取持久化内容与未读数。

文档内容结构和版本一致性由文档 Server Action 维护。数据库只保证值是合法 JSON，不理解 ProseMirror 节点语义；绕过应用直接写入可能产生编辑器无法解释的内容。
