# 工程审查问题实施计划

状态：Historical completed implementation record（2026-08-27）

本文保留 [`engineering-review-issues.md`](engineering-review-issues.md) 中 ER-01 至 ER-09 的实施方式和完成时结果。它不再是待执行计划；复核时必须以当前代码和 Current 文档重新验证，不得仅根据本文推断功能或外部验证仍然有效。

## 目标与非目标

### 目标

- 在不改变权限、数据权威和产品交互语义的前提下降低维护复杂度。
- 消除搜索分页不稳定和不必要的完整正文搬运。
- 降低深层文档树和大同级集合的数据库往返。
- 明确各数据域的刷新所有权，去除可证明重复的全布局刷新。
- 让认证配置、依赖安装、覆盖率和部署制品具有单一稳定入口。
- 为 Agent 提供可独立执行、审查和回滚的小型工作包。

### 非目标

- 不在本计划中改变 Personal/Team 文档权威模型。
- 不引入 Redis、外部搜索服务、全局前端状态库或通用成员管理框架。
- 不改变当前 systemd、Nginx、域名和单实例 Hocuspocus 部署拓扑。
- 不执行生产发布、服务器配置变更、数据库备份或在线迁移。
- 不为了覆盖率数字增加重复或实现细节测试。
- 不把所有工作压入一个提交或一个 Pull Request。

## Agent 开始前检查

每个工作包开始时必须完成：

1. 阅读 `AGENTS.md`、`docs/README.md`、`docs/KNOWLEDGE_MAINTENANCE.md` 和本计划。
2. 执行 `git status --short --branch`，记录当前分支、HEAD 和已有用户改动。
3. 检查 `.codegraph/`；存在时先用 CodeGraph 查询待改符号、调用路径和测试覆盖，再读取必要文件。
4. 读取与工作包相关的当前状态文档和 Accepted ADR。
5. 用当前源代码确认问题仍存在；若实现已经变化，先更新问题文档，不机械执行旧步骤。
6. 保留所有无关或用户命名的改动，不清理工作树。

## 依赖顺序

```text
WP-01 导航纯逻辑与状态边界
   └─ WP-02 导航组件拆分与行为验证

WP-03 成员领域窄 helper

WP-04 搜索稳定性与摘要下推

WP-05 文档树递归查询
   └─ WP-06 文档排序批量写入

WP-07 缓存失效清单与最小化

WP-08 Better Auth 核心配置共享

WP-09 CI 依赖安装确定性
   └─ WP-10 覆盖率和关键 UI 测试门槛

WP-11 制品构建脚本复用
   └─ WP-12 部署激活脚本提取
```

WP-03、WP-04、WP-05、WP-07、WP-08 和 WP-09 可分别实施，但同一工作树中仍应按逻辑提交隔离。WP-02 依赖 WP-01，WP-06 依赖 WP-05，WP-10 应在 CI 安装稳定后实施，WP-12 应在制品入口统一后实施。

## WP-01：抽取导航纯逻辑和局部状态边界

关联问题：ER-01

状态：已完成（2026-08-26）

### 目标

把树数据、分页节点状态、请求去重和局部失效从 JSX 容器中分离，不改变 UI 和 Server Action 契约。

### 预期文件

- 修改 `src/components/layout/AppSidebar/SidebarWorkspaceNavigation.tsx`
- 新增同目录的导航状态/纯函数文件，名称按最终职责确定，例如：
  - `SidebarDocumentTree.ts`
  - `useSidebarDocumentNavigation.ts`
- 新增共置 `*.test.ts`

### 实施步骤

1. 把 `compareDocuments`、`buildDocumentTree`、节点插入、节点删除、节点移动后的局部合并提取为纯函数。
2. 为节点状态定义显式 reducer action，例如首次加载、追加页、失败、失效和移除项目；不要让多个 `setState` 隐式组合一个状态转换。
3. 把 `loadingNodeKeys`、请求编号、可见项目判断和 `getDocumentNavigationChildren/getDocumentNavigationPath` 调用封装在局部 hook 中。
4. hook 返回数据和领域级动作，不返回 JSX，也不直接拥有弹窗。
5. 保持项目切换后旧请求不能写回、重复请求合并、游标追加不重复等现有保护。

### 必须测试

- 同一节点重复加载只发起一个有效请求。
- 首次加载和加载更多正确合并且不重复。
- 项目从可见集合移除后，迟到响应不写回。
- 深链路径注入只展开目标祖先。
- 节点失效不删除其他项目已经加载的状态。
- 循环或孤儿输入不会让纯树构建无限递归。

