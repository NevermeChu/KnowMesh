# 工程审查问题说明

状态：Historical completed review（2026-08-27）

基线：`feature/permissions` 当前工作区；提交级 CI 与部署结果必须在交付时重新核验。

本文保留 ER-01 至 ER-09 在 2026-08-27 完成时的审查与整改记录，不再作为当前问题清单。当前实现以代码和 Current 文档为准；长期问题见 [`PROBLEMS.md`](PROBLEMS.md)。实施顺序、文件批次和当时的验证记录见 [`engineering-review-implementation-plan.md`](engineering-review-implementation-plan.md)。

## 结论摘要

当前实现没有因为以下问题而失去基本正确性：权限写入仍在事务内复核，文档树写入具有项目锁和循环检查，搜索正文仍受 Project 直接成员关系约束，Team 正文仍以 Yjs 状态为权威。问题主要表现为变化原因集中、查询成本随数据规模上升、缓存失效过宽，以及工程反馈不能阻止质量缓慢退化。

| 编号 | 问题 | 状态 | 主要风险 | 优先级 |
| --- | --- | --- | --- | --- |
| ER-01 | 侧栏导航承担过多职责 | 已解决 | 已拆分状态、拖拽、渲染和弹窗边界 | 中 |
| ER-02 | Workspace 与 Project 成员流程重复 | 已解决 | 共享稳定步骤，保留资源不变量边界 | 中 |
| ER-03 | 搜索分页缺少唯一稳定排序且搬运完整正文投影 | 已解决 | 排序以 documentId 收尾，摘要由数据库截取有限窗口 | 中 |
| ER-04 | 文档树读取和重排产生深度或节点数相关往返 | 已解决 | 路径、子树与重排写入均已收敛为单条 SQL | 中 |
| ER-05 | 工作区布局缓存失效范围过大 | 已解决 | 建立刷新所有权清单，去除可证明重复的客户端刷新 | 中低 |
| ER-06 | Better Auth 核心配置存在双重实例 | 已解决 | 共享核心配置构造器，契约测试固定两端一致 | 中低 |
| ER-07 | CI 缓存整个 `node_modules` 并跳过 `npm ci` | 已解决 | 每个 job 无条件从锁文件重建，只保留 npm 下载缓存 | 中 |
| ER-08 | 覆盖率没有门槛，高复杂度 UI 缺少行为保护 | 已解决 | 纯领域模块阈值门槛与关键 UI 行为用例就位 | 中低 |
| ER-09 | 部署实现集中在大型 YAML 且制品逻辑重复 | 已解决 | 制品打包与远程激活收敛为版本化脚本，workflow 只负责编排与传参 | 中 |

## ER-01：侧栏导航承担过多职责

状态：已解决（WP-01、WP-02 已完成）

### 当前实现

侧栏导航已经按变化原因拆分：

- `SidebarDocumentNavigationState.ts` 包含纯树构建、分页合并、节点失效、项目清理和请求版本跟踪；
- `useSidebarDocumentNavigation.ts` 管理导航读取、深链路径注入、请求去重、迟到响应保护和展开状态；
- `useDocumentNavigationDragAndDrop.ts` 只维护拖拽状态、位置计算、已加载树上的明显无效目标判断和移动意图；
- `SidebarDocumentTree.tsx` 只负责区域、项目和文档树渲染；
- `SidebarNavigationDialogs.tsx` 管理上下文菜单及创建、移动弹窗生命周期；
- `SidebarWorkspaceNavigation.tsx` 只组合上述边界、调用权威移动命令并刷新受影响节点。

### 现有保护

- 服务端仍负责权限、循环检测和最终排序，客户端拖拽结果不是权威。
- 分页使用稳定的 `(sortOrder, id)` 游标。
- 深链路径有循环和最大深度限制。
- 纯逻辑测试覆盖分页合并、失效、请求去重、拖拽位置和循环输入；Playwright 覆盖深链注入及真实项目/文档拖拽目标。

### 后续边界

- 继续保持局部 hook/reducer，不为单一侧栏引入全局状态库。
- 新增拖拽能力时只扩展移动意图，不把服务端防环和排序规则复制到客户端。
- 新增树视觉能力时保持 `SidebarDocumentTree.tsx` 不直接调用 Server Action 或路由刷新。

