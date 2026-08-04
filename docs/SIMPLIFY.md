# 项目精简记录

本文档按照 `TECH_STACK_REMOVAL_ORDER.md` 的批次顺序，记录每批技术移除涉及的文件和函数。函数仅记录名称。

## 执行前兼容性修复

### 修改的文件

- `oxfmt.config.ts`
  - 按运行平台选择换行符，确保 Windows 与 CI 环境均可执行格式检查。
  - 忽略本地工具生成的未跟踪目录 `.claude/` 和 `.clerk/`。

### 修改或删除的函数

- 无。

## 第 1 批：删除 semantic-release 自动发布

### 修改的文件

- `package.json`
  - 删除 `semantic-release` 开发依赖。
  - 删除 `release` 配置。
- `package-lock.json`
  - 通过 npm 卸载命令移除 `semantic-release` 及其不再需要的关联依赖。
- `README.md`
  - 删除 Semantic Release、自动 changelog 和自动 GitHub release 的说明。

### 删除的文件

- `.github/workflows/release.yml`

### 修改或删除的函数

- 无。

## 第 2 批：删除 Checkly

### 修改的文件

- `.env.production`
  - 删除 Checkly 环境变量示例。
- `knip.config.ts`
  - 删除对 `checkly.config.ts` 的忽略项。
  - 删除仅由 Checkly 的 dotenv 命令触发的 `production` 二进制忽略项。
- `package.json`
  - 删除 `checkly` 开发依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 `checkly` 及其不再需要的关联依赖。
- `README.md`
  - 删除 Checkly 功能、配置、赞助展示和图片引用。
- `src/app/[locale]/(marketing)/page.tsx`
  - 删除首页技术清单中的 Checkly。
- `src/components/Sponsors.tsx`
  - 删除 Checkly 赞助项和图片导入。
- `tests/e2e/Sanity.e2e.ts`
  - 由 `tests/e2e/Sanity.check.e2e.ts` 重命名。
  - 删除 Checkly 专属注释，保留 Playwright 冒烟测试。

### 删除的文件

- `.github/workflows/checkly.yml`
- `checkly.config.ts`
- `public/assets/images/checkly-logo-dark.png`
- `public/assets/images/checkly-logo-light.png`

### 修改或删除的函数

- `Sponsors`

## 第 3 批：删除 Crowdin 平台集成

### 修改的文件

- `.github/workflows/CI.yml`
  - 删除拉取请求中的 Crowdin 同步任务。
- `README.md`
  - 删除 Crowdin 配置、自动同步、赞助展示和图片引用。
  - 保留 next-intl 本地化说明，改为直接维护 locale JSON 文件。
- `src/app/[locale]/(marketing)/about/page.tsx`
  - 删除 Crowdin 推广链接、图片和对应导入。
- `src/app/[locale]/(marketing)/page.tsx`
  - 首页技术清单只保留 next-intl。
- `src/components/Sponsors.tsx`
  - 删除 Crowdin 赞助项和图片导入。
- `src/libs/I18n.ts`
  - 删除 Crowdin 自动同步流程注释，保留 next-intl 请求配置。
- `src/locales/en.json`
  - 删除只用于 Crowdin 推广的翻译键。
- `src/locales/fr.json`
  - 删除只用于 Crowdin 推广的翻译键。

### 删除的文件

- `.github/workflows/crowdin.yml`
- `crowdin.yml`
- `public/assets/images/crowdin-dark.png`
- `public/assets/images/crowdin-white.png`

### 修改或删除的函数

- `About`
- `Sponsors`

## 第 4 批：删除 Commitlint 与交互式提交工具

### 修改的文件

- `.github/workflows/CI.yml`
  - 删除拉取请求提交信息校验步骤。
  - 删除仅用于提交校验的完整 Git 历史拉取配置。
- `lefthook.yml`
  - 删除 `commit-msg` hook，保留 pre-commit 的 Ultracite 和 Knip。