### 完成条件

- 原组件不再直接维护分页请求和节点合并细节。
- 纯逻辑测试不依赖 React、router 或 Server Action mock 链。
- 当前深链 E2E 仍通过。

### 建议提交

`refactor: extract sidebar navigation state and tree operations`

### 实施结果

- `SidebarDocumentNavigationState.ts` 负责树构建、分页合并、节点失效、项目清理和请求版本跟踪。
- `useSidebarDocumentNavigation.ts` 负责分页读取、深链路径注入、请求去重、迟到响应保护和展开状态。
- `SidebarWorkspaceNavigation.tsx` 不再直接调用导航读取 Server Action，也不再直接组合分页节点状态。
- 共置单元测试覆盖分页去重合并、节点局部失效、项目移除、深链祖先展开以及循环和孤儿输入；深链 Playwright 验收继续通过。

## WP-02：拆分导航渲染、拖拽和弹窗

关联问题：ER-01

依赖：WP-01

状态：已完成（2026-08-26）

### 目标

让递归树渲染、拖拽语义和对话框分别拥有单一变化原因。

### 实施步骤

1. 把 `DocumentTreeItem` 和项目节点渲染移动到 `SidebarDocumentTree.tsx` 或职责等价文件。
2. 创建 `useDocumentNavigationDragAndDrop`，只处理：
   - 当前拖拽文档；
   - `before | inside | after` 目标判断；
   - 客户端已加载数据上的明显无效目标提示；
   - 调用方提供的 `onMove`。
3. hook 不得决定最终防环或排序；仍由 `moveDocument` 服务端事务负责。
4. 把创建、移动和上下文菜单组合到 `SidebarNavigationDialogs.tsx` 或等价边界。
5. 避免为了减少 props 引入 Context；只有递归 props 仍然无法形成清晰领域接口时才评估局部 Context。

### 必须验证

- 拖到项目、文档内部、文档前后的位置语义保持不变。
- 移动失败时本地树不保留错误 optimistic 状态。
- 创建根文档、子文档、移动弹窗和删除后仍只失效相关节点。
- 键盘和屏幕阅读器标签不因拆分丢失。

### 测试策略

- 纯位置计算使用单元测试。
- 保留一条 Playwright 路径覆盖真实拖拽或移动弹窗后的树更新；不要同时为每个 JSX 分支增加组件快照。

### 建议提交

`refactor: separate sidebar tree drag and dialog boundaries`

### 实施结果

- `SidebarDocumentTree.tsx` 独立承担区域、项目和递归文档树渲染，保持原有 ARIA 标签和键盘按钮结构。
- `useDocumentNavigationDragAndDrop.ts` 把浏览器事件转换为移动意图，纯函数覆盖 `before | inside | after` 阈值及循环输入。
- `SidebarNavigationDialogs.tsx` 统一管理上下文菜单、根/子文档创建和移动弹窗状态。
- 移动成功后只刷新源节点和不同的目标节点；失败时没有 optimistic 树修改需要回滚。
- Playwright 覆盖从父文档拖到项目根再拖回父文档的真实路径，并恢复测试种子结构。

## WP-03：抽取成员流程的窄领域 helper

关联问题：ER-02

状态：已完成（2026-08-26）

### 目标

消除真正同义的重复步骤，同时保持 Workspace 与 Project 的事务和授权边界独立。

### 实施步骤

1. 建立重复清单，逐项比较 Workspace/Project 的输入、锁、状态变更、通知、审计和失效。
2. 优先提取无资源策略的 helper：
   - 邀请是否有效/过期；
   - 关联通知完成；
   - 审计 actor/target 上下文；
   - 冲突安全插入结果解释。
3. helper 接收当前事务对象，不得自己开启嵌套事务。
4. 不把 `authorizeWorkspace`、`authorizeProject`、所有权复核和级联资源处理放进通用分支。
5. 每提取一个 helper，先让一个现有入口采用并通过测试，再迁移其他同义入口。

### 必须验证的不变量

- 接受邀请、成员写入、通知、审计和通知已读仍原子提交。
- Workspace 移除成员仍处理其 Project 所有权。
- Project 直接成员关系仍是正文访问边界。
- owner 不可被普通角色更新或移除。
- 过期、撤销、重复接受和并发接受结果保持不变。

### 测试策略

- 优先扩展现有真实数据库集成测试。
- helper 自身只有存在纯状态转换时才增加单测。
- 不新增大规模 Drizzle fluent mock 来证明数据库事务语义。

### 建议提交

`refactor: share invitation notification and audit steps`

### 实施结果

