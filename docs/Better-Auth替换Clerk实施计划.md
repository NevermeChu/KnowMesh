# KnowMesh：Better Auth 替换 Clerk 实施计划

> [!NOTE]
> 这是已经完成的 Better Auth 替换实施计划。当前认证架构、生命周期与数据流请参阅 [`architecture/overview.md`](architecture/overview.md)、[`architecture/rendering-and-data-flow.md`](architecture/rendering-and-data-flow.md) 与 [`adr/0009-use-better-auth-for-local-identity.md`](adr/0009-use-better-auth-for-local-identity.md)。

## 1. 目标

使用 Better Auth 完整接管 Clerk 当前承担的身份认证职责，同时保持 KnowMesh 现有 Workspace、Project、成员、邀请和权限模型不变。

本次迁移不保留现有 Clerk 用户和会话；允许重建数据库，因此不实现 Clerk 用户导入、旧用户 ID 映射、双写或灰度兼容。

完成后应满足：

- 用户可以通过邮箱和密码注册、登录、退出。
- 注册邮箱必须完成验证；验证和密码重置邮件继续通过 Resend 发送。
- 登录成功后自动拥有一个 Personal Workspace。
- 所有受保护页面、Server Action 和 Route Handler 都通过服务端会话验证身份。
- 用户可以查看和修改基本资料、修改密码并删除账号。
- 删除账号前按现有业务规则删除自有资源、退出他人资源并匿名化保留文档的创建者。
- Workspace 邀请只允许由当前账号的唯一已验证邮箱接受。
- 代码、测试、CI、环境变量和当前状态文档中不再存在 Clerk 运行时依赖。

## 2. 范围边界

### 包含

- Better Auth、Drizzle/PostgreSQL 适配器和认证数据表。
- Next.js `/api/auth/[...all]` Route Handler。
- 服务端身份读取、路由保护和安全重定向。
- 登录、注册、退出、邮箱验证、忘记密码和重置密码。
- 用户资料、修改密码和删除账号页面。
- Personal Workspace 创建及账号删除业务清理。
- 当前 Clerk 用户目录查询的本地数据库替代。
- Resend 认证邮件模板与发送逻辑。
- 单元测试、集成测试、E2E、环境配置、CI 和文档更新。

### 不包含

- Clerk 历史用户、密码、会话或用户 ID 迁移。
- Better Auth Organization 插件；现有 Workspace/Project 权限模型继续作为唯一业务授权来源。
- 多邮箱账号。每个用户只有一个登录邮箱，Workspace 邀请以该邮箱为准。
- 第一阶段不引入管理员、封禁、模拟登录、2FA、Passkey、Magic Link 等当前项目没有显式使用的能力。
- Workspace 或 Project 所有权转让；继续遵守现有 owner 删除、member 退出规则。

## 3. 核心设计决策

### 3.1 身份与业务授权分离

Better Auth 只负责：

- 用户身份；
- 登录账号；
- Session；
- 邮箱验证；
- 密码与账号生命周期。

KnowMesh 继续负责：

- Workspace 和 Project；
- 成员、角色和邀请；
- 权限判断；
- 账号删除时的业务资源处理。

业务代码不得直接散布 `auth.api.getSession()`，统一通过内部认证边界调用：

```ts
getCurrentUser()
requireUser()
```

`requireUser()` 返回经过验证的本地用户身份，未登录时抛出统一认证错误。页面重定向由页面或 proxy 负责，Server Action 不依赖客户端传入的用户 ID。

### 3.2 用户主键

- 使用 Better Auth 生成的字符串用户 ID。
- Better Auth `user` 表成为用户身份资料的权威来源。
- 所有业务表的 `user_id`、`owner_id`、`created_by_id` 和 `recipient_user_id` 继续保存字符串用户 ID。
- 在适合级联且不会破坏 `deleted_user` 匿名标识语义的位置增加用户外键；其余引用继续由账号删除事务显式清理。
- 数据库重建后不保留 Clerk ID。

### 3.3 注册与 Personal Workspace

- 使用 Better Auth `databaseHooks.user.create.after` 触发 `ensureUserWorkspace(user.id)`。
- `ensureUserWorkspace` 保持事务和唯一索引幂等保护。
- 不再保留公开 Clerk webhook，也不再要求本地开发暴露公网 HTTPS endpoint。
- 注册成功进入工作台前，应保证 Personal Workspace 已创建；若 hook 失败，注册请求必须失败或呈现明确的可重试错误，不能创建半初始化账号。