## ER-02：Workspace 与 Project 成员流程重复

状态：已解决（WP-03 已完成）

### 当前实现

`src/features/permissions/server/WorkspaceMembers.ts` 和 `ProjectMembers.ts` 分别实现邀请、接受、拒绝、访问申请、审批、角色变更、移除成员和所有权转移。两组 Server Action 反复组合：

- 输入 Schema 与 `requireUser()`；
- 资源授权和事务内所有权复核；
- 成员、邀请或访问申请写入；
- `createNotification`；
- `markRelatedNotificationsRead`；
- `recordAuditLog`；
- `revalidatePath('/(workspace)', 'layout')`。

稳定的跨资源步骤已经收敛：

- `MemberWorkflow.ts` 统一邀请到期时间、到期边界判断和成员审计 actor/target 上下文；
- `RecordMemberAuditLog.ts` 在调用方当前事务中写入标准成员审计 target，不拥有事务；
- `markRelatedNotificationsRead` 继续作为 Workspace/Project 共用的事务内通知完成入口；
- `createNotification` 与 `recordMemberAuditLog` 均接收当前事务，不创建嵌套事务；
- Workspace 链接/站内邀请继续共享 `acceptWorkspaceInvitationByCondition`。

冲突安全插入的结果没有增加统一包装：Workspace 邀请、Project 邀请和访问申请对冲突分别采用返回既有邀请、静默幂等或跳过通知等不同语义，强行统一会隐藏领域差异。

### 必须保留的差异

- Workspace 成员身份决定结构发现；Project 直接成员关系决定正文访问。
- Workspace 邀请以邮箱和令牌为边界；Project 邀请面向已存在的用户。
- Workspace owner、Project owner、Workspace role 和 Project role 的不变量不同。
- 移除 Workspace 成员必须处理其拥有的 Project；移除 Project 成员不具有同样的级联语义。
- 所有权转移需要各自的锁顺序和数据库不变量。

### 已建立的保护

- 纯函数测试固定七天邀请有效期、边界到期判断和成员审计上下文。
- 真实数据库测试覆盖有效、过期、撤销、重复/并发接受、通知已读和访问申请审批。
- owner 不变量集成测试继续覆盖普通角色修改、移除和所有权边界。

### 后续边界

- Workspace 与 Project 的授权、所有权锁、成员不变量和最终领域事务继续保留在各自模块中。
- 成功后的缓存失效归 ER-05/WP-07 处理，不并入成员 workflow helper。
- 只有新的步骤能证明输入、事务顺序、失败结果和副作用完全同义时才继续抽取；不得建立条件分支驱动的通用成员管理引擎。

## ER-03：搜索分页不稳定并搬运完整正文投影

状态：已解决（WP-04 第一、二阶段已完成）

### 当前实现

`searchWorkspaceContent`：

1. 通过 `project_members.user_id` 限制正文候选集；
2. 使用 `ILIKE` 匹配标题和 `documents.search_text`；
3. 以相关度分值和 `documents.updated_at` 倒序排列，并以 `documents.id DESC` 作为最终唯一排序键；
4. 计数查询先行；offset 超出结果总数时返回空页和完整分页元数据，不下发行查询；
5. 摘要由 PostgreSQL 在查询内围绕首次匹配位置截取最长 140 个字符的窗口，无正文命中但标题命中时回退为正文头部截断；
6. 应用层不再读取完整 `search_text`，只接收摘要表达式结果。

### 现有保护

- 查询词最大 200 个字符，`pageSize` 最大 100。
- `%`、`_` 等 LIKE 元字符被转义；摘要匹配使用参数绑定的字面量定位，不拼接用户输入。
- 标题和正文投影具有 `pg_trgm` GIN 索引。
- 集成测试覆盖正文权限、筛选、同分同更新时间的跨页顺序唯一性、超界空页和长正文不回传全量文本。

### 后续边界

- 保持页码 UI 契约；只有真实数据量证明 offset 或 trigram 不足时才另行设计游标分页或 FTS，不同时维护两套公开契约。
- 相关度权重（标题完全匹配、标题包含、正文包含）未经产品决策不得调整。