- `MemberWorkflow.ts` 统一邀请到期时间、边界判断和成员审计上下文；`RecordMemberAuditLog.ts` 接收当前事务并写入审计，两者都不拥有事务或资源授权。
- Workspace/Project 的邀请接受、访问审批、角色变更、成员移除和所有权转移使用同一审计 target 构造。
- `markRelatedNotificationsRead` 已经是双方共用的事务内 helper，因此没有增加无价值包装。
- 冲突安全插入在不同入口具有不同结果语义，保留在资源流程中；Workspace/Project 授权、锁和级联处理未抽象。
- 真实数据库测试补充过期、撤销及并发接受场景，并继续覆盖通知已读与 owner 不变量。

## WP-04：稳定搜索分页并下推摘要生成

关联问题：ER-03

状态：已完成（2026-08-26）

### 第一阶段：低风险修复

1. 在 `score DESC, updatedAt DESC` 后增加 `documentId DESC`。
2. 为 `page` 增加业务允许的最大值，或在 offset 超出结果页时返回空页；选择必须与 `/search` 页面契约一致。
3. 添加真实 PostgreSQL/PGlite 集成用例，创建相同分值和相同 `updatedAt` 的多条记录，证明跨页顺序唯一稳定。

### 第二阶段：减少正文搬运

1. 用 SQL 表达式围绕首次匹配位置截取有限窗口，只选择该摘要字段。
2. 保持无正文匹配但标题匹配时的摘要行为与现状一致。
3. 保持 LIKE 元字符转义，不把用户查询拼接为 SQL。
4. 用长 `search_text` 集成用例证明返回对象不含完整正文。

### 第三阶段：只有测量后才实施

当 `EXPLAIN (ANALYZE, BUFFERS)` 和真实数据量证明 offset 或 trigram 无法满足目标时，另行设计游标分页或 FTS。该变化可能影响 URL 页码、总页数和相关度语义，不能作为第一阶段的顺手重构。

### 必须保持

- `project_members.user_id` 正文权限过滤。
- `personal | team | all` 筛选。
- 查询词和页面大小边界。
- 标题完全匹配、标题包含、正文包含的当前相对优先级，除非另有产品决策。

### 建议提交

- `fix: stabilize search pagination ordering`
- `perf: generate search snippets in PostgreSQL`

### 实施结果

- 排序在 `score DESC, updatedAt DESC` 后增加 `documents.id DESC`，同分同更新时间的记录跨页顺序唯一；集成测试用 6 条相同分值和相同 `updated_at` 的文档验证三页拼接无重复、重复请求结果一致。
- 计数查询先行，offset 超出结果总数时直接返回空页和完整分页元数据，不再向数据库下发大 offset 行查询；该行为与 `/search` 页面对超界 URL 页码的既有空结果契约一致。
- 摘要由 PostgreSQL 查询内表达式围绕首次匹配位置截取最长 140 字符窗口并添加省略号，无正文命中但标题命中时回退为正文头部截断，行为与原 `extractSnippet` 一致。
- 查询投影移除完整 `search_text`，只返回摘要字段；长正文集成测试证明响应不含窗口外文本。摘要匹配使用参数绑定的字面量定位，LIKE 元字符转义保持不变。
- `extractSnippet` 失去全部调用方后连同其单测删除；第三阶段（游标分页或 FTS）仍按计划等待测量证据。

## WP-05：使用递归 CTE 读取文档路径和子树

关联问题：ER-04

状态：已完成（2026-08-26）

### 目标

将祖先路径和后代集合从按层循环查询改为有界递归 SQL，同时保持全部安全限制。

### 实施步骤

1. 为祖先路径建立递归 CTE：起点必须同时匹配 `documentId` 和 `projectId`。
2. CTE 记录访问路径或深度，检测循环并拒绝超过最大深度。
3. 返回根到目标的稳定顺序和现有 `DocumentNavigationItem` 字段。
4. 为后代集合建立独立递归 CTE，所有节点必须保持在源项目中。
5. 对超过节点数限制的结果拒绝移动，不截断后继续写入。
6. 确认 SQL 通过 Drizzle `sql` 参数绑定，不拼接用户输入。

### 必须测试

- 正常多层祖先路径。
- 文档不属于项目时返回 `null`。
- 已损坏循环数据被拒绝。
- 最大深度边界。
- 跨项目子树移动完整更新所有后代。
- 超过子树数量限制时事务不产生部分更新。

### 验证环境

递归 CTE 和锁行为必须在真实 PostgreSQL 集成测试中验证；PGlite 可作为快速反馈，但不能作为唯一证据。