实现时需要验证 Better Auth hook 与业务事务是否共享事务。如果不能共享，则增加幂等补偿：登录后仅在缺少 Personal Workspace 时调用专用初始化服务；普通 Workspace 查询仍保持只读。

### 3.4 删除账号

- 账号删除必须从 KnowMesh 自有设置页面发起。
- 删除 Better Auth 用户前调用现有 `deleteUserData(user.id)`。
- 业务清理成功后再删除 Better Auth 用户；业务清理失败必须阻止身份删除。
- 对邮箱密码用户要求当前密码或 fresh session；UI 明确提示不可恢复及协作资源影响。
- 继续保留文档创建者的 `deleted_user` 匿名标识。
- 不依赖异步 webhook 完成核心清理。

### 3.5 邮箱与 Workspace 邀请

- `user.email` 是账号唯一邮箱，`user.emailVerified` 是验证状态。
- 注册后发送验证邮件，未验证用户不得进入受保护业务区。
- 待处理邀请查询和接受邀请只比较规范化后的当前用户邮箱。
- 邮箱比较规则集中实现，至少进行 `trim` 和小写化，并与邀请写入规则一致。
- 更换邮箱时必须重新验证；验证完成前不能用新邮箱接受邀请。

### 3.6 Proxy 与服务端验证

- `proxy.ts` 负责未登录用户的快速重定向和 `redirect_url` 保留。
- 所有 Server Component、Server Action 和 Route Handler 仍必须调用 `requireUser()` 做完整 Session 验证，不能把 cookie 是否存在当成授权依据。
- 继续使用现有安全本地跳转校验，删除其中 Clerk 专属描述。

## 4. 分阶段实施

### 阶段 0：建立基线与架构决策（0.5–1 天）

- 记录当前 `npm run lint`、`npm run check:types`、`npm run test` 和 `npm run test:e2e` 结果。
- 列出全部 Clerk import、环境变量、Webhook、测试 mock 和文档引用，形成移除清单。
- 新增 Accepted ADR，说明采用 Better Auth 本地身份表、同步生命周期处理及单邮箱规则。
- 新 ADR 明确 supersede ADR 0007；ADR 0008 的 owner 删除/member 退出规则继续有效，但认证提供方和触发方式由新 ADR 替代。
- 确认仅重建明确指定的开发/生产数据库；执行前分别核对数据库地址和备份需求。

验收：Clerk 使用清单完整；关键设计决策已落入 ADR；基线测试结果可复现。

### 阶段 1：认证基础设施与 Schema（1–2 天）

- 安装 `better-auth`，移除 Clerk 依赖留到最终阶段。
- 在 `src/libs` 或独立 `src/features/auth` 中建立服务端 `auth` 和 React `authClient`。
- 使用现有 `db` 和 Drizzle PostgreSQL adapter，避免创建第二套连接池。
- 在 `Schema.ts` 中加入 Better Auth 所需的 `user`、`session`、`account`、`verification` 表及索引。
- 生成并审查 Drizzle migration；不要手写与 Schema 不一致的并行认证表。
- 新增 `/api/auth/[...all]` Route Handler。
- 在 `Env.ts` 中验证 Better Auth secret、应用基础 URL 和认证邮件需要的配置。
- 统一 URL 来源，开发环境使用本地 URL，生产环境使用生产公网 URL。

验收：空数据库可迁移；注册 API 能创建用户、账号和 Session；Schema、migration、快照保持同步。

### 阶段 2：内部认证边界与路由保护（1–2 天）

- 实现 `getCurrentUser()` 和 `requireUser()`，提供稳定的 `{ id, name, email, emailVerified, image }` 形状。
- 将所有 `auth.protect()` 替换为 `requireUser()`。
- 将 `currentUser()` 替换为当前用户对象或本地用户查询。
- 将 `clerkClient()` 用户查询替换为本地 `user` 表批量查询，避免逐用户 N+1 查询。
- 重写 `proxy.ts`，保留当前受保护路径和安全返回地址行为。
- 移除根布局中的 `ClerkProvider`；客户端状态通过 Better Auth `useSession()` 获取。
- 为未登录、Session 过期、邮箱未验证建立一致处理。