- `package.json`
  - 删除 `commit` 脚本。
  - 删除 Commitlint CLI、规则、交互式提示和类型依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Commitlint 相关依赖。
- `README.md`
  - 删除 Commitlint、Commitizen 和 `npm run commit` 说明。
  - 保留手动遵守 Conventional Commits 的说明。
- `src/app/[locale]/(marketing)/page.tsx`
  - 删除首页技术清单中的 Commitlint 和 Husky。

### 删除的文件

- `commitlint.config.ts`

### 修改或删除的函数

- `Index`

## 第 5 批：删除 Spotlight

### 修改的文件

- `package.json`
  - 删除 `dev:spotlight` 脚本和 Spotlight 开发依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Spotlight 及其不再需要的关联依赖。
- `README.md`
  - 删除 Spotlight 功能、开发流程和本地 UI 说明。
- `scripts/local-runtime.ts`
  - 删除 Spotlight 命令和进程管理，开发模式只启动 PGlite 与 Next.js。
- `scripts/local-runtime.test.ts`
  - 更新开发进程数量、启动顺序和清理断言。
- `src/instrumentation.ts`
  - 删除 Sentry 服务端配置中的 Spotlight 选项。
- `src/instrumentation-client.ts`
  - 删除 Spotlight 浏览器集成。

### 删除的文件

- 无。

### 修改或删除的函数

- `createCommands`
- `runRuntime`

## 第 6 批：删除 Chromatic 视觉回归

### 修改的文件

- `.github/workflows/CI.yml`
  - 删除 Chromatic 上传、测试结果权限修正和专用完整历史拉取配置。
  - 保留 Playwright E2E 与测试结果 artifact 上传。
- `package.json`
  - 删除 `@chromatic-com/playwright` 开发依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Chromatic Playwright 及其不再需要的关联依赖。
- `playwright.config.ts`
  - 删除 `ChromaticConfig` 泛型和 `disableAutoSnapshot`。
  - 保留 trace、video、浏览器项目和标准 Playwright 配置。
- `README.md`
  - 删除视觉回归功能说明。

### 删除的文件

- `tests/e2e/Visual.e2e.ts`

### 修改或删除的函数

- 无。

## 第 7 批：删除 Storybook 与 Storybook a11y

### 修改的文件

- `.github/workflows/CI.yml`
  - 删除 Storybook CI job。
- `.gitignore`
  - 删除 Storybook 构建和日志忽略项。
- `package.json`
  - 删除 Storybook 开发、测试和构建脚本。
  - 删除 Storybook 核心、Next.js/Vite、文档、a11y 和 Vitest addon 依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Storybook 相关依赖。
- `README.md`
  - 删除 Storybook 功能、项目结构、命令和使用说明。
- `src/app/[locale]/(marketing)/page.tsx`
  - 删除首页技术清单中的 Storybook。
- `tsconfig.json`
  - 删除 `.storybook` 类型检查路径。

### 删除的文件

- `.storybook/main.ts`
- `.storybook/preview.ts`
- `.storybook/vitest.config.ts`
- `.storybook/vitest.setup.ts`
- `src/templates/BaseTemplate.stories.tsx`

### 修改或删除的函数

- `Index`

## 第 8 批：删除 Bundle Analyzer

### 修改的文件

- `next.config.ts`
  - 删除 Bundle Analyzer 导入、`ANALYZE` 条件和插件包装。
  - 保留 next-intl 与 Sentry 配置链。
- `package.json`
  - 删除 `build-stats` 脚本、`@next/bundle-analyzer` 和已无调用方的 `cross-env` 开发依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Bundle Analyzer、`cross-env` 及其不再需要的关联依赖。
- `README.md`
  - 删除 Bundle Analyzer 功能和命令说明。
- `src/app/[locale]/(marketing)/page.tsx`
  - 删除首页技术清单中的 Bundle Analyzer。

### 删除的文件