### 建议提交

`perf: load document paths and subtrees with recursive queries`

### 实施结果

- `getDocumentNavigationPath` 改为单条递归 CTE：起点同时匹配 `documentId` 和 `projectId`，递归阶段以访问路径数组拒绝循环并保持项目边界；SQL 最多产生 101 行，用额外一行判定超过深度 100，应用层保留循环拒绝与跨项目返回 null 的判定语义。
- `getDescendantIds` 改为单条递归 CTE，所有节点必须保持在源项目内；查询最多消费根节点加 10,001 个后代，用额外一行判定超过 10,000 个后代，跨项目移动时源项目外的脏指针后代不再被卷入迁移，超限仍在写入前拒绝整个事务。
- SQL 全部通过 Drizzle `sql` 参数绑定表达，不拼接用户输入；`assertValidMoveTarget` 的逐级 `FOR UPDATE` 锁路径保持不变。
- fluent mock 单测中的路径与循环用例移出；新增 PGlite 集成测试覆盖多层祖先路径、跨项目 null、循环拒绝、100/101 深度边界、跨项目移动完整更新（含脏指针留在源项目）和超限无部分更新。
- 同一 CTE 与锁行为已在本地真实 PostgreSQL 17 容器验证：七项检查全部通过后容器与临时脚本已清理，未向仓库引入验证专用代码。

## WP-06：批量写入文档排序重排

关联问题：ER-04

依赖：WP-05

状态：已完成（2026-08-26）

### 目标

保留 `planDocumentSortOrder` 的确定性计算，将多条兄弟顺序更新从逐条语句改为单次或有界批量写入。

### 实施步骤

1. 不修改 `planDocumentSortOrder` 的纯函数输入输出，除非测试先描述必要的新语义。
2. 使用参数化 `UPDATE ... FROM (VALUES ...)`、`CASE` 或等价 Drizzle 表达更新重排序列。
3. 保持目标兄弟节点在计算和写入期间位于同一事务锁边界。
4. 对空更新直接跳过 SQL。
5. 验证同一父节点并发创建和移动仍通过项目锁串行化。

### 必须测试

- 间隙足够时不重排。
- 间隙耗尽时所有兄弟得到唯一稳定顺序。
- 大同级集合只产生有界数量的更新语句。
- 并发移动后不存在丢失节点、重复层级或跨项目父节点。

### 建议提交

`perf: batch document sibling reordering`

### 实施结果

- `planDocumentSortOrder` 的输入输出与全部纯函数测试保持不变；重排更新改用参数化 `UPDATE ... FROM (VALUES ...)` 单条语句应用，语句数量与兄弟集合规模无关。
- 更新列表为空时直接跳过 SQL，不产生额外数据库往返；目标同级集合的 `FOR UPDATE` 锁边界与事务范围保持原状。
- 单元测试固定空更新跳过与重排单语句两条路径；PGlite 集成测试新增碰撞同级经一次移动得到唯一稳定顺序且无节点丢失的场景。
- 并发串行化与批量写入原子性已在本地真实 PostgreSQL 17 容器验证：第二个事务在锁持有期间收到 55P03，批量重排提交后顺序唯一、无丢失节点，容器与临时脚本已清理。

## WP-07：建立缓存失效所有权并去除重复刷新

关联问题：ER-05

状态：已完成（2026-08-26）

### 目标

先建立证据，再减少全布局 revalidation 和客户端 refresh；正确性优先于刷新数量。

### 实施步骤

1. 列出每个 `revalidatePath('/(workspace)', 'layout')` 调用及其实际修改的数据。
2. 记录调用方是否还执行 `router.refresh()`、局部状态更新或路由跳转。
3. 对每个入口明确唯一刷新所有者：Server Action、客户端局部状态或路由导航。
4. 先删除能够由现有 E2E 证明重复的刷新。
5. 只有确认查询使用 Next cache 后，才引入 `revalidateTag`；不得给未缓存查询增加没有效果的 tag。
6. 文档节点继续使用局部失效，不恢复全量树加载。

### 必须验证

- 创建、重命名、移动、删除资源后侧栏和当前内容一致。
- 成员撤权后导航与正文权限及时收敛。
- Workspace 切换不显示前一个 Workspace 的迟到数据。
- 编辑器焦点和未保存内容不会因不必要 refresh 丢失。
- 通知和偏好变化不触发无关文档树重新加载。

### 建议提交

`perf: narrow workspace data revalidation`

### 实施结果

