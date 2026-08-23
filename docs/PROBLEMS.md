# 开发问题记录

本文记录开发中值得保留的重要问题、根因和解决方法。

## 1. 创建项目或文档后侧边栏未更新

### 问题

项目或文档已成功写入数据库，但侧边栏仍显示创建前的项目和文档列表，需要手动刷新后才能看到新数据。

### 根因

侧边栏数据由共享的 `(workspace)` 布局读取，创建 Server Action 成功后却没有使该布局数据失效。客户端只调用 `router.refresh()`，而文档流程还在 `router.push()` 后紧接刷新，刷新可能仍作用于旧路由。

### 解决方法

- `createProject` 和 `createDocument` 在写入成功后调用 `revalidatePath('/(workspace)', 'layout')`，让共享布局重新执行 `getWorkspaceNavigation`。
- 文档创建返回新 ID 后，客户端只负责导航到新文档，不再紧接调用 `router.refresh()`。
- 单元测试覆盖成功写入后的布局失效，以及无效输入、无权限和写入失败时不得失效布局。

## 2. 模态弹窗重复实现且关闭规则分散

### 问题

创建项目、创建文件、权限总览和链接编辑分别实现 Portal、遮罩、层级、弹窗表面与 Escape 处理，视觉和关闭行为容易逐步不一致。

### 根因

项目只有用于非模态菜单的 `PopupMenu`，缺少独立的通用模态组件；各业务组件因此自行组合相同基础结构，并把请求中的禁用规则直接散落在事件处理器中。

### 解决方法

- 新增独立的 `ModalDialog` 及共享标题、正文、页脚和按钮组件，统一 Portal、遮罩、层级、可滚动居中布局和与 `PopupMenu` 一致的表面风格。
- 按钮通过语义变体统一颜色：普通否定操作无填充、普通肯定操作使用黑色、辅助推进操作使用蓝色、危险操作使用红色。
- 将关闭策略改为显式可选配置；未配置时不提供遮罩或 Escape 隐式关闭，配置后仍可按业务状态临时禁用。
- 现有四类模态弹窗改为复用该组件，`PopupMenu` 和 `ContextMenu` 继续承担非模态菜单职责。

## 3. 同步浏览器输入框阻塞编辑器和界面验证

### 问题

文档链接命令使用 `window.prompt` 收集地址时会暂停页面 JavaScript；提示框未处理前，编辑器交互、页面刷新和浏览器自动化检查都无法继续，并且视觉与项目界面不一致。

### 根因

链接编辑最初直接依赖浏览器提供的同步输入接口，没有纳入 React 状态和项目弹窗体系。

### 解决方法

- 使用受控的 `DocumentLinkDialog` 收集链接地址，明确提供保存、取消和移除链接操作。
- 由 `DocumentEditorToolbarProvider` 管理链接弹窗状态，并在提交前确认编辑器实例仍然有效。
- 链接编辑复用 `ModalDialog`，避免同步阻塞，同时保持项目统一的关闭规则和视觉样式。

## 4. 共享工具栏可能短暂持有已销毁的编辑器实例

### 问题

文档切换或编辑器卸载期间，共享工具栏仍可能读取激活状态、判断撤销能力或执行格式命令；如果引用对应的 Tiptap Editor 已被销毁，这些操作可能访问失效实例。

### 根因

编辑器正文和共享 `ContentToolbar` 的生命周期不同，编辑器销毁与 React 上下文状态更新之间存在短暂窗口；只判断实例是否为 `null` 不能覆盖这一状态。

### 解决方法

- 编辑器创建时注册实例，销毁时按实例身份注销，避免旧编辑器清除后来注册的新实例。
- 所有激活状态、撤销/重做能力和链接写入入口同时检查实例存在且 `isDestroyed` 为 `false`。
- 将命令分组提取为可测试的纯逻辑，覆盖主工具栏最多八项及溢出命令分组规则。

## 5. 项目分类无法表达多个稳定工作区

### 问题

个人区域和协作区域仅由 `projects.kind` 分组，侧边栏中的“工作区”没有 ID、名称、成员或所有者，无法支持左上角切换多个 Team，也无法让多个项目共享稳定的工作区归属。

### 根因

初始产品只需要区分个人项目与协作项目，因此直接把分类放在项目上；随着工作区级导航和成员管理需求出现，项目分类被同时用于界面分区和权限聚合，已经承担了超出分类字段的职责。

### 解决方法

- 第一阶段新增 `workspaces`、`workspace_members` 和 `projects.workspace_id`，左上角切换真实 Workspace；`projects.kind` 暂时继续表示 Workspace 内的 Private/Shared 项目区域。
- 第一阶段的 Workspace 成员关系只控制可见和可切换范围，项目与文件仍由现有 `project_members` 授权，避免把未完成的权限继承描述为已实现。
- 后续通过统一能力授权完成 Workspace 到 Collaboration 项目的角色继承；邀请、退出、角色管理和所有权转让继续保持为独立后续范围。

## 6. 成员角色存在但资源权限没有统一执行

### 问题

Schema 已定义 `owner`、`editor`、`viewer`，但不同读取和写入入口各自查询成员或比较角色。创建项目只检查是否为 Workspace 成员，导致 viewer 也能创建项目；Workspace、项目和文件的修改与删除也没有一致的能力边界。

### 根因

Workspace 资源归属与权限继承分阶段上线后，第二阶段缺少统一的授权模型。角色既被用于所有权展示，又被直接当作操作权限，无法表达 Workspace owner 继承协作项目管理能力但不是 Project owner。

### 解决方法

- 新增 `src/features/permissions/`，把角色映射为 Workspace、项目和文件能力，并集中查询授权来源。
- Personal 项目只使用直接项目权限，Collaboration 项目合并 Workspace 继承权限；文件完全继承项目能力。
- 所有资源读取、创建、更新和删除在服务端重新计算能力，客户端能力只控制界面呈现。
- 为角色矩阵、继承边界、资源写入和跨 Workspace 查询补充单元测试。

## 7. 默认工作区初始化与可删除语义冲突

### 问题

新用户需要自动获得默认 Workspace，但允许用户删除最后一个 Workspace；如果每次查询发现为空就创建，会让用户删除的 Workspace 立即复活。

### 根因

“从未初始化”和“主动删除后为空”都表现为没有成员关系，仅查询 Workspace 数量无法区分两种状态。

### 解决方法

- 使用 `user_onboarding` 持久化一次性初始化标记，并在同一事务中创建默认 Workspace 与 owner 成员。
- 初始化标记发生冲突时不再创建默认 Workspace，即使用户当前没有任何 Workspace。
- 删除 Workspace 只级联业务资源，不删除初始化标记，从而允许稳定的零 Workspace 状态。

## 8. 应用邀请与工作区邀请存在双重状态

### 问题

使用 Clerk Application Invitations 发送 Workspace 邀请时，Clerk 管理的是加入整个应用，本地数据库管理的是加入具体 Workspace；两套邀请在撤销、过期和接受状态上可能不一致。

### 根因

身份提供方的应用级邀请语义与 KnowMesh 的 Workspace 资源边界不同，邮件投递和成员授权被错误地绑定到同一个外部邀请对象。

### 解决方法

- Clerk 仅负责注册、登录和已验证邮箱身份，Workspace 邀请状态完全由 `workspace_invitations` 管理。
- Resend 只发送包含本地一次性令牌的事务邮件，不参与授权判断。
- 邮件发送失败时删除刚创建的本地邀请，避免显示无法使用的待接受邀请。

## 9. 移除工作区成员可能破坏项目所有权不变量

### 问题

移除 Workspace 成员时会清理该用户在 Workspace 内的项目直接成员关系，但项目所有权仍由 `projects.owner_id` 独立保存。即使先查询该成员是否拥有项目，如果检查发生在事务外，或项目创建没有与成员移除竞争同一条锁，并发请求仍可能在检查后创建项目，再由移除流程删除 Workspace 成员，产生所有者不再属于上级 Workspace 的孤立项目。

### 根因

所有权和成员身份分别存储在资源表、项目成员表与 Workspace 成员表中。原流程把项目所有权检查放在事务外，项目创建只在进入事务前授权，没有在写入前锁定并重新校验 Workspace 成员关系；默认隔离级别下，两条流程之间不存在串行化边界。同时系统尚未提供项目所有权转让能力。

### 解决方法

- 成员移除事务先使用 `FOR UPDATE` 锁定目标 `workspace_members` 行，再检查其拥有的所有项目，最后清理项目直接成员关系与 Workspace 成员关系；目标成员不存在时明确失败。
- 项目创建事务锁定同一条 Workspace 成员关系，并在写入项目之前重新校验当前角色仍具有 `project.create`，使并发创建与移除按锁顺序执行。
- 为 `projects(workspace_id, owner_id)` 增加指向 `workspace_members(workspace_id, user_id)` 的复合外键，数据库最终拒绝任何项目 owner 不属于所属 Workspace 的写入或成员删除。
- 补充成员移除锁顺序、拥有项目拒绝、成员不存在，以及并发移除后项目创建拒绝的回归测试；所有权转让仍作为独立后续能力实现。

## 10. 项目类型与工作区归属重复表达权限模式

### 问题

项目同时保存 `workspace_id` 和 `kind`，导致个人或协作语义存在两个事实来源。个人项目仍属于当前团队 Workspace，会随团队 Workspace 删除；业务代码还必须防止 Personal Workspace 与 Collaboration Project 等非法组合。

### 根因

`projects.kind` 是引入真实 Workspace 时保留的过渡分类。个人空间后来被确定为用户跨团队 Workspace 永久拥有的资源边界后，分类职责已经上移到 Workspace，但旧字段、`user_onboarding` 标记和对应查询分支仍然保留。

### 解决方法

