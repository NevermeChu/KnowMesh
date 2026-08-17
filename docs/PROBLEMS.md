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