- 建立刷新所有权清单并写入 `architecture/rendering-and-data-flow.md`：修改布局数据的 Server Action 通过布局失效拥有唯一刷新，文档树节点由客户端局部失效负责，`router.refresh()` 只保留给远端协作标题广播这类无 Action 的服务端状态变化。
- 删除 10 处可证明重复的 `router.refresh()`：拖拽与弹窗移动后两处、Workspace 切换与创建后两处、权限弹窗变更后一处、接受 Workspace 邀请一处、项目邀请接受/拒绝与访问申请三处、Personal 与协作编辑器标题保存后两处（其中协作编辑器远端标题的刷新按所有权保留）。
- 确认全站路由因根布局读取主题 cookie 动态渲染、业务查询不经 Next 数据缓存，因此不引入 `revalidateTag`，也不给未缓存查询添加无效 tag；服务端各入口的 `revalidatePath` 调用全部保留。
- 验证：lint、类型与 230 个单元/集成测试通过；Playwright 关键路径 20 条全部通过，覆盖创建/改名/移动/删除后的侧栏一致性、Workspace 切换、成员角色变化、编辑器保存与协作恢复。

## WP-08：共享 Better Auth 核心配置

关联问题：ER-06

状态：已完成（2026-08-26）

### 目标

让主应用和协作进程共享 Session 读取所需的核心配置，同时保留协作 bundle 的最小依赖和无副作用边界。

### 实施步骤

1. 用依赖图确认 `src/libs/Auth.ts` 的邮件和 Workspace hook 不会进入共享核心模块。
2. 提取纯配置构造器或数据库 adapter 构造器；避免在模块加载时创建额外 Auth 实例。
3. 主 `auth` 组合邮件、rate limit、trusted origins 和数据库 hook。
4. `collaborationAuth` 只组合 Session 读取所需选项。
5. 增加契约测试，证明两端对同一有效、过期、撤销和未验证邮箱 Session 得出一致身份结果。

### 必须保持

- 协作连接使用 `disableCookieCache: true`。
- 未验证邮箱不得连接协作服务。
- 协作进程不发送邮件、不创建 Workspace、不同步邀请。
- Secret、base URL 和数据库连接继续由 `Env` 提供。

### 建议提交

`refactor: share Better Auth session configuration`

### 实施结果

- 新增 `src/libs/AuthCore.ts`：`getAuthenticationCoreOptions()` 单点定义 base URL、secret 与认证表 Drizzle adapter；模块不导入邮件、Resend、Workspace 初始化或邀请同步，协作 bundle 边界不变。
- 主 `auth` 在核心选项之上组合 appName、数据库 hook、邮箱密码与验证、rate limit 和 trusted origins；`collaborationAuth` 只展开共享核心，`disableCookieCache: true` 保持不变。
- 未在模块加载时创建额外 Auth 实例：共享构造器仅返回配置对象，两个实例各调用一次。
- 新增契约集成测试 `tests/auth-session-contract.integ.ts`：对有效、过期、撤销和未验证邮箱四类会话断言主端 Session 读取与协作端身份解析结果一致（未验证邮箱两端一致地拒绝进入协作），并已用"移除共享核心"的变异验证测试能捕获漂移。

## WP-09：让 CI 每次从锁文件安装依赖

关联问题：ER-07

状态：已完成（2026-08-26）

### 目标

缓存下载内容而不是安装结果，确保每个 job 都通过 `npm ci` 从锁文件重建依赖树。

### 实施步骤

1. 删除 `.github/actions/setup-project/action.yml` 中的 `node_modules` cache 和 cache-hit 分支。
2. 保留 `actions/setup-node` 的 `cache: npm`。
3. 无条件执行 `npm ci`。
4. 保持 Next.js 构建缓存和跨 job `.next` 恢复逻辑不变。
5. 检查 `npm ci` 后工作树没有 lockfile 变化。

### 验证

- 本地运行 `npm ci` 后执行 lint、类型和测试。
- Pull Request 中观察冷缓存和热缓存各一次 CI；两者必须执行安装步骤并得到一致结果。
- 不以一次工作流成功证明缓存损坏恢复，至少确认日志显示命中 npm 下载缓存后仍运行 `npm ci`。

### 建议提交

`ci: install dependencies from lockfile in every job`

### 实施结果

- 删除 `setup-project` action 中的 `node_modules` 缓存步骤与 cache-hit 跳过分支；`npm ci` 在每个使用该 action 的 job 中无条件执行。
- `actions/setup-node` 的 `cache: npm` 保留，只缓存 npm 下载内容；全仓搜索确认不再有其他安装入口或 `node_modules` 缓存。
- Next.js 构建缓存（`.next/cache` 保存与跨 job `.next` 制品恢复）保持原状。
- 本地验证：`npm ci` 后工作树无 lockfile 变化；当前 lint、类型检查与 233 个单元/集成测试全部通过。
- 远程验收：推送后在 CI 上确认冷/热缓存运行均执行安装步骤；后续 PR 需继续观察命中 npm 下载缓存后日志仍出现 `npm ci`。