## ER-04：文档树操作产生深度或节点数相关往返

状态：已解决（WP-05、WP-06 已完成）

### 当前实现

`getDocumentNavigationPath` 使用单条有界递归 CTE 一次读取根到目标路径：起点同时匹配 `documentId` 与 `projectId`，递归阶段保持项目边界并以访问路径数组拒绝循环；数据库最多产生 101 行，用额外一行判定超过 100 层。数据库往返数不再随路径深度增加。

`moveDocument` 的跨项目后代集合同样由单条递归 CTE 读取，所有节点必须保持在源项目中；查询最多消费根节点加 10,001 个后代，超过 10,000 个后代时整个事务拒绝，不截断后继续写入。

排序间隙不足时的兄弟重排由 `planDocumentSortOrder` 纯计算后以单条 `UPDATE ... FROM (VALUES ...)` 参数化写入应用；空更新跳过 SQL。目标同级集合仍在计算和写入前通过 `FOR UPDATE` 加锁。

### 现有保护

- 深链最大 100 层，循环或超过深度的链路在事务外被明确拒绝。
- 移动子树最大 10,000 个后代，超限时事务不产生部分更新。
- 移动在事务内重新验证源和目标项目权限；项目行锁与同级锁保证并发创建和移动串行化。
- PGlite 集成测试覆盖多层路径、跨项目 null、循环拒绝、深度边界、跨项目移动完整更新、超限无部分更新和碰撞同级的唯一稳定重排。
- 同一路径、子树、重排与锁行为已在真实 PostgreSQL 17 容器中验证（祖先顺序、边界判定、源项目约束、超限计数、并发阻塞 55P03 和批量重排唯一性）。

### 后续边界

- 兄弟重排的纯计算职责保留在 `planDocumentSortOrder`，写入侧不得回退为逐条 UPDATE 循环。
- 递归 SQL 与批量写入继续通过 Drizzle 参数绑定表达，不拼接用户输入。

## ER-05：工作区布局缓存失效范围过大

状态：已解决（WP-07 已完成第一阶段：刷新所有权与重复删除）

### 当前实现

全部路由因根布局读取主题 cookie 而动态渲染，业务查询不进入 Next 数据缓存；`revalidatePath('/(workspace)', 'layout')` 的实际作用是清除客户端 Router Cache 并让 Action 响应携带当前路由的最新载荷。

刷新所有权按入口唯一分配：

| 数据域 | 变化入口 | 唯一刷新所有者 |
| --- | --- | --- |
| Workspace 列表与切换 | 创建、选择、删除 Workspace | Server Action（布局失效） |
| Project 导航 | 创建、重命名、删除项目 | Server Action（布局失效） |
| 文档树节点 | 创建、移动、删除文档 | Action 布局失效 + 客户端局部父节点失效 |
| 权限与成员 | 邀请、审批、角色变更、移除 | Server Action（布局失效） |
| 通知 | 已读操作 | `/notifications` 页级失效 + SSE 角标局部更新 |
| 偏好主题/宽度 | 设置变更 | 根布局或工作区布局失效 |
| 远端协作标题 | WebSocket stateless 消息 | 客户端 `router.refresh()`（无对应 Action） |

已删除的可证明重复刷新：拖拽与弹窗移动后的 `router.refresh()`（Action 已回传新载荷且树由局部失效负责）、Workspace 切换与创建后的刷新、权限弹窗变更后的刷新、接受 Workspace/Project 邀请及申请访问后的三处刷新、Personal 与协作编辑器标题保存成功后的两处刷新。共 10 处。

### 现有保护

- 每个写入入口的 Server Action 仍保留其 `revalidatePath` 调用，所有权未从服务端转移。
- 文档节点继续使用局部失效，不恢复全量树加载。
- Playwright 关键路径（项目/文档增删改名、拖拽与弹窗移动、深链展开、Workspace 切换、成员角色变化、协作恢复）在去除重复刷新后全部通过。
- 编辑器焦点与未保存内容保护逻辑未被触碰。

### 后续边界