- 使用 `workspaces.kind = personal | team` 作为唯一权限模式来源，删除 `projects.kind`、`project_kind` 枚举和按项目类型建立的索引。
- 每个 owner 通过部分唯一索引只拥有一个 Personal Workspace；Personal Workspace 本身替代 `user_onboarding` 初始化标记。
- 将旧 Personal 项目迁移到 owner 的 Personal Workspace，并由查询和授权连接 Workspace 推导项目模式。
- 代码审计只保留 Personal/Collaboration 作为界面区域标识，不再把它持久化为 Project 业务状态。

## 11. 侧边栏导航重复查询权限并维护脆弱测试

### 问题

侧边栏分别读取项目和文档导航，两条查询都认证当前用户、连接 Workspace 与两级成员关系，并计算同一项目权限；共享 Layout 和具体页面还会在同一渲染请求中重复解析 Workspace 上下文。查询返回值同时携带界面未使用的时间戳、Workspace ID、成员角色和可由能力数组推导的管理布尔值。对应单元测试各自模拟完整 Drizzle 链，结构重复且会因无行为变化的查询重排而失败。

### 根因

项目列表与文档导航按功能文件逐步增加时，各自形成了完整的授权查询，没有把“文档导航只能来自已授权项目”作为共享查询边界。数据库行模型也被直接用作客户端导航模型，导致存储字段自然泄漏到传输类型；测试因此验证 ORM 调用形状，而不是最小的授权与返回行为。

### 解决方法

- 使用 `getWorkspaceNavigation` 一次认证并计算可访问项目，再按这些项目 ID 读取文档导航，删除两条重复查询。
- 使用 React 请求级缓存复用同一次 Server Component 渲染中的 Workspace 上下文，不跨请求缓存身份或权限。
- 收窄 Workspace、Project、Document 导航返回类型和 Server Action 返回值，只保留客户端消费字段；成员管理能力直接从权限数组推导。
- 将两套 ORM 链式模拟测试合并为 Workspace 导航边界测试，覆盖可访问项目与文档返回，以及没有可访问项目时跳过文档查询。
- 删除被部分唯一索引或联合主键覆盖且没有当前查询消费者的索引；所有权权威字段、owner 成员关系和邀请审计状态继续保留。

## 12. 项目权限总览错误操作工作区继承成员

### 问题

Team 项目权限总览同时展示项目直接权限与 Workspace 继承权限，但两组成员都显示项目角色修改和移除按钮。修改继承成员会意外创建项目直接成员关系；移除仅有继承权限的成员不会撤销其 Workspace 访问，界面结果与实际权限不一致。

### 根因

权限分组只有展示名称和成员，没有稳定的授权来源字段；客户端成员操作只检查当前用户是否具有 `project.members.manage`，无法判断目标成员来自项目直接授权还是 Workspace 继承授权。添加项目成员时也依赖 `groups[0]` 是直接权限组的隐式顺序。

### 解决方法

- 为权限分组增加 `source = project | workspace`，由服务端查询明确标记每组授权来源。
- 项目成员角色修改和移除只对 `source = project` 的直接权限组显示；Workspace 继承成员必须在 Workspace 权限页管理。
- 添加项目成员时按 `source` 定位直接权限组，不再依赖数组顺序。
- 使用纯权限边界测试覆盖项目直接组、Workspace 继承组、Workspace 页面和 Document 页面，并验证服务端权限总览返回正确来源。

## 13. 工作区继承权限无法隔离项目正文

### 问题

Team Workspace 成员原本会自动继承其中所有项目和文档能力，导致 Workspace editor 可以编辑全部项目，Workspace owner 可以读取和管理未加入的项目；`project_members` 无法作为正文访问门槛。

### 根因

权限策略把 Workspace 角色与 Project 直接角色取并集，并使用同一个 `project.read` 同时表达导航发现和项目内容访问。导航查询又只读取具有 `document.read` 的项目文件，无法实现“结构可发现、正文受保护”。

### 解决方法

- 新增 `project.structure.read` 区分导航结构发现和内容读取；Team Workspace 成员只从 Workspace 关系获得结构发现能力。
- Project 与 Document 内容能力只由 `project_members.role` 授予，Workspace owner 不再绕过项目成员门槛。
- 导航查询返回项目和文件名称；正文查询在读取 `documents.content` 前检查 `document.read`，非项目成员只收到标题与申请状态。
- Workspace 与 Project 邀请接受后固定为 viewer，并增加 Project 邀请、查看/编辑申请、Workspace 编辑申请和管理员批准状态。
- 使用 ADR 0006 替代旧的 Team Project 权限继承决策；当前尚无文件夹模型，未来文件夹名称和从属关系遵循同一导航元数据边界。

## 14. Project 成员关系无法在数据库中证明属于同一 Workspace

### 问题

`project_members` 原本只有 `project_id` 和 `user_id`。应用会在邀请、接受和审批时检查用户属于上级 Workspace，但直接数据库写入或遗漏检查的新入口仍能建立跨 Workspace 的 Project 成员关系。

### 根因

成员表没有保存可参与复合外键的 `workspace_id`，数据库只能证明 Project 存在，不能同时证明用户是该 Project 所属 Workspace 的成员。

### 解决方法

- 为 `project_members` 增加 `workspace_id`，迁移先从 `projects` 回填并预检既有数据。
- 使用 `(project_id, workspace_id)` 外键保证成员关系指向 Project 的真实 Workspace，再使用 `(workspace_id, user_id)` 外键保证用户是该 Workspace 成员。
- 增加数据库触发器从 Project 自动填充 `workspace_id`，兼容迁移期间旧应用仍按旧列集合写入；新应用同时显式写入该字段。

## 15. Owner 权威字段与 owner 成员角色可能失配

### 问题

资源表保存 `owner_id`，成员表同时保存 `role = owner`。普通外键只能证明 owner 是成员，无法阻止 owner 成员被降级、删除、出现第二个 owner，或让 `owner_id` 与 owner 角色指向不同用户。

### 根因

“资源必须恰好有一个 owner 成员，且该成员必须等于资源的 `owner_id`”是跨表、双向且需要事务内暂时失配的不变量，普通外键和 `CHECK` 约束无法完整表达。

### 解决方法

- 为 Workspace 和 Project 成员分别增加只覆盖 `role = owner` 的部分唯一索引，限制每个资源最多一个 owner 成员。
- 增加 `DEFERRABLE INITIALLY DEFERRED` 约束触发器，在事务提交时验证资源 `owner_id` 对应的 owner 成员存在且角色正确。
- 迁移在启用约束前预检既有 owner 数据；创建和未来所有权转让必须在同一事务完成资源与成员的最终一致状态。

## 16. Personal Workspace 的创建时机依赖首次工作台访问

### 问题

产品要求用户完成 Clerk 注册后立即拥有 Personal Workspace，但原实现只在 `getWorkspaceContext` 首次运行时创建。未进入工作台的用户不会初始化，读取查询也承担了持久化副作用。

### 根因

初始化流程绑定在工作台布局，而没有接入 Clerk 用户生命周期事件。

### 解决方法

- 新增签名验证的 Clerk Webhook Route Handler，订阅 `user.created` 后调用幂等的 `ensureUserWorkspace`。
- Webhook 创建失败返回 `5xx` 让 Clerk 重试，签名错误返回 `400`；`getWorkspaceContext` 恢复为纯读取。
- 在环境校验、部署文档和 Clerk Dashboard 中配置 `CLERK_WEBHOOK_SIGNING_SECRET` 与 `user.created` endpoint，并明确 Webhook 是异步投递而非注册重定向的同步前置步骤。

## 17. 资源移除语义分散且账户删除后保留悬空用户标识

### 问题

普通 Workspace 和 Project 操作只表达 owner 删除，非 owner 成员没有统一的主动退出流程；不同入口若各自清理成员、申请和邀请，还容易遗留下级资源或破坏 owner 不变量。Clerk `UserProfile` 又可以直接终止账户，但原 Webhook 只处理 `user.created`；用户身份删除后，Workspace、Project、成员、申请、邀请和 Document 创建者仍保存已经不存在的 Clerk user ID。

### 根因

原 Workspace/Project 动作绑定 owner 的删除能力，没有抽取可供用户主动操作和 Webhook 复用的资源移除规则。KnowMesh 还没有本地用户外键或 `user.deleted` 生命周期处理，同时尚未实现 Workspace 和 Project 所有权转让，因此不能仅删除成员行而继续满足 owner 不变量。

### 解决方法

- Webhook 订阅并处理 `user.deleted`，通过幂等事务复用 owner 删除、member 退出的统一资源清理规则。
- 普通 Workspace/Project 操作使用相同规则：owner 删除完整资源，member 只退出；退出 Workspace 前先删除自己拥有的下级 Project 并退出其他直接参与的 Project。
- 对其他人拥有的资源只清理该用户的成员、申请和邀请关系；保留共享 Document 并匿名化创建者标识。
- 将该行为记录为所有权转让实现前的过渡策略；未来改变资源继承规则时以新 ADR 替代。

## 18. 邀请登录丢失原始接受地址

### 问题

未登录用户从 Workspace 邀请邮件打开接受链接后会进入 Clerk 登录页，但登录完成后没有返回包含 token 的邀请页，因此无法继续校验和接受邀请。

### 根因

路由代理为 `auth.protect` 配置了固定的 `/sign-in` `unauthenticatedUrl`，最初没有把当前受保护 URL 写入 Clerk 识别的 `redirect_url`。仅增加查询参数仍不足以稳定回跳，因为 Clerk 环境的默认或强制跳转配置可以让认证流程最终进入 Dashboard；已建立会话后再落到登录页时，原页面也没有服务端回跳逻辑。

### 解决方法