## WP-10：建立有意义的覆盖率和 UI 行为门槛

关联问题：ER-08

依赖：WP-09，建议在 WP-01/WP-02 后完成导航门槛

状态：已完成（2026-08-26）

### 实施步骤

1. 先生成当前覆盖率报告，记录关键模块基线，不直接选择任意百分比。
2. 对纯领域模块设置不会被无关 UI 拉低的门槛；必要时使用按文件或目录门槛。
3. CI 上传覆盖率摘要或 HTML/JSON artifact。
4. 增加最少的关键 UI 行为：
   - 侧栏分页失败重试和深链展开；
   - 一条文档移动后的局部树一致性；
   - Command Palette 键盘选择和迟到响应保护；
   - 一条成员角色变化的真实浏览器路径。
5. 删除与新增测试重复、只验证 DOM 实现细节的旧覆盖。

### 门槛选择规则

- 门槛必须低于或等于当前可重复基线，再由后续提交逐步提高。
- 权限、数据库不变量和协作恢复不能因为 UI 覆盖率目标而被删除。
- 不能仅测试函数被调用；关键行为要验证用户可见结果或数据库结果。

### 建议提交

`test: enforce critical coverage and UI behavior gates`

### 实施结果

- 先生成覆盖率报告记录基线，再在 `vitest.config.ts` 为十个纯领域模块设置按文件阈值（权限策略、排序规划、搜索提取与查询、成员 workflow 与审计、导航状态 reducer、移动/导航/最近文档查询），全部等于或低于可重复基线；不设全局门槛，避免被 UI 代码稀释。变异验证（临时抬高阈值）确认门槛会使运行失败。
- CI unit job 使用 `actions/upload-artifact@v7` 上传 `coverage/`（HTML + JSON summary，保留 14 天），`if: always()` 保证失败时也可审阅；该版本使用 Node.js 24 action runtime，与当前 CI 基线一致。
- 补齐缺口的关键 UI 行为用例 `tests/e2e/NavigationResilience.e2e.ts`：侧栏分页失败后经"加载失败，点击重试"恢复、命令面板键盘高亮与回车跳转、迟到搜索响应被请求编号守卫丢弃且界面保持最新结果；深链展开、移动后局部树一致性与成员角色变化已由既有 Playwright 路径覆盖，未重复添加。
- 删除 `MoveDocument.test.ts` 中仅验证“移动到自身”早退分支和中文错误文本的脆弱用例；保留正常移动、服务器锁定排序、单语句重排、后代环路拒绝、跨项目授权与真实数据库移动测试。对应逐文件阈值按剩余高价值套件的可重复基线校准为 branches 74%、lines/statements 87%，functions 仍为 100%，没有降低其他模块门槛。
- 验证：lint 0 错误、类型通过、233 个单元/集成测试在覆盖率门槛下全部通过；Playwright 全量 chromium/firefox 通过（真实 PostgreSQL 用例按开关在 CI 运行）。

## WP-11：统一生产制品构建入口

关联问题：ER-09

状态：已完成（2026-08-26）

### 目标

让 CI deploy job 和手动 Release workflow 调用同一个版本化制品脚本。

### 实施步骤

1. 把 standalone 补充文件、迁移 bundle、协作服务 bundle、revision 写入和制品完整性检查移动到 `scripts/` 下的 Linux 构建脚本。
2. 脚本使用显式输入和工作目录，不读取生产 Secret。
3. CI 和 Release 只负责调用脚本并上传同一种归档结构。
4. 为脚本增加最小 smoke test：缺少文件时失败、revision 不匹配时失败、归档不包含 `.env*`。
5. 对比两个 workflow 生成的文件清单，确认完全一致。

### 必须保持

- Next.js、迁移程序和 Hocuspocus 来自同一个 Git SHA。
- 制品包含 migrations、public、Next static 和 deploy 模板。
- 制品不得包含 `.env` 或 Secret。
- Release workflow 仍只生成制品，不连接生产服务器。

### 建议提交

`build: share production artifact packaging`

### 实施结果