- 只有把某查询迁入 Next 数据缓存后才可引入对应 `revalidateTag`；不得给动态渲染查询添加无效 tag。
- 进一步按数据域拆分布局失效需要新的缓存结构支撑，属于后续独立决策，不在当前动态渲染模型下强行实施。

## ER-06：Better Auth 核心配置存在双重实例

状态：已解决（WP-08 已完成）

### 当前实现

`src/libs/AuthCore.ts` 提供无副作用的 `getAuthenticationCoreOptions()`：base URL、secret 和认证表 Drizzle adapter（account/session/user/verification）只在此定义一次，且不引入邮件、Workspace 初始化或邀请同步依赖。

`src/libs/Auth.ts` 在共享核心之上组合 `appName`、`databaseHooks`、邮箱密码、邮箱验证、rate limit 与 trusted origins；`DocumentCollaborationAuthentication.ts` 仅展开共享核心创建最小实例，并继续用 `getSession({ disableCookieCache: true })` 读取连接身份。

### 现有保护

- 共享核心模块不导入 Resend 邮件、`EnsureUserWorkspace` 或邀请同步，协作 bundle 的无副作用边界保持。
- 协作连接仍强制 `disableCookieCache: true`；未验证邮箱在 `getDocumentCollaborationIdentity` 返回 null。
- 契约集成测试（`tests/auth-session-contract.integ.ts`）对同一有效、过期、撤销和未验证邮箱 Session 断言主端 `auth.api.getSession` 与协作端身份解析结果一致；配置漂移会使该测试失败。

### 后续边界

- 影响会话解码的核心选项变化必须落在共享核心内，不得回写单一实例。
- 协作进程继续保持不发邮件、不建 Workspace、不同步邀请的最小职责。

## ER-07：CI 依赖缓存方式不够确定

状态：已解决（WP-09 已完成）

### 当前实现

`.github/actions/setup-project/action.yml` 只保留 `actions/setup-node` 的 npm 下载缓存，并在每个 job 中无条件执行 `npm ci` 从锁文件重建依赖树。整个 `node_modules` 不再作为缓存单元，也不存在缓存命中即跳过安装的分支。

Next.js 构建缓存（`.next/cache` 与跨 job 的 `.next` 制品恢复）保持独立管理，不与依赖安装混合。

### 现有保护

- 安装结果始终由 `package-lock.json` 决定；npm 下载缓存只加速获取，不影响依赖树内容。
- 本地已验证 `npm ci` 后工作树无 lockfile 变化，lint、类型与全部测试通过。
- CI 观察点：冷缓存与热缓存运行都必须出现安装步骤；命中 npm 下载缓存后日志仍应显示 `npm ci` 执行。

### 后续边界

- 不得为加速而重新缓存安装产物或跳过安装步骤。
- 依赖兼容性问题只能通过更新锁文件解决，不能通过复用旧 `node_modules` 掩盖。

## ER-08：覆盖率没有门槛，高复杂度 UI 缺少行为保护

状态：已解决（WP-10 已完成）

### 当前实现

CI unit job 以覆盖率运行测试并把 `coverage/` 报告（HTML 与 JSON summary）作为 artifact 上传，门槛变化可审阅。

`vitest.config.ts` 只对纯领域模块设置按文件阈值（权限策略、排序规划、搜索查询与纯文本提取、成员 workflow、导航状态 reducer、移动与导航查询、最近文档查询），全部等于或低于其可重复基线；不设全局百分比，避免被无关 UI 代码拉低或产生虚假信号。引入 `revalidateTag` 式缓存或新领域模块时应同步补充对应阈值。

关键 UI 行为由 Playwright 覆盖：侧栏分页失败重试、深链路径展开、拖拽与弹窗移动后的局部树一致性、命令面板键盘选择与迟到搜索响应保护、成员角色降级的真实浏览器路径（真实 PostgreSQL job）、协作只读与恢复。

### 现有保护

- 阈值在本地与 CI 同一份配置下执行；任何被钉住模块的覆盖下降都会使 CI 失败。
- 新增 UI 用例验证用户可见结果（错误态到成功态的链接渲染、面板跳转 URL、迟到响应后仍显示最新结果），不断言实现细节。