- 无。

### 修改或删除的函数

- `Index`

## 第 9 批：删除 PostHog 未使用占位配置

### 修改的文件

- `.env`
  - 删除 PostHog key 与 host 示例。
- `README.md`
  - 删除 PostHog 功能声明和赞助展示。
- `src/components/Sponsors.tsx`
  - 删除 PostHog 赞助项和图片导入。
- `src/libs/Env.ts`
  - 同步删除 PostHog 客户端 schema 与 `runtimeEnv` 字段。

### 删除的文件

- `public/assets/images/posthog-logo.svg`

### 修改或删除的函数

- `Sponsors`

## 第 10 批：删除 Sentry 错误监控

### 修改的文件

- `.env.production`
  - 删除 Sentry DSN、组织、项目和认证令牌示例。
- `.github/workflows/CI.yml`
  - 删除构建阶段的 Sentry 禁用变量。
- `.gitignore`
  - 删除 Sentry 构建插件环境文件忽略项。
- `.vscode/launch.json`
  - 删除调试配置中的 Sentry 禁用变量。
- `.vscode/settings.json`
  - 删除 Sentry 自动导入优先级配置。
- `next.config.ts`
  - 删除 Sentry 插件、源码映射上传、错误隧道和遥测配置。
  - 保留 next-intl 插件配置。
- `package.json`
  - 删除 `@sentry/nextjs` 依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Sentry 及其关联依赖。
- `playwright.config.ts`
  - 删除 E2E 服务的 Sentry 禁用变量。
- `README.md`
  - 删除 Sentry 功能、配置说明和赞助展示。
- `src/app/global-error.tsx`
  - 删除客户端错误上报逻辑，保留独立的全局错误页面。
- `src/app/[locale]/(marketing)/page.tsx`
  - 删除首页技术清单中的 Sentry。
- `src/app/[locale]/(marketing)/portfolio/page.tsx`
  - 删除 Sentry 错误监控推广区块。
- `src/components/Sponsors.tsx`
  - 删除 Sentry 赞助项和图片导入。
- `src/locales/en.json`
  - 删除不再使用的错误监控文案。
- `src/locales/fr.json`
  - 删除不再使用的错误监控文案。
- `src/proxy.ts`
  - 从代理匹配排除规则中删除已移除的错误隧道路由。

### 删除的文件

- `src/instrumentation.ts`
- `src/instrumentation-client.ts`
- `public/assets/images/sentry-dark.png`
- `public/assets/images/sentry-white.png`

### 修改或删除的函数

- `GlobalError`
- `Index`
- `Portfolio`
- `Sponsors`

## 第 11 批：删除 Better Stack 与 LogTape

### 修改的文件

- `.env`
  - 删除本地日志级别配置。
- `.env.production`
  - 删除生产日志级别与 Better Stack 接入示例。
- `package.json`
  - 删除 `@logtape/logtape` 依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 LogTape。
- `README.md`
  - 删除 LogTape、Better Stack、日志平台配置和赞助展示。
  - 删除此前遗留的 Monitoring as Code 功能声明。
- `src/app/api/counter/route.ts`
  - 删除计数器成功日志。
- `src/app/[locale]/(marketing)/page.tsx`
  - 删除首页技术清单中的 LogTape。
- `src/components/CurrentCount.tsx`
  - 删除读取计数器成功日志。
- `src/components/Sponsors.tsx`
  - 删除 Better Stack 赞助项和图片导入。
- `src/libs/Env.ts`
  - 删除日志级别与 Better Stack 客户端环境变量。
- `src/utils/DBConnection.ts`
  - 将数据库连接池错误处理替换为最小本地错误输出。

### 删除的文件

- `src/libs/Logger.ts`
- `public/assets/images/better-stack-dark.png`
- `public/assets/images/better-stack-white.png`

### 修改或删除的函数

- `betterStackSink`
- `createDbConnection`
- `PUT`
- `CurrentCount`
- `Index`
- `Sponsors`