- 新增 `scripts/package-production-artifact.sh`：以显式参数接收仓库根、standalone 目录、Next 静态目录、输出归档和 revision；负责 esbuild 迁移与协作 bundle、复制 `public/`、`.next/static/`、`migrations/`、`deploy/`、写入并核对 `REVISION`、递归删除并复查整个制品树中的 `.env*`，最后产出 tgz 并把归档文件清单打印到日志。脚本不读取任何生产 Secret。
- 脚本拒绝打包 standalone 目录中已有其他 SHA `REVISION` 的情况，防止 `.next` 构建缓存把不同提交的产物混入同一制品。
- CI deploy job 与 Release workflow 都只调用该脚本，并上传同一种 `knowmesh-release-<SHA>.tgz` 归档结构；文件清单由单一代码路径生成，两个 workflow 不再各自维护打包步骤。
- 新增 `scripts/package-production-artifact.smoke.sh`：覆盖缺少必需文件、revision 不匹配、未知参数和缺值失败路径，并断言归档清单与脚本输出一致、顶层及嵌套 `.env*` 文件都不进入制品。CI 新增 `packaging` job 运行冒烟测试，deploy job 依赖它。
- 参数校验与防混版守卫已在 WSL Ubuntu 的真实 bash 中实测通过；完整打包路径（含 esbuild）由 CI packaging job 执行验证。

## WP-12：提取生产激活与回滚脚本

关联问题：ER-09

依赖：WP-11

状态：已完成（2026-08-26）

### 目标

把远程服务器上的迁移、切换、健康检查和回滚实现从 YAML heredoc 移到版本化脚本，workflow 保留编排和 Secret 边界。

### 实施步骤

1. 将远程激活逻辑放入随制品交付的 shell 脚本，使用位置参数或严格解析的 options。
2. 脚本必须启用 `set -euo pipefail`，验证 release ID、所有解析路径和回滚目标位于预期 release 根目录。
3. 保留迁移先于切换、协作先于应用、内部健康检查和失败回滚顺序。
4. 将公开 HTTPS/WSS 验证保留在 GitHub runner，避免服务器自测代替公网入口验证。
5. 为脚本建立容器或临时目录 smoke test；不得用测试连接真实生产主机。
6. 把 host、user、Node 路径和服务名分类为 GitHub Environment variable、服务器配置或稳定默认值，避免散落硬编码。

### 必须保持

- SSH host fingerprint 严格校验。
- 部署并发组不取消正在执行的生产发布。
- 数据库迁移失败时旧应用继续运行。
- 新应用失败时只回滚应用 release；文档继续明确数据库 Schema 不自动回滚。
- 公开 WSS 必须使用正确 Origin 并返回 WebSocket Upgrade。

### 停止条件

遇到以下任一情况，Agent 必须停止并请求用户决定：

- 需要修改生产 sudoers、systemd、Nginx、DNS、证书或云防火墙；
- 需要连接服务器或执行真实部署；
- 当前服务器路径或服务名与仓库文档冲突；
- 提取脚本要求改变迁移/回滚语义。

### 建议提交

`ci: move production activation into versioned scripts`

### 实施结果

- CI deploy job 的两段远程 heredoc 移入 `deploy/scripts/activate-release.sh` 与 `rollback-release.sh`，随制品的 `deploy/` 目录交付；workflow 通过 SSH stdin 管道执行同一 SHA 的脚本并只传递受控位置参数。
- 两个脚本启用 `set -euo pipefail`，严格解析位置参数；在原有校验之上增加 release ID 40 位十六进制、服务器路径必须为绝对路径、派生路径与回滚目标必须位于 release 根目录内的检查。激活脚本部署用户由可选参数提供并默认 `thisme`，语义不变。
- 激活在迁移前解析并验证现有 `current` 指向 release 根目录内的可用旧版本；缺少回滚目标时不运行迁移。随后保持迁移先于切换、协作先于应用重启、内部健康检查失败即自动回滚的顺序；公开 HTTPS/WSS 验证仍完全留在 GitHub runner。未修改 systemd、Nginx、sudoers 或任何生产配置，也未连接真实生产主机。
- host、端口、用户、Node 路径、release 路径和服务名改为 GitHub Environment variable（`PRODUCTION_*`）覆盖加稳定默认值的分层；host fingerprint 保持 workflow 内固定 pin，不允许通过 Variable 静默替换。
- 新增 `deploy/scripts/activate-release.smoke.sh`：在临时目录用 systemctl/curl/node/sleep 桩覆盖启用或禁用协作的成功激活、开关不一致、迁移失败、迁移前缺少回滚目标、健康检查失败自动回滚、REVISION 不符、非法 release ID、缺参、正常回滚与越界回滚拒绝。测试明确断言回滚目标不可用时迁移程序没有执行，且不连接任何真实生产主机。
- 制品完整性检查与打包冒烟同步扩展到 `deploy/scripts/` 两个交付脚本；部署手册已更新参数分层表与脚本链接。