- 代理将完整的站内受保护路径作为 `redirect_url` 附加到登录地址，保留邀请 token 和其他查询参数。
- 认证页拒绝绝对 URL、协议相对 URL 和反斜杠路径，再把校验后的站内路径作为当次 `SignIn`/`SignUp` 的 force target；`/dashboard` 仅作为缺少安全目标时的 fallback。
- 已认证用户落到登录或注册页时，Server Component 直接跳回校验后的目标，避免已有会话仍停留在认证 UI。
- 登录后返回邀请页并由用户明确点击接受；不在认证回跳时自动写入成员关系。
- 使用轻量 URL 单元测试验证原始路径和邀请 token 保留在 `redirect_url` 中。

## 19. 权限状态变化缺少可追溯通知

### 问题

邀请被接受、权限申请提交或审批通过后，相关用户只有在重新打开权限界面时才能发现状态变化；侧边栏没有未读提示，也没有统一的历史入口。

### 根因

权限流程只维护当前邀请、申请和成员状态。邀请接受和审批还会删除待处理记录，因此无法从现有表可靠地反推出已经发生的事件。

### 解决方法

- 新增用户级 `notifications` 历史表，保存事件类型、展示快照、可选资源上下文和显式已读时间。
- Workspace Layout 按当前用户读取未读数量，在设置上方显示通知角标；`/notifications` 提供最近通知以及单条和全部已读操作。
- 当前采用页面刷新时更新的最小闭环，不引入轮询、实时连接、事件总线或 outbox；出现即时性和跨服务投递需求后再扩展。

## 20. 中间件受保护路由前缀遗漏通知路径

### 问题

未登录用户直接访问 `/notifications` 路径时，中间件未将其识别为受保护路由进行拦截，未走附带 `redirect_url` 的登录回跳流程，破坏了受保护页面登录后保留目标地址的一致性体验。

### 根因

`src/proxy.ts` 中的 `protectedRoutePrefixes` 静态路由前缀数组在增加通知功能后未同步补齐 `'/notifications'`。

### 解决方法

- 在 `protectedRoutePrefixes` 中加入 `'/notifications'`，确保全部 workspace 子路由统一由代理层通过 `createSignInUrl` 拦截并传递回跳目标。
- 补充单元测试，验证未登录访问通知路径正确保留目标 URL。

## 21. 文档自动保存失败与富文本内容校验异常

### 问题

用户在编辑器中编辑文档（尤其是输入空行、高亮提示块、折叠块等）时，文档自动保存失败，保存状态显示为错误。

### 根因

1. `Callout` 与 `DetailsContent` 节点的 ProseMirror Schema 将内容约束定义为 `'block+'`，要求子节点必须包含至少一个非空 block。在创建空提示块或在提示块/折叠块中连续按退格键时，客户端 `Node.fromJSON(...).check()` 因内容为空抛出 schema 异常，导致 `isDocumentContent` 校验失败并触发保存错误。
2. 悬浮选区菜单 `DocumentBubbleMenu`、斜杠菜单 `DocumentSlashMenu` 与大纲组件 `DocumentOutline` 初始在组件渲染体内直接调用 `editor.on(...)` 注册事件并调用 `setOptions` 覆盖 `editorProps`，导致事件监听器重复叠加与配置覆盖。

### 解决方法

- 将 `Callout` 与 `DetailsContent` 的 content 约束从 `'block+'` 调整为 `'block*'`，`DetailsSummary` 调整为 `'inline*'`，允许块级容器在编辑和空状态下平滑过渡并通过 ProseMirror schema 校验。
- 重构 `DocumentBubbleMenu`、`DocumentSlashMenu` 与 `DocumentOutline`，全面改用 `@tiptap/react` 提供的 `useEditorState` 响应式提取状态与坐标，消除重复事件绑定与配置覆盖。
- 将文档总字数移至顶部元信息栏（与保存状态微徽标和收藏按钮并列展示），移除右侧大纲多余的文档信息卡片，大纲仅保留目录树。

## 22. 编辑器击键频繁序列化卡顿与服务端重复查询瀑布流

### 问题

长文档编辑时打字存在掉帧与输入延迟（INP 偏高）；同时，工作区与文档页面在服务端渲染期间执行了多次重复的 4 表 JOIN 鉴权与未读通知统计 SQL，且部分无依赖查询串行等待，增加了页面响应时间与数据库负载。

### 根因

1. `DocumentEditor` 在每一次按键触发的 `onUpdate` 中同步调用 `editor.getJSON()` 递归构建整棵 ProseMirror JSON 树并执行 `isDocumentContent` 校验，高频占用主线程。
2. `getProjectAuthorization` 与 `getUnreadNotificationCount` 缺少 React 请求级记忆化（`cache()`），导致同一次 SSR 渲染中父子组件（如 `WorkspaceLayout` 和 `DashboardPage`、`ProjectDocumentsPage` 和 `GetProjectAccessState`）重复发起相同的 SQL 查询。
3. 文档页面及项目访问状态的独立只读查询采用串行 `await` 导致异步瀑布流。

### 解决方法

- 将 `currentEditor.getJSON()` 与 `isDocumentContent` 校验延后至 700ms 防抖定时器内部及失焦时执行，按键阶段仅做纯字符数更新与计时器重置，彻底消除每次击键的深层对象序列化开销。
- 使用 `React.cache()` 包装 `getProjectAuthorization` 与 `getUnreadNotificationCount`，实现单次请求生命周期内的请求级结果复用，避免重复执行 4 表 JOIN 与计数查询。
- 在 `ProjectDocumentsPage` 与 `GetProjectAccessState` 中使用 `Promise.all` 并行化独立查询，消除瀑布流等待时间。
- 在 `next.config.ts` 中配置 `experimental.optimizePackageImports` 对 `lucide-react` 与 `@clerk/localizations` 进行精确摇树打包。

## 23. 首页切换全阻塞与外部鉴权延迟引发的卡顿

### 问题

用户在工作台侧边栏点击切换到首页（`/dashboard`）时出现明显的界面无响应与卡顿感（等待 500ms~1500ms+ 界面才发生切换）。

### 根因

1. `DashboardPage` 采用顶层全阻塞 `await Promise.all` 并行等待 5 项数据，缺少 `<Suspense>` 边界与 `loading.tsx` 路由过渡态；Next.js App Router 在没有 Suspense/Loading 边界时，客户端路由跳转必须等待服务端全部异步任务完成才渲染新页面，导致点击时界面停留在原页面处于假死状态。
2. `getPendingInvitations` 内部调用了 Clerk 的 `currentUser()`，该方法向外部 `api.clerk.com` 发送远程 HTTPS 请求获取邮箱，网络延迟直接阻塞整页渲染。
3. `getRecentDocuments`、`getPendingApprovals` 与 `getPendingInvitations` 未包装 `React.cache()`。
4. `project_members` 表只有 `(project_id, user_id)` 主键，缺少以 `user_id` 为前缀的索引，导致 `getRecentDocuments` 等关联查询需要遍历整个成员表。

### 解决方法

- 重构 `DashboardPage` 为流式架构（Streaming SSR）：标头与快捷入口卡片同步即时渲染（0ms 响应），最近文档、通知、待处理事项拆分为独立异步组件并用 `<Suspense>` 包裹，将外部 Clerk 远程调用隔离在独立流式边界内，互不阻塞。
- 新增 `src/app/(workspace)/loading.tsx` 提供工作台通用过渡骨架屏，确保路由切换在 16ms 内立即给出视觉反馈。
- 为 `getRecentDocuments`、`getPendingApprovals` 与 `getPendingInvitations` 补充 `React.cache()` 封装。
- 在 `project_members` 表中添加 `(user_id, project_id)` 索引加速用户项目成员关系关联。

## 24. 全局检索入口割裂与辅助页面全阻塞过渡延迟

### 问题

全局搜索必须跳出当前编辑工作流进入独立 `/search` 页面；同时收藏页与通知页在路由切换时存在全阻塞服务端等待，长文档阅读时右侧大纲缺乏视口滚动位置指示。

### 根因

1. 搜索功能仅以独立页面形式组织，缺少全局模态快捷指令面板体系。
2. `/starred` 与 `/notifications` 路由未采用 Suspense 流式拆分，客户端导航必须等待服务端完整数据库查询返回才渲染新页面。
3. 大纲组件只实现了单向点击跳转，未结合视口位置建立双向联动。

### 解决方法

- 新增 `CommandPalette` 组件并在 `AppShell` 全局挂载，支持 `Cmd+K` / `Ctrl+K` 随时唤起，集成 180ms 防抖文档检索、空间过滤与快捷导航/动作。
- 将 `SearchWorkspaceContent` 改为 Server Action 支持客户端即时检索。
- 将 `/starred` 与 `/notifications` 页面改造为流式 Suspense 架构，标头 0ms 瞬间响应，列表通过骨架屏平滑过渡。
- 为 `DocumentOutline` 增加基于视口坐标的 Scrollspy 滚动高亮跟踪，并在文档元信息栏增加字数与预估阅读时间。

## 25. 编辑器首屏 JS 体积庞大与代办清单及导出功能缺失

### 问题

无论用户是否打开文档，Tiptap 相关全套依赖（ProseMirror 核心及扩展）均打包进工作台首屏，导致初始包体积膨胀；同时文档缺少代办任务清单（Task Lists）交互能力，缺乏 Markdown 源码导出与文件下载功能。

### 根因

1. `DocumentWorkspace` 直接同步引入了大型客户端组件 `DocumentEditor`。
2. Tiptap 未定义 TaskList / TaskItem 节点扩展与样式。
3. 系统缺少由 ProseMirror JSON 转换为标准 Markdown 的序列化体系。

### 解决方法

- 使用 `next/dynamic` 懒加载 `DocumentEditor` 并配合 `DocumentEditorSkeleton` 消除布局抖动与首屏开销。
- 开发原生 `TaskList` 与 `TaskItem` 扩展，支持交互式复选框状态联动、删除线样式与 Slash Menu 快速插入（`/todo`、`/task`、`/任务`）。
- 构建 `DocumentMarkdown.ts` 递归转换器与 `DocumentExportMenu.tsx` 下拉菜单，提供 Markdown 文件下载、复制剪贴板以及原生打印/PDF 导出功能。