## 第 12 批：删除 CodeRabbit 与应用内赞助展示

### 修改的文件

- `README.md`
  - 删除 CodeRabbit 功能、配置说明和赞助展示。
- `src/app/[locale]/(marketing)/page.tsx`
  - 删除 CodeRabbit 技术清单和应用内赞助区块。
- `src/app/[locale]/(marketing)/portfolio/[slug]/page.tsx`
  - 删除 CodeRabbit 代码审查推广区块。
- `src/components/Hello.tsx`
  - 删除 dashboard 中的赞助墙。
- `src/locales/en.json`
  - 删除赞助标题与代码审查推广文案。
- `src/locales/fr.json`
  - 删除赞助标题与代码审查推广文案。

### 删除的文件

- `.coderabbit.yaml`
- `src/components/Sponsors.tsx`
- `public/assets/images/coderabbit-logo-dark.svg`
- `public/assets/images/coderabbit-logo-light.svg`
- `public/assets/images/clerk-logo-dark.png`

### 修改或删除的函数

- `Hello`
- `Index`
- `PortfolioDetail`
- `Sponsors`

## 第 13 批：删除 Codecov

### 修改的文件

- `.github/workflows/CI.yml`
  - 删除 Codecov 覆盖率上传步骤和认证变量。
  - 保留 Vitest 覆盖率生成命令。
- `README.md`
  - 删除 Codecov 功能与配置说明。

### 删除的文件

- `codecov.yml`

### 修改或删除的函数

- 无。

## 第 14 批：删除 Knip

### 修改的文件

- `.github/workflows/CI.yml`
  - 删除依赖使用检查步骤。
- `AGENTS.md`
  - 从允许的检查脚本列表中删除 `check:deps`。
- `lefthook.yml`
  - 删除 Knip pre-commit job，保留 Ultracite。
- `package.json`
  - 删除 `check:deps` 脚本和 `knip` 开发依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Knip 及其关联依赖。
- `README.md`
  - 删除 Knip 功能与命令说明。

### 删除的文件

- `knip.config.ts`

### 修改或删除的函数

- 无。

## 第 15 批：删除 Arcjet

### 修改的文件

- `.env`
  - 删除 Arcjet 本地密钥示例。
- `.env.production`
  - 删除 Arcjet 生产密钥示例。
- `package.json`
  - 删除 `@arcjet/next` 依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Arcjet 及其关联依赖。
- `README.md`
  - 删除 Arcjet 功能、配置说明和赞助展示。
- `src/app/[locale]/(marketing)/counter/page.tsx`
  - 删除 Arcjet 推广区块。
- `src/app/[locale]/(marketing)/page.tsx`
  - 删除首页技术清单中的 Arcjet。
- `src/libs/Env.ts`
  - 删除 Arcjet 服务端环境变量。
- `src/locales/en.json`
  - 删除 Arcjet 推广文案。
- `src/locales/fr.json`
  - 删除 Arcjet 推广文案。
- `src/proxy.ts`
  - 删除机器人检测、Shield 客户端、请求保护和 403 分支。
  - 保留 Clerk 鉴权、受保护路由判断和 next-intl 路由处理。
- `tests/e2e/Sanity.e2e.ts`
  - 增加未登录访问 dashboard 重定向到 sign-in 的回归测试。

### 删除的文件

- `src/libs/Arcjet.ts`
- `public/assets/images/arcjet-dark.svg`
- `public/assets/images/arcjet-light.svg`

### 修改或删除的函数

- `Counter`
- `Index`
- `proxy`

## 第 16 批：删除 Faker 并保留测试隔离

### 修改的文件

- `package.json`
  - 删除 `@faker-js/faker` 开发依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 Faker。
- `tests/e2e/Counter.e2e.ts`
  - 使用 Node `randomInt` 生成 1 至 1,000,000 的隔离 ID。
  - 保留 `x-e2e-random-id` 请求头。