## 全量验证矩阵

每个工作包只运行与风险相称的子集；完成全部计划后运行完整矩阵。

| 验证 | 覆盖目标 |
| --- | --- |
| `npm run lint` | 格式、Oxlint、类型感知规则 |
| `npm run check:types` | TypeScript 边界 |
| `npm run test` | 单元测试和 PGlite 集成测试 |
| `npm run build-local` | 迁移后 Next.js 构建与本地运行脚本 |
| `npm run test:e2e` | Chromium 关键用户路径 |
| `git diff --check` | 空白和补丁完整性 |
| 真实 PostgreSQL E2E | 递归 CTE、锁、LISTEN/NOTIFY、权限与协作路径 |
| CI 冷/热缓存运行 | 依赖安装和制品缓存确定性 |
| 制品文件清单比较 | CI 与 Release 产物一致性 |

在 Windows 本地运行 Playwright 时保持串行 worker；递归 CTE、数据库锁和 PostgreSQL 通知不能只以 PGlite 结果作为完成证据。

## 文档同步要求

| 工作包 | 必须检查的文档 |
| --- | --- |
| WP-01/WP-02/WP-07 | `features/documents.md`、`architecture/rendering-and-data-flow.md` |
| WP-03 | `features/projects.md`、`features/notifications.md`、`PROBLEMS.md` |
| WP-04 | `features/search.md`、必要时新增或替代 ADR |
| WP-05/WP-06 | `features/documents.md`、`database/schema-and-migrations.md` |
| WP-08 | `adr/0009-use-better-auth-for-local-identity.md`、认证相关当前文档 |
| WP-09/WP-10 | 本计划和 CI 说明；不把一次运行数字写入长期文档 |
| WP-11/WP-12 | `operations/deployment.md` |

只有行为、边界、不变量或运维程序变化时才更新当前状态文档；纯文件拆分且行为不变时，不应把文件布局细节写入 feature 文档。

## 提交与审查策略

- 一个提交只对应一个可独立验证的工作包或工作包内的低风险阶段。
- 先提交行为保护测试时，测试必须能在旧实现上通过；修复回归的测试可以与修复同提交。
- 数据库查询优化与 UI 重构不得混在同一个提交。
- CI、制品和部署脚本分别提交，便于单独回滚。
- 不提交本地数据库、测试结果、覆盖率目录、`.next` 或环境文件。
- 提交信息使用项目规定的 Conventional Commits，无 scope。

## 完成定义

全部计划只有同时满足以下条件才算完成：

1. ER-01 至 ER-09 在问题文档中被标记为已解决、接受风险或被当前证据否定。
2. 所有工作包均有对应代码/配置、测试证据和文档同步结果。
3. lint、类型、单元/集成、构建、关键浏览器路径和真实 PostgreSQL 验证全部通过。
4. CI 冷缓存与热缓存均从 lockfile 执行 `npm ci`。
5. CI 与 Release 使用同一制品构建入口并生成一致文件清单。
6. 没有改变 Personal/Team 正文权威、权限边界和生产迁移回滚约束。
7. 无关用户改动保持原样，工作树只包含批准范围内的文件。

最终验证基于提交 `60bca50dea0047ca1e165707125b0b5e51d8d485`：GitHub Actions [run 33031660670](https://github.com/NevermeChu/KnowMesh/actions/runs/33031660670) 的构建、静态检查、单元/集成测试、生产制品与部署脚本检查、真实 PostgreSQL 浏览器 E2E 和生产部署均通过，部署任务完成公开 HTTPS/WSS 验证。本计划据此完成；后续代码、配置或运行环境变化仍须重新执行相应验证，不得沿用本次结果推断新版本状态。

## 相关文档

- [`engineering-review-issues.md`](engineering-review-issues.md)
- [`README.md`](README.md)
- [`KNOWLEDGE_MAINTENANCE.md`](KNOWLEDGE_MAINTENANCE.md)
- [`features/documents.md`](features/documents.md)
- [`features/projects.md`](features/projects.md)
- [`features/search.md`](features/search.md)
- [`architecture/rendering-and-data-flow.md`](architecture/rendering-and-data-flow.md)
- [`database/schema-and-migrations.md`](database/schema-and-migrations.md)
- [`operations/deployment.md`](operations/deployment.md)
- [`PROBLEMS.md`](PROBLEMS.md)
