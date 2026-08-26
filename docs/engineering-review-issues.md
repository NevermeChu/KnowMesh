# 工程审查问题说明

状态：Review baseline

基线：`feature/permissions` 分支，提交 `f0826fb5b9729e490dd3ba19b32c054c2747341e`

本文只描述当前实现中已经确认或部分确认的可维护性、性能和工程化问题，包括证据、触发条件、影响、现有保护与目标状态。本文不承诺任何修复已经实施；实施顺序、文件批次、验证命令和完成条件见 [`engineering-review-implementation-plan.md`](engineering-review-implementation-plan.md)。

## 结论摘要

当前实现没有因为以下问题而失去基本正确性：权限写入仍在事务内复核，文档树写入具有项目锁和循环检查，搜索正文仍受 Project 直接成员关系约束，Team 正文仍以 Yjs 状态为权威。问题主要表现为变化原因集中、查询成本随数据规模上升、缓存失效过宽，以及工程反馈不能阻止质量缓慢退化。

| 编号 | 问题 | 状态 | 主要风险 | 优先级 |
| --- | --- | --- | --- | --- |
| ER-01 | 侧栏导航承担过多职责 | 已解决 | 已拆分状态、拖拽、渲染和弹窗边界 | 中 |
| ER-02 | Workspace 与 Project 成员流程重复 | 已解决 | 共享稳定步骤，保留资源不变量边界 | 中 |
| ER-03 | 搜索分页缺少唯一稳定排序且搬运完整正文投影 | 已解决 | 排序以 documentId 收尾，摘要由数据库截取有限窗口 | 中 |
| ER-04 | 文档树读取和重排产生深度或节点数相关往返 | 部分解决 | 路径与子树读取已收敛为递归 CTE，排序批量重排待 WP-06 | 中 |
| ER-05 | 工作区布局缓存失效范围过大 | 已确认 | 不必要的服务端读取、序列化和客户端刷新 | 中低 |
| ER-06 | Better Auth 核心配置存在双重实例 | 已确认 | Session 配置未来漂移 | 中低 |
| ER-07 | CI 缓存整个 `node_modules` 并跳过 `npm ci` | 已确认 | 依赖安装不可重复、缓存损坏难诊断 | 中 |
| ER-08 | 覆盖率没有门槛，高复杂度 UI 缺少行为保护 | 部分确认 | 回归不能在 CI 中稳定暴露 | 中低 |
| ER-09 | 部署实现集中在大型 YAML 且制品逻辑重复 | 已确认 | 难测试、环境耦合、Release 与 CI 漂移 | 中 |

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

状态：部分解决（WP-05 已完成；排序批量重排由 WP-06 处理）

### 当前实现

`getDocumentNavigationPath` 使用单条有界递归 CTE 一次读取根到目标路径：起点同时匹配 `documentId` 与 `projectId`，递归阶段保持项目边界并以访问路径数组拒绝循环；应用层在结果上执行与旧实现相同的深度上限、循环拒绝和跨项目返回 null 判定。数据库往返数不再随路径深度增加。

`moveDocument` 的跨项目后代集合同样由单条递归 CTE 读取，所有节点必须保持在源项目中；超过 10,000 个后代时整个事务拒绝，不截断后继续写入。目标同级集合仍在计算顺序前加锁。

排序间隙不足时 `planDocumentSortOrder` 返回的全部兄弟更新仍逐条执行 `UPDATE`，该往返问题留给 WP-06。

### 现有保护

- 深链最大 100 层，循环或超过深度的链路在事务外被明确拒绝。
- 移动子树最大 10,000 个后代，超限时事务不产生部分更新。
- 移动在事务内重新验证源和目标项目权限；目标同级集合加锁不变。
- PGlite 集成测试覆盖多层路径、跨项目 null、循环拒绝、深度边界、跨项目移动完整更新和超限无部分更新。
- 同一 CTE 与锁路径已在真实 PostgreSQL 17 容器中验证（祖先顺序、边界判定、源项目约束、超限计数和 `FOR UPDATE` 并发阻塞）。

### 后续边界

- 兄弟排序重排改为单次或有界批量写入时保持 `planDocumentSortOrder` 的纯计算职责（WP-06）。
- 递归 SQL 继续通过 Drizzle 参数绑定表达，不拼接用户输入。

## ER-05：工作区布局缓存失效范围过大

### 当前实现

文档、项目、Workspace、偏好和成员等多个写入入口统一调用 `revalidatePath('/(workspace)', 'layout')`。部分客户端在 Server Action 完成后还会执行局部状态修正和 `router.refresh()`。

共享布局已经只加载 Workspace 与 Project 导航基础数据，文档节点按需加载，因此全布局失效的成本低于旧的全量文档树实现；但不同数据域仍被视为同一个失效单元。

### 风险

- 标题、偏好或单节点操作会使与其无关的工作区数据重新读取。
- “Server Action 自动刷新、显式 `revalidatePath`、客户端 `router.refresh`、本地 optimistic 更新”之间的职责不清晰。
- 未来增加更多布局查询后，当前全量失效成本会无声增长。

### 目标状态

先建立失效清单，再按实际数据所有者收窄：

| 数据域 | 典型变化 | 期望刷新边界 |
| --- | --- | --- |
| Workspace 列表与活动 Workspace | 创建、删除、切换 Workspace | Workspace 上下文和切换器 |
| Project 导航 | 创建、删除、重命名、成员可见性变化 | 对应 Workspace 的项目列表 |
| 文档节点 | 创建、移动、删除、标题变化 | 受影响的项目或父节点 |
| 权限概览 | 成员、邀请、申请、角色变化 | 当前打开的权限面板及相关导航权限 |
| 偏好 | 主题、内容宽度 | 偏好拥有者和必要布局镜像 |
| 通知 | 新通知、已读 | 通知列表与未读计数 |