验收：伪造用户 ID 或仅携带无效 cookie 无法调用任何受保护 Server Action；登录后原有业务查询和写入使用 Better Auth 用户 ID。

### 阶段 3：认证与账户 UI（2–3 天）

- 用项目现有表单和 UI 组件实现登录页与注册页，继续复用 `AuthenticationPanel`。
- 实现退出操作和登录状态条件渲染，替换 `SignOutButton` 与 `Show`。
- 实现邮箱验证结果页、重新发送验证邮件、忘记密码和重置密码页面。
- 重写用户资料页：显示邮箱与验证状态、修改名称/头像、修改密码、删除账号。
- 所有表单加入 loading、字段错误、服务端错误、重复提交保护和安全跳转。
- 保持中文界面，不暴露 Better Auth 原始英文错误给最终用户。

验收：注册、验证、登录、退出、重置密码、资料修改和账号删除可以从浏览器完整走通。

### 阶段 4：用户生命周期与邀请（1–2 天）

- 将 `user.created` webhook 逻辑迁移到 Better Auth 用户创建 hook。
- 将 `user.deleted` webhook 逻辑迁移到删除账号前置流程。
- 为 Personal Workspace 初始化失败设计幂等重试和可观察错误。
- 把邀请人名称从 Clerk `firstName/lastName/primaryEmailAddress` 映射改为 Better Auth `name/email`。
- 把所有“已验证邮箱集合”逻辑改为唯一邮箱和 `emailVerified` 判断。
- 权限概览和成员列表通过本地用户表补全姓名、邮箱和头像。

验收：新用户恰好拥有一个 Personal Workspace；重复初始化不产生第二个；删除用户后的业务数据满足 ADR 0008；邀请只能由匹配且已验证的邮箱接受。

### 阶段 5：Resend 认证邮件（1 天）

- 使用现有 Resend 客户端发送邮箱验证与密码重置邮件。
- 新增与 Workspace 邀请邮件风格一致的认证邮件模板。
- 链接统一基于经 `Env.ts` 验证的应用基础 URL 构造。
- 本地开发明确采用的策略：真实 Resend 测试收件人、日志预览或测试 transport，不能静默生成指向生产域名的链接。
- 避免在日志中输出 token、完整验证链接和用户密码。

验收：本地和生产配置分别生成正确域名的链接；过期、重复使用和篡改 token 均失败且提示清晰。

### 阶段 6：测试与安全验证（1.5–2.5 天）

单元测试：

- `getCurrentUser()` / `requireUser()` 的登录、未登录和未验证状态。
- 安全 `redirect_url` 校验。
- 邮箱规范化和邀请邮箱匹配。
- 用户资料批量映射。
- Personal Workspace hook 幂等性。

集成测试：

- 注册后创建用户、Session 和 Personal Workspace。
- 删除账号时业务清理失败会阻止删除认证用户。
- owner 删除/member 退出及 `deleted_user` 匿名化。
- 过期 Session 和已撤销 Session 被拒绝。

E2E：

- 注册 → 验证邮箱 → 登录 → 进入 dashboard。
- 未登录访问保护页 → 登录 → 返回原页面。
- 忘记密码 → 重置 → 新密码登录。
- 接受匹配邮箱邀请；拒绝未验证或不匹配邮箱。
- 删除账号后不能登录，且相关业务数据符合规则。

安全检查：

- Session cookie 使用正确的 `httpOnly`、`secure` 和 `sameSite` 设置。
- Server Action 不信任客户端用户 ID。
- 登录、注册、重发验证和重置密码具备合理限流。
- 错误响应不泄露账号是否存在。
- 回调 URL 不能跳转到站外。

验收：`npm run lint`、`npm run check:types`、`npm run test`、`npm run test:e2e` 和 `npm run build-local` 全部通过。

### 阶段 7：移除 Clerk、更新文档与部署（1–1.5 天）