## 26. 全局操作依赖鼠标与检索相关度缺乏加权

### 问题

平台内各项操作缺乏快捷键速查指南与沉浸式全屏快捷键；全文搜索仅按更新时间降序排列，当用户搜索明确关键词时，标题完全命中的文档容易被正文中偶然出现关键词的文档淹没。

### 根因

1. 快捷指令体系未建立分类帮助指南弹窗。
2. 全局缺乏针对侧边栏与全屏专注阅读的热键响应。
3. `searchWorkspaceContent` 缺少匹配位置权重（Score）计算。

### 解决方法

- 新增 `ShortcutsHelpDialog` 支持通过 `Cmd+/` 或非编辑态按 `?` 随时唤起系统/编辑/排版全套快捷键指南。
- 在 `AppShell` 中监听 `Cmd+\` 快速折叠侧边栏、`Cmd+Shift+F` 切换全屏沉浸专注模式。
- `SearchWorkspaceContent` 引入 `CASE WHEN` 权重评分机制（标题完全匹配 100 > 标题模糊匹配 50 > 正文包含 10），并在 `CommandPalette` 中支持本地最近访问历史记录。

## 27. 编辑器右侧大纲挤压正文破坏居中对称与竖向原生滚动条显现

### 问题

在文章内引入大纲组件后，大纲位于 Flex 布局右侧挤占正文宽度，使得正文两侧留白不再对称（整体向左偏移）；同时在编辑与浏览文档时浏览器默认原生竖向滚动条显现影响视觉纯粹感。

### 根因

1. 大纲组件直接放置在 `WorkspaceContent` 内部参与 Flex 计算，导致正文阅读列无法以 `mx-auto` 在视口居中。
2. 全局基础层未对原生滚动条进行跨浏览器隐藏规则配置。

### 解决方法

- 在 `global.css` 中为 `html`、`body` 配置 `scrollbar-width: none` 与 `::-webkit-scrollbar { display: none }`，实现全浏览器滚动条视觉隐藏且保留完整平滑滚动能力。
- 将 `DocumentEditor` 的 `WorkspaceContent` 恢复为独立包裹整篇正文（保证 `mx-auto` 绝对居中对称），并将 `DocumentOutline` 调整为右侧视口固定浮层（`fixed right-6 top-20`）。
- 在 `DocumentEditor` 与 `DocumentOutline` 间实现受控联动与自适应空间竞争避让（`transition-[padding] duration-200 xl:pr-64 2xl:pr-0`）：大纲展开时中屏正文平滑避让防遮挡、大屏自然停靠免位移，大纲收起时平滑回弹至完全对称居中。

## 28. 命令面板最近文档缓存未按用户和权限隔离

### 问题

命令面板把最近打开的搜索结果长期保存在浏览器中。同一浏览器切换 Better Auth 账户或用户失去 Project 权限后，面板仍可能显示前一个权限状态下的文档标题、Workspace、Project 和正文片段。

### 根因

`CommandPalette` 将完整 `SearchResultItem` 写入固定的 `localStorage` 键 `knowmesh:recent-documents`。缓存键不包含用户身份，读取缓存时只校验对象形状，不通过服务端重新验证当前用户的 `document.read` 权限。

### 解决方法

- `CommandPalette` 停止在客户端持久化正文片段与完整对象，仅将最近访问的文档 ID 保存至用户隔离的 `knowmesh:recent-document-ids:${userId}` 键中。
- 新增 `getRecentPaletteDocuments` Server Action，在命令面板唤起时传入待验证文档 ID 列表，关联 `project_members` 重新验证当前用户对文档的直接项目权限，并在服务端过滤已删除或无权访问的文档。
- 补充 `GetRecentPaletteDocuments.test.ts` 单元测试，覆盖按传入顺序返回已授权文档并过滤失效文档的业务边界。

## 29. 邀请与权限变更通知链路缺失及管理操作闭环不完整

### 问题

已注册用户被邀请加入工作区或项目时在站内无法获知；管理员直接调整成员角色或移出成员时未向受影响成员推送通知；项目邀请受邀人无法主动拒绝，管理员无法撤回项目邀请；新注册用户历史有效邀请无法自动感知。

### 根因

邀请与角色变更的写操作事务中未集成站内通知服务；项目邀请缺少撤回与拒绝能力对应的 Server Action 与前端交互；认证邮箱验证事件未与历史待处理工作区邀请进行邮箱关联同步。

### 解决方法

- 在工作区与项目邀请、角色变更（`workspace_member_role_updated`/`project_member_role_updated`）、移出成员（`workspace_member_removed`/`project_member_removed`）以及权限申请驳回操作中，原子写入对应站内通知。
- 实现 `revokeProjectInvitation` 与 `rejectProjectInvitation`，在项目访问条和成员管理中提供主动撤回与拒绝操作。
- 在 Better Auth `afterEmailVerification` 中调用 `syncPendingWorkspaceInvitations`，新注册用户自动补发未过期历史邀请通知。
- 升级通知中心卡片式视觉与语义化分类图标，支持一键直达对应项目或工作区。

## 30. 基础交互控件缺失导致跨业务样式碎片化与弹窗组件倒挂

### 问题

系统缺乏通用的基础按钮、表单输入域、状态徽章与快捷键按键组件，导致弹窗外组件（如项目访问操作条、通知中心）倒挂引用模态弹窗专属的 `ModalDialogButton`；各实体创建弹窗大量重复拼装表单标签、输入框与错误提示样式；全站快捷键与状态角标视觉规范分散。

### 根因

基础交互按钮与表单输入控件早期被直接硬编码在 `ModalDialog` 与各个业务页面中，未在 `src/components/ui/` 层建立标准的基础原子组件（Atoms）。

### 解决方法

- 抽象并实现通用的 `Button`（多语义变体与尺寸）、`Input`、`FormField`（集成 Label、Input、Role-Alert 错误信息与高度避震占位）、`Badge` 与 `Kbd` 原子组件，并编写单元测试覆盖。
- 重构 `ModalDialogButton` 使其底层复用通用 `Button`，消除倒挂同时保持原有弹窗 API 完全向后兼容。
- 将创建文件、创建项目、创建工作区、链接编辑弹窗以及通知中心、命令面板、侧边栏导航全面平滑迁移至通用原子组件。

## 31. 认证用户与 Personal Workspace 初始化无法共享事务

### 问题

Better Auth 创建用户后需要立即建立 Personal Workspace，但 Drizzle adapter 的用户 after hook 在认证事务提交后执行；业务初始化失败时用户身份可能已经存在，重试注册会遇到已有账户。

### 根因

Better Auth 的数据库 hook 与 KnowMesh 的 `ensureUserWorkspace` 使用不同事务边界，无法把认证表和 Workspace 表作为一次原子提交。

### 解决方案

- 用户创建 hook 立即调用幂等的 `ensureUserWorkspace`，失败时让注册请求暴露可重试错误。
- Session 创建 hook 再调用同一服务，仅在 Personal Workspace 缺失时补偿。
- 保留 Personal Workspace owner 部分唯一索引和事务写入，保证并发或重复补偿不会创建第二个个人空间。

## 32. 账户身份删除与业务清理不在同一事务

### 问题

Better Auth 内置删除入口先运行应用 `beforeDelete` 回调，再独立删除身份。业务清理已经提交而后续身份删除失败时，用户仍可登录但其 Workspace、Project 和成员关系已经消失。

### 根因

`beforeDelete` 是认证生命周期回调，不共享 `deleteUserData` 使用的 Drizzle 业务事务，顺序执行不能提供跨步骤原子性。

### 解决方案

- 关闭 Better Auth 内置账户删除入口，仅允许 KnowMesh 账号设置调用应用自有 Server Action。
- Server Action 先通过 Better Auth 服务端 API 验证当前密码，再在同一个 Drizzle 事务中执行 `deleteUserData` 和 Better Auth `user` 行删除。
- 身份外键在同一事务内级联删除 Account 与 Session；任一步失败时整体回滚，并以必要测试固定事务边界。

## 33. 账户删除遗漏清理收藏文档关联记录

### 问题

用户在设置页面注销或删除账户后，其在 `starred_documents` 表中的收藏文档记录未被清除，产生与已删除用户关联的孤立数据。

### 根因

`starred_documents` 表的 `user_id` 仅保存用户标识字符串，未设置针对用户表的外键级联删除；而在业务清理函数 `deleteUserData` 中虽然显式清理了通知、邀请、申请、成员和偏好设置，但遗漏了对 `starred_documents` 表的删除调用。

### 解决方法

- 在 `deleteUserData` 事务中引入 `starredDocumentsSchema` 并按 `userId` 显式执行删除。
- 新增 `DeleteUserData.test.ts` 单元测试，验证账户清理包含收藏文档关联记录。

## 34. 全局搜索通配符未转义与 JSON 文本结构误判

### 问题

当用户搜索包含 `%`、`_` 等特殊字符的内容时，数据库将其作为 SQL 通配符解析；同时直接对 `documents.content` 的 JSON 字符串执行 ILIKE 会误命中 ProseMirror 结构保留字（如 `paragraph`、`bulletList`、`doc` 等），导致未包含该正文的文档被作为匹配结果返回。

### 根因

1. `searchWorkspaceContent` 在构建 SQL 模式时未转义 SQL LIKE 特殊字符。
2. 检索条件使用 `documents.content::text ilike searchPattern` 针对整棵 ProseMirror 序列化 JSON 执行匹配，JSON 节点类型和属性键名被当作正文参与了匹配。

### 解决方法

- 新增 `escapeSqlLikePattern` 工具函数，对查询关键词中的 `%`、`_`、`\` 等 SQL 通配符进行转义。
- 在 `searchWorkspaceContent` 返回结果前，结合 `extractPlainText` 校验文档实际标题或纯文本正文是否确实包含搜索词，过滤仅匹配到 JSON 节点结构的假阳性记录。
- 编写 `SqlPattern.test.ts` 与 `SearchWorkspaceContent.test.ts` 单元测试，覆盖通配符转义与结构假阳性过滤。

## 35. 文档标题更新未触发服务端布局缓存失效

### 问题

用户在编辑器中重命名文档标题后，虽然客户端触发了 `router.refresh()`，但侧边栏树状导航、收藏文档列表及概览页仍可能展示旧标题，需手动强刷浏览器才能同步。

### 根因

创建与删除文档（`createDocument` / `deleteDocument`）均调用了 `revalidatePath('/(workspace)', 'layout')` 失效 Next.js 服务端工作区导航缓存，而 `updateDocument` 为避免正文频繁防抖保存导致过载未配置无条件失效，同时遗漏了在 `title` 字段发生变更时定向触发 `revalidatePath`。

### 解决方法

- 在 `updateDocument` 服务端函数中，判断当且仅当包含 `title` 属性时调用 `revalidatePath('/(workspace)', 'layout')`，实现标题变更即时同步且不影响正文防抖保存性能。
- 补充 `UpdateDocument.test.ts` 单元测试，验证正文更新不触发失效、标题更新定向触发工作区布局缓存失效。

## 36. 资源删除与成员移出遗留多态通知死链及待处理申请

### 问题

当工作区或项目所有者删除资源时，受影响成员的站内通知列表中仍残留指向已删除资源的跳转操作，点击后落入无效路由；同时管理员移出项目成员时，该成员在目标项目中的待处理申请与邀请未被清理。

### 根因

1. `notifications` 表采用 `target_kind` 与 `target_id` 多态关联设计，未建立物理外键约束；在 `removeProjectForUser` 与 `removeWorkspaceForUser` 的所有者删除流程中，仅级联清理了直接成员、邀请与申请关系，未同步处理多态通知目标。
2. `removeProjectMember` 在事务中仅删除了 `project_members` 成员行，遗漏了对该成员在当前项目中的 `project_access_requests` 和 `project_invitations` 进行关联清理。

### 解决方法

- 在 `removeProjectForUser` 所有者删除分支中，原子更新 `notifications` 表，将对应 `target_kind = 'project'` 且 `target_id = projectId` 的记录更新为 `target_kind = null, target_id = null`，保留通知历史快照同时满足 `notifications_target_pair_check` 约束并安全移除死链。
- 在 `removeWorkspaceForUser` 所有者删除分支中，先查询该工作区下全部项目，原子将该工作区及其下属全部项目的通知目标置空后删除工作区。
- 在 `removeProjectMember` 事务中补充删除目标成员在当前项目中的待处理申请与邀请。
- 更新 `ResourceRemoval.test.ts` 单元测试，覆盖工作区与项目删除时的通知目标置空逻辑。

## 37. 邀请未注册用户导致登录后生成重复通知

### 问题

邀请未注册用户后，该用户完成注册、邮箱验证并登录时，通知中心出现多条（如 3 条）重复的“收到工作区邀请”通知。

### 根因

1. `syncPendingWorkspaceInvitations` 在同步待处理邀请至站内通知时未进行幂等性去重检查；当邮箱验证接口由于邮件客户端安全扫描、浏览器预取（Prefetch）或页面重定向等原因被多次触发时，每次调用均无条件向 `notifications` 表插入新行。
2. `syncPendingWorkspaceInvitations` 未对同一工作区的多条待处理邀请进行工作区去重，存在按邀请记录逐条重复发通知的隐患。
3. `inviteWorkspaceMember` 在向未注册邮箱发送邀请时，未检查是否已有相同邮箱和工作区的有效待处理邀请，重复邀请会导致数据库存在多条未过期邀请记录。

### 解决方法

- 在 `syncPendingWorkspaceInvitations` 中先查询当前用户已有的 `workspace_invited` 通知，按工作区 ID 去重，仅在不存在对应工作区通知时才调用 `createNotification`。
- 在 `inviteWorkspaceMember` 中增加对同邮箱同工作区已存在活跃邀请（未接受、未撤销且未过期）的前置校验，防止重复插入待处理邀请，对已注册用户也加入未读通知去重防线。
- 更新 `SyncPendingInvitations.test.ts`，补充幂等性与重复邀请去重测试。

## 38. 站内通知被动拉取缺乏即时感知与跨标签页同步

### 问题

通知系统原本为服务端被动拉取（依赖页面刷新或 Server Action 触发布局失效）。跨用户协作（如被邀请、审批通过、角色调整）时，停留于工作台的用户无法即时感知红点与状态变动；同时用户在某一个标签页标记已读后，其他已打开的标签页红点无法即时消除。

### 根因

系统缺少服务端向客户端的主动事件通知通道，各浏览器会话的状态隔离在各自的页面生命周期中。

### 解决方法

- 引入 Web 标准的 Server-Sent Events (SSE) 长连接路由（`/api/realtime/notifications`），配合 Node 进程内广播总线 `NotificationBroadcaster` 实现用户级频道事件分发。
- 在 `createNotification` 数据库写入成功后广播 `notification:new` 事件；在 `markNotificationRead` 与 `markAllNotificationsRead` 成功后广播 `notification:count_sync` 同步未读数。
- 前端通过 `RealtimeNotificationProvider` 管理长连接与 Toast 浮窗提示，并将侧边栏角标拆分为独立轻量组件 `NotificationSidebarBadge`，实现收到通知时仅局部重绘角标文本（Zero-Interruption），不触发页面整体重载，不打断编辑器打字。

## 39. 进程内实时通知早于事务提交且无法跨实例传递

### 问题

业务事务回滚后客户端仍可能收到已经不存在的通知；SSE 连接与业务写入位于不同 Node.js 进程时也无法收到实时事件，浏览器重连后未读角标缺少持久化校准。

### 根因

`createNotification` 在插入后立即调用进程内 `NotificationBroadcaster`，广播不具备数据库事务提交语义，也没有跨进程传输能力。SSE 路由建立连接时只订阅瞬时事件，不读取当前未读状态。

### 解决方法

- 由 `notifications` 数据库触发器在插入或 `read_at` 更新事务提交后调用 PostgreSQL `pg_notify`；回滚事务不会投递信号。
- 每个 Node.js 进程通过专用 `LISTEN` 连接接收信号，再从数据库读取通知快照和准确未读数并向本进程 SSE 连接扇出。
- SSE 初始连接和浏览器重连时主动从数据库同步未读数，持久化数据始终作为角标事实源。

## 40. 所有权变化期间的成员操作继续使用过期授权

### 问题

所有权转让与角色修改或成员移除并发时，等待中的成员操作可能在所有权已经改变后继续执行。数据库延迟 owner 约束能够阻止最终不一致状态提交，但调用方只能收到较晚且不明确的约束错误。

### 根因

成员操作在事务外完成资源授权，进入事务后只锁成员关系，没有与所有权转让共同锁定 Workspace 或 Project 主记录，也没有核对授权时观察到的 owner 是否仍然有效。

### 解决方法

- 所有权转让、成员角色修改和成员移除统一先锁定对应 Workspace 或 Project 主记录。
- 在锁内重新比较当前 `owner_id` 与授权快照；发生变化时返回明确的刷新重试错误，不再继续成员写入。
- 保留数据库延迟约束触发器作为最终 owner 一致性防线。

## 41. 审计写入与筛选不能完整反映业务历史

### 问题

部分资源重命名和邀请撤回先提交业务变更、再单独写审计记录，审计失败时会出现业务成功但历史缺失。审计页面只读取最近 50 条后在客户端分类，可能把更早存在的分类记录错误显示为“暂无记录”。页面还把会随 Workspace 级联删除的产品历史描述为“不可篡改”。

### 根因

相关 Server Action 没有把业务写入和 `recordAuditLog` 放入同一事务；分类参数和 offset 虽已存在于服务端查询，但页面没有使用；产品文案超出了当前数据保留边界。

### 解决方法

- 将 Workspace/Project 重命名及邀请撤回与对应审计记录合并进同一数据库事务。
- 审计页面改为按 URL 分类参数执行服务端过滤，并以 50 条为一页提供前后翻页。
- 将文案明确为 Workspace 生命周期内的关键操作历史，不再宣称其是独立合规意义上的不可篡改留存。

## 42. PGlite Socket 不能验证跨连接实时通知

### 问题

使用默认本地 PGlite 运行双浏览器会话时，通知记录和审计记录已经提交，但专用 `pg` 监听连接收不到另一数据库连接触发的异步通知，实时 Toast 测试会失败；同一迁移和应用代码连接真实 PostgreSQL 时可以正常投递。

### 根因

PGlite 原生 API 支持 `LISTEN / NOTIFY`，但当前 `pglite-socket` 将多个 PostgreSQL 协议客户端复用到单一 PGlite 协议引擎，不等价于真实 PostgreSQL 的多个 backend，不能把异步通知可靠路由到发起 `LISTEN` 的独立 socket 连接。

### 解决方法

- 保留 PGlite 集成测试验证通知触发器的事务提交与回滚语义，以及 SSE 重连时从持久化数据校准未读数。
- 跨连接通知、双会话 Toast、所有权转让、角色降级和协作连接失效链路使用真实 PostgreSQL 执行 Playwright 测试。
- CI E2E job 提供独立 PostgreSQL service 并显式设置 `E2E_REAL_POSTGRES=true`；本地运行器检测该标记后跳过 PGlite，只负责迁移外部数据库和启动应用服务。默认本地 PGlite 不执行 `PermissionRealtime.e2e.ts`，避免产生错误结论。

## 43. 邮件失败后仍可能显示无效邀请 Toast

### 问题

已注册用户的工作区邀请通知早于 Resend 邮件发送。邮件失败时系统虽会撤销邀请，但数据库提交已经触发实时通知，对方仍可能看到一条无法接受的邀请 Toast。

### 根因

站内通知与邀请在邮件调用前一并提交，而外部邮件服务不参与数据库事务；后续补偿只能撤销邀请，不能收回已经投递到浏览器的瞬时事件。

### 解决方法

- 首个事务只创建邀请并记录审计，不提前创建站内通知。
- 邮件成功后重新确认邀请未接受、未撤销且未过期，再为已注册收件人写入去重后的站内通知。
- 邮件失败继续通过补偿事务撤销邀请并记录自动撤销审计，因此不会产生对应数据库通知与 Toast。

## 44. Tiptap 协作包不能按统一补丁版本机械锁定

### 问题

协作依赖首次按现有 Tiptap `3.29.2` 统一安装时，npm 无法解析 `@tiptap/y-tiptap@3.29.2`，导致整个协作依赖集合安装失败。

### 根因

`@tiptap/core`、编辑器扩展和 `@tiptap/y-tiptap` 虽属于同一生态，但不共享相同发布版本序列。`@tiptap/extension-collaboration@3.29.2` 接受 `@tiptap/y-tiptap@^3.0.7`，而后者当时实际发布版本为 `3.0.9`，不存在 `3.29.2`。

### 解决方法

- 继续让核心和编辑器扩展保持 `3.29.2`，单独锁定兼容的 `@tiptap/y-tiptap@3.0.9`。
- Hocuspocus 的 server、provider、React bindings、database extension 和 transformer 统一保持 v4 同一版本线。
- 升级协作依赖时同时检查 npm peer dependency 和 lockfile，不能只根据包名前缀假设版本一致。

## 45. ProseMirror JSON 与 Y.Doc 往返会补齐默认属性

### 问题

合法 ProseMirror JSON 转换为 Y.Doc 后再生成 JSON 时，正文语义和节点结构没有变化，但测试的严格对象比较仍失败。例如 bold mark 会补出空 `attrs`，link mark 会补出默认 `rel`、`target`、`title` 和 `class`。

### 根因

Tiptap transformer 通过完整 ProseMirror Schema 解析并重新序列化节点。Schema 默认属性会在该过程中被规范化，因此“等价有效快照”不等于“与客户端输入逐字段完全相同”。如果把原始 JSON 字节相等当作协作初始化不变量，会把正常的 Schema 规范化误判为内容损坏。

### 解决方法

- 转换入口和输出都继续使用完整 `documentExtensions`，输出再经过 `isDocumentContent` 验证。
- round-trip 测试先取得 Schema 规范化后的快照，再验证二进制编码、加载和二次投影保持该快照稳定。
- 业务正确性以有效节点结构和规范化后的稳定语义为准，不依赖输入 JSON 的属性省略形式。

## 46. Next.js 的 `server-only` 标记不能直接复用于独立协作进程

### 问题

独立 Hocuspocus 服务首次通过 tsx 启动时，在导入协作持久化模块阶段报 `ERR_MODULE_NOT_FOUND: Cannot find package 'server-only'`，服务尚未监听端口便退出。

### 根因

`server-only` 是 Next.js 构建链识别的服务端边界标记，不是独立 Node.js 运行时可以可靠加载的普通依赖。协作持久化代码同时供 Hocuspocus 独立进程执行，如果沿用 Next.js Server Action 模块的标记，会把框架专用的模块解析假设泄漏到新运行边界。

### 解决方法

- 协作状态和持久化模块不导入 `server-only`，只依赖数据库、Schema 和不含浏览器 API 的转换代码。
- 独立入口使用 tsx 解析仓库 TypeScript 与 `@/` 路径别名，避免复制数据库和文档 Schema 实现。
- Next.js 客户端不得直接导入协作持久化模块；后续客户端只通过 Hocuspocus Provider 和受保护的服务端令牌入口连接。
- 独立服务必须执行真实进程启动、健康检查和关闭测试，不能仅以 Next.js 构建或 Vitest mock 通过作为可运行证据。

## 47. 独立服务不会自动加载 Next.js 的 `.env`

### 问题

解决模块解析后再次启动 Hocuspocus，`Env.ts` 报告 `BETTER_AUTH_SECRET`、`DATABASE_URL` 和 `NEXT_PUBLIC_APP_URL` 未定义，而同一工作区的 Next.js 与迁移命令能够读取这些配置。

### 根因

Next.js 和 `dotenv-cli` 各自在自己的启动链路中加载 `.env`，普通 tsx 进程不会自动继承这项框架行为。共享 `Env.ts` 的校验是正确的，但独立服务入口此前没有建立等价的环境加载边界。

### 解决方法

- `collaboration` 脚本显式使用 tsx 的 `--env-file=.env` 启动参数，再由共享 `Env.ts` 完成统一校验。
- 生产 systemd 仍应使用受控的 `EnvironmentFile`，而不是依赖工作目录中的开发 `.env`。
- 每个新增独立进程都必须单独验证环境来源，不能因为 Next.js 能启动就假设其他进程获得相同变量。

## 48. Hocuspocus `onRequest` 不能接管内置 HTTP 响应

### 问题

协作服务的 `/health` 首次请求成功返回 JSON 后，进程立即因 `ERR_HTTP_HEADERS_SENT` 退出，后续 `/metrics` 无法连接。

### 根因

Hocuspocus v4 的 `Server.requestHandler` 在执行 `onRequest` hooks 后仍会写入内置 `Welcome to Hocuspocus!` 响应。hook 内提前调用 `response.end()` 不会阻止默认处理，导致同一响应被写入两次。类型签名允许访问 `response`，但不代表 hook 可以替代内置响应生命周期。

### 解决方法

- WebSocket 端口只运行 Hocuspocus，不在 `onRequest` 中实现业务 HTTP 路由。
- 使用绑定到本地地址的独立轻量 HTTP server 提供 `/live`、`/ready`、`/health` 和 `/metrics`，默认端口为 `1235`；readiness 需要数据库可用且最近一次存储没有失败。
- 优雅关闭同时停止健康服务器、flush 待存储文档并销毁 Hocuspocus，避免留下半存活端口。
- 服务冒烟必须连续请求健康与指标端点，并确认进程仍然存活。

## 49. Team 文档初始化与旧正文保存可能形成两个权威来源

### 问题

协作服务从 `documents.content` 初始化 Yjs 状态期间，旧编辑器仍可通过 `updateDocument(content)` 保存 Team 正文。两条写入交错时，Yjs 可能基于旧 JSON 初始化，随后再把旧内容投影回数据库，覆盖刚完成的普通保存。

### 根因

初始化与旧保存原本没有竞争同一数据库锁；`updateDocument` 也没有检查协作状态或服务端功能开关。仅依靠客户端选择编辑模式不能建立正文权威边界。

### 解决方法

- 初始化和普通正文保存都在事务内锁定同一条 `documents` 记录。
- 普通保存获得锁后用新的数据库语句查询协作状态，确保能看到等待锁期间提交的初始化结果。
- Team 文档无论功能开关和初始化状态如何，服务端都拒绝 `updateDocument(content)`；标题保存继续允许。功能关闭时客户端只读显示 JSON 快照，重新启用后再恢复或首次建立 Yjs 状态。

## 50. 已持久化的 Yjs 状态可能被静默标记为新 Schema 版本

### 问题

加载已有协作状态时没有检查 `document_schema_version`，存储时却直接写入当前版本。未来 Schema 变化后，旧状态可能未经迁移就被当前扩展解释并标记为已升级。

### 根因

版本字段只在首次初始化时写入，没有参与加载和更新条件，因此没有真正形成兼容性边界。

### 解决方法

- 加载已有状态时要求版本与 `DOCUMENT_CONTENT_SCHEMA_VERSION` 完全一致，不兼容时拒绝打开。
- 持久化更新同时匹配文档 ID 和当前状态版本，不允许存储路径承担隐式迁移。
- 后续 Schema 升级必须提供显式 Yjs 状态迁移，成功后才能更新版本字段。

## 51. 协作服务关闭可能在存储失败后无限等待

### 问题

Hocuspocus 在 `onStoreDocument` 失败时会把文档保留在内存中避免丢失，而 `destroy()` 等待文档卸载；直接调用 `flushPendingStores()` 后 `destroy()` 可能永远不返回。异步信号处理若不传播错误，还会让 systemd 只能通过强制终止结束进程。

### 根因

`flushPendingStores()` 不返回可等待的持久化 promise，原关闭流程无法知道最终状态是否成功写入，也没有截止时间或数据库连接释放步骤。

### 解决方法

- 先停止接受连接并关闭现有连接，再在每篇文档的 save mutex 内显式等待事务性持久化。
- 最终持久化、带 15 秒截止时间的 Hocuspocus destroy 和健康端口关闭分别收集错误；前一步失败不得跳过后续资源释放。
- 关闭失败时在资源清理完成后重新抛出单个错误或聚合多个错误，由入口输出结构化错误并设置非零退出码；无论成功失败都释放 PostgreSQL 连接池。

## 52. Next.js 完整 Auth 实例不能作为独立协作进程的 Session 验证器

### 问题

协作进程需要验证浏览器携带的 Better Auth 签名 Cookie，但直接导入应用 `Auth.ts` 会同时加载邮件发送、注册后 Workspace 初始化和 `server-only` 模块，使独立 Node.js 入口重新遇到框架专用模块边界，并把无关副作用带入长连接进程。

### 根因

现有 Auth 实例既定义 Session Cookie 和数据库适配器，也注册了只属于 Next.js 注册、验证邮件流程的生命周期 hook。身份协议配置与应用副作用没有可直接供独立进程复用的最小边界。

### 解决方法

- 协作服务建立只包含相同 Better Auth secret、base URL、Cookie 默认值和 Drizzle Auth Schema 的最小验证实例。
- 首次握手通过 Better Auth API 验证签名 Cookie，并禁用 Cookie Session 缓存，确保从数据库读取当前 Session。
- 后续写入和周期复查只使用握手获得的 Session ID 与 user ID 查询数据库，不在连接上下文保存或记录 Cookie、Session Token 和正文。

## 53. 权限与 Session 失效不能只依赖进程内状态或盲目关闭

### 问题

成员角色、Session 和文档由 Next.js 与 Better Auth 进程写入数据库，独立 Hocuspocus 进程不会自动获知变化。另一方面，Session 正常续期也会更新到期时间；若收到任何 Session 更新都直接关闭连接，会让合法用户在续期时无故断线。

### 根因

长连接建立时的权限快照会过期，而跨进程内存事件无法覆盖数据库中的全部写入者。数据库通知只说明相关记录发生变化，不证明连接已经失效。

### 解决方法

- 在 Project 成员角色、Session 和文档相关表上建立事务性 PostgreSQL 触发器，只发布资源 ID、用户 ID 或 Session ID。
- 协作进程收到信号后重新查询当前 Session 与 Project 文档权限，仅在身份、资源或有效读写级别变化时关闭连接。
- 每次客户端正文写入前强制重新验证，并以 15 秒周期复查作为 LISTEN 断线或漏信号的兜底；通知和周期复查都按连接隔离异常，一个查询失败只记录脱敏结构化错误，不跳过其余连接。

## 54. 协作开关关闭后已激活 Team 文档没有只读降级

### 问题

Team 文档一旦存在协作状态，服务端即使发现协作功能开关已关闭，仍会向客户端返回 `collaborative` 编辑模式；页面的 `canEdit` 又只反映 `document.update` 业务权限。与此同时，独立协作服务在开关关闭时拒绝普通启动。因此已激活文档可能停留在连接或离线界面，而不是从最新持久化 JSON 快照降级为只读。

### 根因

当前 `single-user | collaborative` 二值模式同时承担正文权威来源、协作服务可用性和界面写入能力三个不同概念。`hasCollaborationState` 能阻止已激活文档回退到单人 JSON 写入，却没有表达“正文仍以 Yjs 为权威，但当前只能读取派生快照”的状态；客户端 `canEdit` 也只来自 Project 权限，无法执行 ADR 0012 的运维只读降级边界。

### 解决方法

- 服务端将所有“Team 且功能关闭”的文档分流为明确的 `collaborative-readonly` 模式，使用当前 `documents.content` 快照且不建立 Provider。
- 只读快照编辑器把标题和正文能力分开：正文不可本地编辑、不会注册正文写入 UI，也不会调用 `updateDocument(content)`；标题继续按现有 `document.update` 授权保存。
- `updateDocument` 只根据服务端解析的 Team Workspace 类型拒绝正文 JSON 写入，不依赖功能开关或既有协作状态；重新启用后已有状态继续恢复，未初始化文档才从 JSON 快照首次建立 Yjs 状态。
- 模式单元测试覆盖 Personal、Team 开启和 Team 关闭三种分流；真实 Chrome/Edge 验收确认关闭时两端都只读显示同一最新快照且不建立 Provider，重新启用后恢复同一协作正文，没有产生分叉写入路径。

## 55. Windows 本地进程树清理会绕过协作服务的优雅持久化

### 问题

本地运行脚本原本只需管理 Next.js 和 PGlite，退出时可以直接终止整个进程树。把 Hocuspocus 作为普通 npm 子进程加入同一清理方式后，Windows `taskkill /T` 会直接结束包装进程及其后代，协作服务来不及执行最长 15 秒的待存储文档 flush，可能丢失退出前尚未落库的更新。

### 根因

进程树信号只能表达“结束进程”，不能可靠地把应用级优雅关闭请求穿过 npm 包装层传递给实际 tsx 子进程；原运行脚本统一使用较短的清理等待时间，也小于协作服务已经定义的持久化截止时间。Windows 控制台还会把 `Ctrl+C` 同时广播给共享控制台的所有子进程，导致 PGlite 可能在编排器请求 Hocuspocus flush 前先退出。

### 解决方法

- 本地运行脚本直接以 Node.js 和 tsx CLI 启动协作入口，并建立 IPC 通道，不经过 npm 包装进程。
- Windows 下把数据库、Hocuspocus 和 Next.js 等长生命周期子进程放入独立进程组，并通过管道转发输出；迁移和构建等一次性命令继续由编排器直接等待。
- Windows 清理时先发送 `{ type: 'shutdown' }`，协作入口复用既有的优雅关闭流程；为其预留超过服务端 15 秒截止时间的等待窗口，超时后才回退到进程树终止。
- 就绪探测必须等待独立健康端口 `/ready` 返回结构化 ready 状态，并限制单次 HTTP 请求时间；协作进程提前退出或整体超时都应阻止 Next.js 启动。
- 功能开关关闭时保持原本的本地启动行为，不创建协作进程。

## 56. 协作编辑器离开再进入会残留连接并重复显示在线成员

### 问题

真实双浏览器验收中，owner 和 editor 首次打开同一 Team 文档时各自只显示对方一位在线成员。editor 导航离开文档再返回后，owner 端变成“2 位成员在线”，两个条目都是同一个 editor；健康指标也从预期的 2 条连接增长到 3 条。两个页面离开应用后，服务端连接仍要等待超时才降为 0。

### 根因

`HocuspocusProviderWebsocketComponent` 与 `HocuspocusRoom` 同时随编辑器卸载，并各自用零延迟任务兼容 React Strict Mode。外层任务可能先销毁 WebSocket，使房间 Provider 来不及通过仍可用的传输发送关闭消息；重新挂载会建立新连接，而旧连接及其 Awareness 状态继续存活到服务端超时。Presence 展示又直接按 Awareness client ID 映射，因而把同一用户的残留状态显示为两位成员。

### 解决方法

协作编辑器显式持有外层 WebSocket，并在卸载时为其设置短暂销毁延迟，使 `HocuspocusRoom` 先销毁文档 Provider、发送关闭消息并清理 Awareness，再关闭传输；Strict Mode 的立即重挂载会取消待执行的销毁。Presence 成员同时按稳定用户 ID 防御性去重，并由单元测试覆盖重复 Awareness 状态。真实 Edge/Chrome 验收中，两端通过站内路由离开后 `activeConnections` 与 `activeDocuments` 均立即归零，重新进入时每个用户只出现一次。

## 57. 已连接 editor 被降为 viewer 后界面仍允许本地编辑

### 问题

真实权限撤回验收中，把已连接的 editor 改为 viewer 后，服务端在 2 秒内关闭旧写连接并拒绝后续更新，owner 没有收到 viewer 的测试文本；但 viewer 页面仍保持 `contenteditable=true`，格式工具栏仍可用，本地可以输入一段不会同步的正文。刷新页面后才显示“只读模式”，并丢弃这段本地假写入。

### 根因

客户端只使用首次 Server Component 渲染时的 Project 权限快照作为 `canEdit`，忽略 Hocuspocus 认证返回的 `read-write | readonly` scope。服务端权限失效调用的是文档连接 `close()`，客户端收到的是 Provider `close` 事件而不是底层 WebSocket `disconnect`；只监听断线事件不会撤销 Tiptap 的 `editable` 和工具栏注册。

### 解决方法

客户端初始保持只读；认证成功后只有页面授权仍包含写入能力且服务端 scope 为 `read-write` 才挂载可编辑 Tiptap。Provider `close`、底层断线或认证失败都会撤销运行时编辑能力，并以只读实例替换可写实例；首次认证失败也会撤销基于旧页面授权的标题编辑入口，普通服务断线仍保留独立且由 Server Action 再授权的标题保存。已认证 Provider 重挂载时从其当前 scope 恢复状态。真实 Edge/Chrome 验收中，editor 降为 viewer 后正文 `contenteditable`、格式工具栏和标题写入均被冻结，owner 仍可编辑；恢复 editor 并刷新后重新获得写入能力。自动化浏览器场景覆盖 viewer 初始只读、Project 角色降级、Workspace 成员移除和 Session 撤销；Project 成员删除与角色降级共用 `project_members` 通知和复查路径，不重复保留浏览器场景。上述场景仍待真实 PostgreSQL CI 运行确认。

## 58. 实时同步成功的 Yjs 更新没有写入数据库

### 问题

真实双浏览器验收中，owner 与 editor 的输入能够双向实时出现，重连时也能从服务端内存文档恢复。但等待超过 5 秒最大 debounce、让两个浏览器离开房间并最终确认 `activeConnections=0`、`activeDocuments=0` 后，`document_collaboration_states.state` 与 `documents.content` 仍保持编辑前版本。被服务端拒绝的 viewer 文本没有落库是正确的，但两个合法 editor 的文本也没有落库。

### 根因

Tiptap Collaboration 扩展未显式配置字段名，客户端把正文写入 Y.Doc 的默认 `default` XmlFragment；服务端转换和 JSON 投影固定读取 `content` XmlFragment。因此 Hocuspocus 实际已经持久化二进制更新，但 `documents.content` 一直投影空的 canonical 字段，重启后客户端也只挂载空字段。旧二进制状态解码后，`document.share.get('default')` 还是惰性的 `AbstractType`，若直接用 `instanceof Y.XmlFragment` 判断又会跳过兼容修复。

### 解决方法

- 客户端 Collaboration 扩展与服务端 transformer 统一显式使用 `content` 字段；服务端加载旧状态时先以 `getXmlFragment('default')` 具体化惰性类型，再把有效旧正文转换为只包含 canonical `content` 的新 Y.Doc。
- 指标增加正文变化次数、store 成功次数和最近成功时间，区分“没有触发持久化”与“持久化失败”。
- 转换测试覆盖“编码、解码后修复旧字段”的真实恢复路径；真实 Edge/Chrome 验收确认双向更新同时进入 Yjs 二进制与 JSON 投影，双方离开、完整重启服务后仍恢复相同正文。

## 59. 认证表单在客户端未接管前会把凭据提交到 URL

### 问题

本地双浏览器验收中，在登录页尚未完成客户端 hydration 时提交表单，浏览器执行原生 GET 导航，把邮箱和密码写入地址栏查询参数，并随请求进入开发服务器访问日志。即使认证失败，敏感凭据也可能留在浏览器历史、代理日志或截图中。

### 根因

登录表单依赖客户端提交处理器阻止默认导航，但 HTML 表单没有独立的安全提交方法与服务端目标作为 hydration 前兜底。客户端 JavaScript 尚未注册事件时，浏览器采用表单默认 GET 行为并序列化所有具名字段。

### 解决方法

- 登录、注册、申请重置与完成重置表单都显式声明 `method="post"`；客户端接管后仍由原提交处理器调用 Better Auth，接管前或禁用 JavaScript时浏览器也不会再把具名凭据序列化到 URL。
- Playwright 使用禁用 JavaScript的登录页提交覆盖 hydration 前路径，断言导航请求使用 POST，且请求 URL和最终页面 URL均不包含邮箱或密码。
- 开发服务器访问日志只记录不含凭据的页面 URL；测试只使用明确标记为非真实密码的固定值，不把真实凭据、请求正文或含敏感参数的截图保存为工件。

## 60. Windows 本地编排退出后残留 Next.js 与 PGlite 进程

### 问题

真实 Windows 本地验收中，对 `npm run dev` 发送 `Ctrl+C` 后编排器和 Hocuspocus 会退出，但 Next.js 与 PGlite 后代进程仍持续监听 3000 和 5432 端口。随后重新启动会因 5432 已占用而失败，并可能继续复用未被清理的旧 Next.js 进程。

### 根因

当前编排器通过 npm 包装层启动 Next.js，并在 Hocuspocus 优雅关闭完成后异步启动 `taskkill`。Windows 终端处理 `Ctrl+C` 时会先结束外层 npm/编排器会话，异步清理子命令尚未完成便随父进程终止；Next.js 包装进程退出后留下实际 `next-server`，PGlite 也继续运行。原清理逻辑既忽略 `taskkill` 退出状态，也不复核实际监听端口；现有单元测试只使用模拟 `ChildProcess` 验证调用顺序和 IPC 请求，无法覆盖外层终端结束与真实 Windows 进程树之间的竞争。

### 解决方法

- Next.js 不再经过长期 npm 包装层，Windows 下所有后台子进程都使用隐藏窗口启动；多个 Node 子进程仍是 Next.js 和各独立服务的正常内部结构，但不会各自创建可见终端窗口。
- 编排器收到退出请求时启动独立、隐藏且脱离外层终端生命周期的清理进程，同时请求 Hocuspocus 通过 IPC 优雅关闭。清理进程立即终止 Next.js 树，等待 Hocuspocus 在截止时间内完成持久化后再终止 PGlite，并在超时后强制结束协作进程树。
- 清理进程启动时记录本次运行实际占用四个服务端口的 PID，结束时只允许终止这些精确进程并复核 3000、5432、1234 和 1235 全部释放；出现其他 PID 接管端口时报告错误，不终止无关进程。
- 真实 Windows 验收连续两次确认 `Ctrl+C` 后一秒内四个端口全部释放、辅助清理进程不残留，中间能够立即无冲突重启；服务监听进程的可见主窗口句柄均为零。

## 61. Windows 清理兜底不能写死 Next.js 默认端口

### 问题

本地 `dev` 使用 3000 时退出清理验收通过，但 Playwright 本地运行通过 `PORT=3008` 启动 Next.js。清理辅助进程最初只复核固定的 3000、5432、1234 和 1235；如果 Next.js 根进程先退出并留下实际 server 后代，3008 可能不在兜底检查范围内。

### 根因

清理逻辑把默认开发端口误当成运行时不变量，没有沿用本地编排已经传给 Next.js 和协作服务的实际环境配置。正常 `taskkill /T /F` 能掩盖这个缺口，因此只验证默认 `npm run dev` 或一次正常 Playwright 退出不足以证明自定义端口也受保护。

### 解决方法

- 编排器启动清理辅助进程时显式传入当前 `PORT`、`COLLABORATION_PORT` 和 `COLLABORATION_HEALTH_PORT`，数据库端口继续使用本地运行协议固定的 5432。
- 清理辅助进程校验端口范围，以本次实际配置建立监听 PID 快照，只终止这些已确认进程；不再假设应用一定监听 3000。
- 无 JavaScript Playwright 验收使用 3008 启动并通过，退出后再次确认 3008、5432、1234 和 1235 均不再监听。

## 62. Team 正文写入边界和协作持久化状态仍受客户端运行状态影响

### 问题

未初始化且协作开关关闭的 Team 文档仍会进入单人编辑器，并允许 `updateDocument(content)` 写入 JSON；协作编辑器导出继续使用页面加载时的旧快照，服务端持久化失败也不会反馈到浏览器。服务首次连接失败时，页面只显示骨架屏，用户无法读取最近一次成功投影的正文。

### 根因

编辑器分流和 Server Action 同时把功能开关、是否已有协作状态与 Workspace 正文权威类型混为一体；协作客户端只观察 WebSocket 同步状态，没有区分“Yjs 已同步到服务内存”和“Yjs 与 JSON 投影已事务持久化”。导出入口持有服务端初始 props，而不是当前 Tiptap 状态。

### 解决方法

- 服务端只按文档所属 Workspace 类型决定正文写入引擎：Personal 允许经过授权和校验的 `updateDocument(content)`，Team 始终拒绝；协作开关关闭时所有 Team 文档都只读显示 JSON 快照。
- 协作服务在事务持久化成功或失败后向当前房间广播受控无状态消息；客户端只在 Provider 报告本地未同步更新时进入保存中，避免 Tiptap 初次加载正文触发 `onUpdate` 后永久停留在保存中，并据持久化消息显示已保存或保存失败。失败不会启用 JSON 备用写入。
- 首次同步前服务不可用时显示只读快照并保留独立的标题保存能力；认证失败时正文和标题都冻结。连接恢复并完成 Yjs 同步后才恢复正文编辑。
- Markdown 导出读取当前编辑器内容；搜索读取最近一次成功事务投影，最近文档和收藏继续只读取文档元数据。
- 真实 Chromium 双会话验收覆盖同步、成功投影、持久化失败、数据库快照不前进、恢复持久化、服务不可用只读快照和自动重连。

## 63. 持久化失败后的文档可能被卸载且 readiness 被其他文档错误恢复

### 问题

协作文档 store 失败后只有错误提示，没有自动重试或按文档记录未恢复状态。最后一个客户端随后离开时，失败更新可能随内存文档卸载而丢失；另一篇文档保存成功还会把全局失败计数清零，使 `/ready` 在仍有未保存文档时返回成功。关闭流程遇到第一篇文档失败后也会跳过后续文档的显式最终持久化。

### 根因

持久化健康度只使用全局连续失败计数，没有把失败与具体文档生命周期关联；失败 hook 返回后也没有独立重试调度。关闭代码把全部文档放在同一个 `try` 中，异常会提前结束循环。

### 解决方法

- 按文档记录失败状态并周期重试；失败文档在恢复成功前阻止 Hocuspocus 卸载，恢复后无连接时再主动卸载。
- readiness 依据尚未恢复的失败文档集合判断，其他文档保存成功只能清除自身状态；指标同时公开失败文档数量。
- 关闭时先阻止文档卸载，再逐篇执行最终持久化并分别收集错误；全部尝试结束后才允许销毁服务。
- 单元测试覆盖断开最后一个客户端后的自动重试、跨文档 readiness 和单篇失败不跳过后续最终持久化；真实 PostgreSQL E2E 覆盖失败、断开、数据库恢复和重新打开。

## 64. 协作 E2E 在多个浏览器项目之间共享固定数据库资源

### 问题

CI 同时运行 Chromium 和 Firefox 项目时，两套协作测试使用相同的用户、Session、Workspace、Project 和 Document ID，并在共享 PostgreSQL 中删除和重建这些记录。并行 worker 会互相触发级联删除、连接失效或唯一键冲突；后续测试还依赖首个测试留下的正文，无法独立运行和可靠重试。

### 根因

测试夹具以模块级固定常量和一次性 `beforeAll` 初始化为中心，没有把浏览器 worker 与单个测试视为独立数据库租户，也没有为每个用例声明完整前置状态。

### 解决方法

- 每个测试生成独立用户、Session、Workspace、Project 和 Document ID，并在 `beforeEach` 中建立完整初始状态、在 `afterEach` 中级联清理。
- 后续测试只断言自身夹具的初始正文，不读取其他测试产生的恢复文本。
- 协作验收固定由 Chromium 执行，Firefox 继续运行其余通用 E2E，避免对已稳定的同一 WebSocket/Yjs 路径做跨引擎重复验收；真实远端运行仍是确认容器网络、测试隔离和服务清理的最终证据。

## 65. 单个连接复查异常会跳过同批次后续权限撤销

### 问题

数据库通知回调和 15 秒周期复查在一个外层 `try` 中顺序处理全部连接。若前面的 Session 或权限查询抛错，循环立即结束，后续连接在本轮不会重新验证；持续失败的前置连接可能反复延迟其他用户的权限撤销。

### 根因

错误边界包围整个连接集合，而不是单条连接。虽然异常会被记录且定时器能够再次运行，但实现不能保证一次失败只影响对应连接。

### 解决方法

- 抽取统一的连接复查函数，在每条连接内部捕获并记录脱敏错误，继续处理集合中的下一条连接。
- PostgreSQL 失效通知和周期定时器复用同一函数；只有明确返回无效的连接才关闭并增加失效指标。
- 单元测试让第一条连接查询失败、第二条返回无效，确认第二条仍被关闭且指标只记录实际撤销。