- `tests/integration/Counter.integ.ts`
  - 使用 Node `randomInt` 生成 1 至 1,000,000 的隔离 ID。
  - 保留 `x-e2e-random-id` 请求头。

### 删除的文件

- 无。

### 修改或删除的函数

- 无。

## 第 17 批：删除 i18n-check

### 修改的文件

- `.github/workflows/CI.yml`
  - 删除国际化完整性检查步骤。
- `AGENTS.md`
  - 从允许的检查脚本列表中删除 `check:i18n`。
- `package.json`
  - 删除 `check:i18n` 脚本和 `@lingual/i18n-check` 开发依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 i18n-check 及其关联依赖。
- `README.md`
  - 删除 i18n-check 功能与命令说明。

### 删除的文件

- 无。

### 修改或删除的函数

- 无。

## 第 18 批：删除 next-intl、locale 路由和翻译文件

### 修改的文件

- `.vscode/extensions.json`
  - 删除 i18n Ally 扩展推荐。
- `.vscode/settings.json`
  - 删除 i18n Ally 配置并更新 App Router 导航导入提示。
- `AGENTS.md`
  - 删除 locale 页面与 next-intl 开发规范。
- `next.config.ts`
  - 删除 next-intl 插件包装。
- `package.json`
  - 删除 `next-intl` 与 `@clerk/localizations` 依赖。
- `package-lock.json`
  - 通过 npm 卸载命令移除 next-intl、Clerk 本地化包及其关联依赖。
- `README.md`
  - 删除多语言功能、翻译配置和 locales 目录说明。
- `src/app/global-error.tsx`
  - 固定错误页文档语言为英文。
- `src/app/sitemap.ts`
  - 删除 locale alternates，只生成普通英文 URL。
- `src/components/CounterForm.tsx`
  - 改用 `next/navigation` 并内联英文表单文案。
- `src/components/CurrentCount.tsx`
  - 内联英文计数文案。
- `src/components/DemoBanner.tsx`
  - 改用 `next/link`。
- `src/components/Hello.tsx`
  - 内联 dashboard 英文文案。
- `src/proxy.ts`
  - 删除 next-intl middleware 和 locale matcher。
  - 保留 Clerk 鉴权并让普通请求直接继续。
- `src/templates/BaseTemplate.tsx`
  - 内联英文布局文案。
- `src/templates/BaseTemplate.test.tsx`
  - 删除 NextIntl provider 和翻译文件包装，保留组件测试。
- `src/utils/AppConfig.ts`
  - 删除 i18n 配置与 Clerk 本地化资源。
- `src/utils/Helpers.ts`
  - 删除 locale 路径生成逻辑，保留基础 URL。
- `tests/e2e/Sanity.e2e.ts`
  - 增加英文登录页、注册页和 `/fr` 返回 404 的回归测试。

### 移动并修改的文件

- `src/app/[locale]/layout.tsx` → `src/app/layout.tsx`
  - 固定 `<html lang="en">`，删除 locale 参数、静态参数和 NextIntl provider。
- `src/app/[locale]/(marketing)/layout.tsx` → `src/app/(marketing)/layout.tsx`
  - 改用普通 Next.js Link 并内联英文导航。
- `src/app/[locale]/(marketing)/page.tsx` → `src/app/(marketing)/page.tsx`
  - 内联英文首页 metadata 与文案。
- `src/app/[locale]/(marketing)/about/page.tsx` → `src/app/(marketing)/about/page.tsx`
  - 内联英文 metadata 与页面文案。
- `src/app/[locale]/(marketing)/counter/page.tsx` → `src/app/(marketing)/counter/page.tsx`
  - 将翻译 metadata 替换为英文静态 metadata。
- `src/app/[locale]/(marketing)/portfolio/page.tsx` → `src/app/(marketing)/portfolio/page.tsx`
  - 改用普通 Next.js Link 并内联英文文案。