### 后续边界

- 提高阈值必须伴随增强测试的可重复基线数据，不为数字而写重复测试。
- 全局覆盖率门槛留待领域模块稳定后再评估。

## ER-09：部署实现集中在大型 YAML 且制品逻辑重复

状态：已解决（WP-11、WP-12 已完成）

### 当前实现

CI deploy job 和 Release workflow 共同调用版本化入口 `scripts/package-production-artifact.sh` 打包生产制品：脚本以显式参数接收仓库根、standalone、静态目录、输出和 revision，完成 esbuild bundle、静态文件与迁移复制、`REVISION` 写入、整个制品树的 `.env*` 递归删除与复查，并输出同一 tgz 结构；两个 workflow 不再各自维护打包步骤。

远程激活与回滚实现在随制品交付的 `deploy/scripts/activate-release.sh` 与 `rollback-release.sh`。workflow 通过 SSH stdin 执行同一 Git SHA 的脚本，只传递 release ID、服务器路径、服务名和协作开关等受控位置参数；host、端口、用户、Node 路径、release 路径和服务名使用 GitHub Environment variable（`PRODUCTION_*`）覆盖加稳定默认值的分层，host fingerprint 保持固定 pin。

### 现有保护

- CI `packaging` job 运行打包冒烟测试（缺少必需文件、revision 不匹配、未知参数、顶层与嵌套 `.env*` 排除、归档清单一致性）和部署脚本激活/回滚场景，deploy 依赖该 job。
- 激活脚本校验 release ID、绝对路径、派生路径与回滚目标位于 release 根目录内；旧 release 在数据库迁移前完成验证，没有回滚目标时迁移不会执行。迁移先于切换、协作先于应用、健康检查失败自动回滚的顺序不变。
- 制品不包含 `.env` 或 Secret；公开 HTTPS/WSS 验证保留在 GitHub runner；SSH host fingerprint 校验保持严格且不可通过 Variable 替换。
- 部署并发组仍不取消进行中的生产发布；数据库 Schema 仍不随应用回滚。

### 后续边界

- 部署脚本语义变化必须同步冒烟测试和 `operations/deployment.md`。
- 不引入容器化部署，不改变 systemd/Nginx/sudoers 拓扑；生产操作只经 workflow 执行。
- 更换服务器或 Node.js 时优先更新 GitHub Environment variable 并同步手册，而不是改写脚本默认值。

## 跨问题约束

任何修复都必须保持以下当前不变量：

- 当前代码、Schema、迁移、配置和测试是实现事实来源；本文只描述审查基线。
- Personal 正文继续由版本化 ProseMirror JSON 和乐观锁保存。
- Team 正文继续由 Yjs 状态权威持久化；不得恢复 JSON 正文写入回退。
- Project 直接成员关系继续控制正文读取；Workspace 成员身份只提供结构发现和 Workspace 能力。
- 成员、所有权、通知和审计的业务变化必须位于同一事务边界。
- 文档移动的权限、防环、项目边界和最终顺序由服务端决定。
- 生产迁移必须向后兼容旧应用回滚。

## 相关代码和文档

- `src/components/layout/AppSidebar/SidebarWorkspaceNavigation.tsx`
- `src/features/permissions/server/WorkspaceMembers.ts`
- `src/features/permissions/server/ProjectMembers.ts`
- `src/features/search/server/SearchWorkspaceContent.ts`
- `src/features/documents/server/GetDocumentNavigation.ts`
- `src/features/documents/server/MoveDocument.ts`
- `src/libs/Auth.ts`
- `src/features/documents/collaboration/DocumentCollaborationAuthentication.ts`
- `.github/actions/setup-project/action.yml`
- `.github/workflows/CI.yml`
- `.github/workflows/Release.yml`
- `vitest.config.ts`
- [`features/documents.md`](features/documents.md)
- [`features/projects.md`](features/projects.md)
- [`features/search.md`](features/search.md)
- [`architecture/rendering-and-data-flow.md`](architecture/rendering-and-data-flow.md)
- [`operations/deployment.md`](operations/deployment.md)
- [`PROBLEMS.md`](PROBLEMS.md)