- 删除 `@clerk/nextjs`、`@clerk/localizations` 及 Clerk webhook route。
- 删除 Clerk publishable key、secret key、webhook signing secret 和 GitHub Actions Clerk 配置。
- 增加生产 Better Auth secret、基础 URL 和邮件回调相关配置。
- 更新架构、渲染与数据流、数据库、部署、项目/邀请相关当前状态文档。
- 更新代码中所有 Clerk 专属 JSDoc、错误文本和注释。
- 在 `docs/PROBLEMS.md` 记录本次发现并实际解决的重大问题；不记录机械替换细节。
- 全仓搜索 `clerk`、`Clerk`、旧环境变量，确认只允许历史 ADR 中保留必要的历史描述。

验收：生产构建不包含 Clerk 包；运行环境不需要 Clerk 配置；当前状态文档只描述 Better Auth，历史 ADR 保持历史真实性并由新 ADR supersede。

## 5. 数据库重建与切换步骤

该步骤具有破坏性，只能在再次确认目标数据库允许清空后执行。

1. 暂停生产写入或确认项目尚未开放、数据库没有需要保留的数据。
2. 显式核对目标数据库主机、数据库名和环境，禁止依赖未解析变量或模糊脚本目标。
3. 如存在任何保留可能，先生成可恢复备份并验证备份文件有效。
4. 部署包含 Better Auth Schema、认证路由和新环境变量的版本。
5. 重建目标数据库并顺序执行已提交的全部迁移。
6. 创建一个测试账号并完成全链路冒烟测试。
7. 确认 Personal Workspace、登录、邀请、资料修改和删除账号正常。
8. 删除 Clerk Dashboard webhook 和未再使用的 Clerk 项目配置。

由于数据库被重建，本次不采用双写或旧版本应用回滚。切换前应保留上一版应用产物，但必须明确：旧 Clerk 版本不能对新的 Better Auth 空数据库正常提供登录。出现问题时优先修复前滚，而不是把应用单独回滚到 Clerk 版本。

## 6. 建议提交拆分

保持每个提交可审查，避免把 Schema、全部 UI 和删除 Clerk 混在一个提交中：

1. `docs: define the Better Auth replacement architecture`
2. `feat: add Better Auth persistence and API routes`
3. `refactor: route authentication through local user helpers`
4. `feat: replace Clerk authentication and account interfaces`
5. `refactor: move user lifecycle handling into Better Auth`
6. `test: cover Better Auth identity and account lifecycle`
7. `chore: remove Clerk configuration and dependencies`
8. `docs: update authentication and deployment documentation`

若某一步必须同时修改行为与文档，可将对应文档放入同一个功能提交，不必机械遵循以上拆分。

## 7. 完成定义

只有同时满足以下条件才算替换完成：

- 全仓没有运行时 Clerk import、Clerk middleware 或 Clerk webhook。
- 所有受保护服务端入口都经过 `requireUser()` 或等价的服务端完整 Session 验证。
- 登录、注册、验证、重置密码、资料管理、退出和删除账号完整可用。
- 注册和删除生命周期不会产生无 Personal Workspace 用户或悬空 owner。
- 用户目录展示不依赖外部认证服务 API。
- Workspace 邀请邮箱语义已统一为唯一已验证邮箱。
- 所有测试、Lint、类型检查和构建通过。
- CI、生产环境和运维文档不再要求 Clerk secret 或 webhook。
- 新 ADR 已替代 Clerk 生命周期决策，当前状态文档与实现一致。

## 8. 工期与执行顺序

预计单人 8–12 个工作日：

- 认证基础设施和服务端替换：2–4 天；
- UI、邮件和账户生命周期：3–4 天；
- 测试、文档、清理和切换：2–4 天。

推荐严格按“架构决策 → Schema/API → 服务端认证边界 → UI → 生命周期 → 测试 → 移除 Clerk”执行。在 Better Auth 全链路通过前不要提前删除 Clerk 依赖，以便逐阶段编译和对照现有行为。

## 9. 实施参考

- Better Auth Next.js 集成：https://better-auth.com/docs/integrations/next
- Better Auth Drizzle adapter：https://better-auth.com/docs/adapters/drizzle
- Better Auth 邮箱密码认证：https://better-auth.com/docs/authentication/email-password
- Better Auth Session：https://better-auth.com/docs/concepts/session-management
- Better Auth 邮件验证与密码重置：https://better-auth.com/docs/concepts/email
- Better Auth 用户与账号：https://better-auth.com/docs/concepts/users-accounts
- Better Auth 数据库 hooks：https://better-auth.com/docs/concepts/database
