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

移除 Workspace 成员时会清理该用户在 Workspace 内的项目直接成员关系，但项目所有权仍由 `projects.owner_id` 独立保存。当前流程只拒绝移除仍拥有 Personal 项目的成员；如果该成员拥有 Collaboration 项目，移除操作会删除其 `project_members` owner 记录和 Workspace 成员关系，却保留项目的 `owner_id`，产生所有者不再属于上级 Workspace、也不再存在于项目成员表的孤立项目。

### 根因

所有权和成员身份分别存储在资源表、项目成员表与 Workspace 成员表中，“项目 owner 必须同时是项目 owner 成员和所属 Workspace 成员”是由应用事务维护的跨表不变量，普通外键无法完整表达。成员移除流程只考虑了 Personal 项目的访问语义，没有统一处理两类项目的所有权生命周期；同时系统尚未提供项目所有权转让能力。

### 解决方法

- 在移除 Workspace 成员前查询其在该 Workspace 中拥有的所有项目，不按 `kind` 排除 Collaboration 项目；只要仍拥有项目，就拒绝直接移除。
- 实现项目所有权转让，并在同一事务中更新 `projects.owner_id`、新旧 owner 的 `project_members` 角色和成员关系；新 owner 必须已经属于所属 Workspace。
- 完成所有权处理后，再在同一事务中清理该用户的项目直接成员关系与 Workspace 成员关系，防止中途留下跨表不一致状态。
- 为 Personal 和 Collaboration 项目所有者、普通成员、Workspace owner 以及失败回滚分别增加集成测试；在转让流程完成前，不把“移除成员”描述为已覆盖所有资源生命周期。

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