第一阶段只删除可以证明重复的刷新，不为了“细粒度”立即引入复杂 tag 体系。需要使用 Next.js cache tag 时，应先确认相关查询确实被缓存以及 tag 的所有者。

## ER-06：Better Auth 核心配置存在双重实例

### 当前实现

`src/libs/Auth.ts` 创建主 Better Auth 实例，包含数据库适配、邮件密码、邮箱验证、rate limit、trusted origins 和用户生命周期 hook。

`DocumentCollaborationAuthentication.ts` 为独立 Hocuspocus 进程创建最小 Better Auth 实例，只配置 base URL、数据库适配和 secret，并使用 `getSession({ disableCookieCache: true })` 读取连接身份。

独立最小实例避免协作进程加载认证邮件和用户初始化副作用，这一隔离意图合理；问题在于数据库 Schema、base URL、secret 和未来可能影响 Session 解码的选项被手写两次。

### 风险

- 调整 cookie、Session 或核心插件时只修改主实例，协作服务仍按旧配置读取身份。
- 为消除重复而直接导入完整 `auth`，又可能把邮件组件、Resend 和生命周期 hook 带入协作服务 bundle。

### 目标状态

- 抽取不带副作用的 `getAuthCoreOptions()` 或等价配置构造器。
- 共享数据库 adapter Schema、base URL、secret 以及确实影响 Session 读取的核心选项。
- 主应用在共享核心之上增加邮件、rate limit 和数据库 hook。
- 协作实例继续保持最小依赖，并继续禁用 cookie cache 重新校验 Session。

## ER-07：CI 依赖缓存方式不够确定

### 当前实现

`.github/actions/setup-project/action.yml` 同时启用 `actions/setup-node` 的 npm cache，并额外缓存整个 `node_modules`。缓存命中时跳过 `npm ci`。

### 风险

- `node_modules` 缓存可能包含中断安装留下的部分状态。
- Node、npm、系统原生依赖或安装脚本行为变化时，锁文件哈希未必表达全部兼容条件。
- CI 成功依赖缓存内容，而不是每次从 `package-lock.json` 重建依赖树。
- setup-node npm cache 与 node_modules cache 重复占用缓存容量。

### 目标状态

- 只保留 npm 下载缓存。
- 每个 job 始终执行 `npm ci`。
- Next.js 构建缓存和已构建 `.next` 制品继续按其独立用途管理，不与依赖安装混合。

## ER-08：覆盖率没有门槛，高复杂度 UI 缺少行为保护

### 已确认部分

CI 使用 `npm run test -- --coverage`，`vitest.config.ts` 只设置 `coverage.include`，没有 threshold，也没有上传覆盖率报告。因此覆盖率下降不会使 CI 失败，也缺少可审阅的趋势产物。

以下关键服务端不变量已有单元、集成或 E2E 保护：权限决策、所有权、文档树、搜索权限、通知、协作持久化、撤权和浏览器恢复。

### 部分确认部分

复杂 UI 的直接行为覆盖较少，尤其是：

- 侧栏分页错误重试、加载更多与请求去重组合；
- 文档拖拽后的局部树失效；
- Command Palette 键盘选择、迟到搜索响应和最近文档；
- Workspace/Project 成员管理的主要对话框路径。

“缺少独立测试文件”不自动等于完全没有间接覆盖，因此本项标记为部分确认。实施前应生成覆盖率报告并把缺口映射到真实用户路径。

### 目标状态

- 不追求全仓统一的高覆盖率数字。
- 对权限、事务、协作恢复、导航状态 reducer 和搜索查询设置可解释的门槛。
- 为高复杂度 UI 保留少量关键 Playwright 路径，不复制组件实现细节。
- CI 保留可下载的覆盖率摘要或报告，使门槛变化可以审查。

## ER-09：部署实现集中在大型 YAML 且制品逻辑重复

### 当前实现

`.github/workflows/CI.yml` 同时实现静态检查、测试、构建、制品打包、SSH 主机校验、上传、生产迁移、软链接切换、systemd 重启、内部健康检查、公开 HTTPS/WSS 验证和失败回滚。

`.github/workflows/Release.yml` 又维护一套相似的 standalone 制品打包步骤。生产 host、用户、Node 可执行文件、release 路径和服务名由 CI workflow 直接声明。

### 风险

- Shell 逻辑只能在 Actions 或近似 Linux 环境中整体调试。
- CI 部署与手动 Release 的制品内容检查可能分叉。
- Node 安装位置或服务器路径变化需要修改工作流实现。
- YAML 同时承担流程编排和部署程序职责，审查差异时难以识别真正的行为变化。

### 现有保护

- SSH host fingerprint 被严格验证。
- 制品包含 Git revision，并检查必要文件。
- 迁移在切换前执行，失败不会切换应用。
- 新应用和协作服务健康检查失败时会恢复旧软链接。
- 文档明确要求生产迁移保持向后兼容，数据库 Schema 不随应用回滚。

### 目标状态

- 建立一个可在 Linux runner 上独立执行和测试的制品打包脚本。
- CI 和 Release workflow 调用同一个打包入口。
- 将远程激活、健康检查和回滚脚本版本化，workflow 只负责传递受控参数和 Secret。
- 稳定环境值使用 GitHub Environment variables 或服务器配置；Secret 继续只放 Secret 管理。
- 不在本工作中擅自引入容器、改变 systemd/Nginx 拓扑或执行生产操作。

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