- `src/app/[locale]/(marketing)/portfolio/[slug]/page.tsx` → `src/app/(marketing)/portfolio/[slug]/page.tsx`
  - 删除 locale 静态参数并内联英文动态 metadata 与内容。
- `src/app/[locale]/(auth)/layout.tsx` → `src/app/(auth)/layout.tsx`
  - 删除 Clerk 本地化选择，保留认证配置。
- `src/app/[locale]/(auth)/(center)/layout.tsx` → `src/app/(auth)/(center)/layout.tsx`
  - 删除 locale 参数和请求级 locale 设置。
- `src/app/[locale]/(auth)/(center)/sign-in/[[...sign-in]]/page.tsx` → `src/app/(auth)/(center)/sign-in/[[...sign-in]]/page.tsx`
  - 固定英文 metadata 与 `/sign-in` 路径。
- `src/app/[locale]/(auth)/(center)/sign-up/[[...sign-up]]/page.tsx` → `src/app/(auth)/(center)/sign-up/[[...sign-up]]/page.tsx`
  - 固定英文 metadata 与 `/sign-up` 路径。
- `src/app/[locale]/(auth)/dashboard/layout.tsx` → `src/app/(auth)/dashboard/layout.tsx`
  - 改用普通 Next.js Link 并内联英文 metadata 与导航。
- `src/app/[locale]/(auth)/dashboard/page.tsx` → `src/app/(auth)/dashboard/page.tsx`
  - 删除 locale 参数和请求级 locale 设置。
- `src/app/[locale]/(auth)/dashboard/user-profile/[[...user-profile]]/page.tsx` → `src/app/(auth)/dashboard/user-profile/[[...user-profile]]/page.tsx`
  - 固定 Clerk 用户资料路径并删除 locale 参数。

### 删除的文件

- `src/components/LocaleSwitcher.tsx`
- `src/libs/I18n.ts`
- `src/libs/I18nNavigation.ts`
- `src/libs/I18nRouting.ts`
- `src/locales/en.json`
- `src/locales/fr.json`
- `src/types/I18n.ts`
- `src/utils/Helpers.test.ts`
- `tests/e2e/I18n.e2e.ts`

### 修改或删除的函数

- `About`
- `AuthLayout`
- `BaseTemplate`
- `CenteredLayout`
- `CounterForm`
- `CurrentCount`
- `DashboardLayout`
- `DashboardPage`
- `generateMetadata`
- `generateStaticParams`
- `getI18nPath`
- `GlobalError`
- `Hello`
- `Index`
- `Layout`
- `LocaleSwitcher`
- `Portfolio`
- `PortfolioDetail`
- `proxy`
- `RootLayout`
- `SignInPage`
- `SignUpPage`
- `sitemap`
- `UserProfilePage`

## 第 19 批：最终依赖、资源与项目说明清理

### 修改的文件

- `.env`
  - 删除产品推广、外部数据库推广和冗余说明。
  - 保留本地 Clerk、PGlite 与 Next.js 配置。
- `.env.production`
  - 精简为生产站点地址及 Clerk、数据库配置示例。
- `.vscode/launch.json`
  - 调试入口改为 `npm run dev`，统一通过本地运行时启动。
- `AGENTS.md`
  - 将命令清单更新为项目当前可用的 npm 脚本。
- `README.md`
  - 重写为当前技术栈、环境配置、路由、命令和目录结构说明。
- `package.json`
  - 删除未使用的 `@swc/helpers` 直接开发依赖。
- `package-lock.json`
  - 同步依赖锁文件。

### 删除的文件

- `public/assets/images/nextjs-boilerplate-saas.png`
- `public/assets/images/nextjs-boilerplate-sign-in.png`
- `public/assets/images/nextjs-boilerplate-sign-up.png`
- `public/assets/images/nextjs-starter-banner.png`

### 修改或删除的函数

- 无
