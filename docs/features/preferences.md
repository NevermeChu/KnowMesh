# 系统偏好设置

状态：Current

本文描述 KnowMesh 当前的用户偏好模型、外观主题机制、内容宽度与全站颜色约束。

## 产品边界

偏好属于 Better Auth 用户，不属于任何 Workspace。已实现的偏好：

- **外观主题**：`浅色`、`深色`、`跟随系统`，默认 `跟随系统`。`/settings/preferences` 在「外观」小节呈现三张主题卡片；点击后立即在本地切换主题并调用 Server Action 持久化，失败时回滚到之前的主题并显示错误信息。侧边栏底部另有一个明暗快捷切换按钮，在浅色与深色之间翻转并写入同一偏好。
- **内容宽度**：工作区阅读内容的容器宽度，可选 `60%`、`70%`、`80%`、`90%`，默认 `80%`，步长 10%。`ContentToolbar` 全屏按钮左侧的下拉显示当前百分比，选中即时应用、乐观更新并持久化，失败回滚。`WorkspaceContent` 组件消费根布局注入的 `--content-read-width` CSS 变量统一各页面内容宽度；移动端始终全宽。打开白板文档时该下拉隐藏，因为白板不使用 `WorkspaceContent`，画布铺满文档区。

主题对全站生效，包括公开首页、登录/注册页、账号设置页和工作区页面。

## 主题解析与防闪烁

主题的持久化真相源是数据库，但根布局渲染时只读取镜像 cookie，避免每次请求查询数据库：

```text
updateThemePreference Server Action
→ requireUser() 鉴权 + Zod 校验
→ upsert user_preferences
→ 写入 HttpOnly cookie knowmesh-theme（有效期一年）
→ 不失效布局；客户端已即时应用，后续请求由 cookie 恢复

根布局（每个请求）
→ 读取 knowmesh-theme，非法值回退 system
→ <html data-theme="..." class="dark?">
→ <head> 带请求级 CSP nonce 的脚本在首帧前解析 system → prefers-color-scheme
→ 根布局加载 Plus Jakarta Sans；工作区布局再加载 Noto Sans SC 与 JetBrains Mono
→ 内联脚本持续监听系统主题变化，跟随系统时实时切换
```

由此产生的边界：页面使用请求级 CSP nonce，因此所有页面路由（含公开首页）按请求动态渲染；根布局同时读取 cookie，未登录或没有 cookie 的访客按 `跟随系统` 处理。设置页展示的当前值从数据库读取，跨设备一致；cookie 只用于渲染加速，两者短暂不一致时以数据库为准。

## 持久化模型

`user_preferences` 每个用户最多一行：

- `user_id` 保存 Better Auth 用户 ID，带唯一索引，既是 upsert 冲突目标也是读取隔离条件。
- `theme` 为 `light`、`dark`、`system` 枚举，默认 `system`。
- `content_width` 为整数，取值 `60/70/80/90`，默认 `80`；读取侧用 `parseContentWidth`/`resolveContentWidth` 收窄为字面量类型，越界值回退默认。
- Better Auth 删除账户前的业务清理流程会删除该用户的偏好行。

## 全站颜色约束

颜色语义 token 定义在 `src/styles/global.css`：`:root` 与 `.dark` 各维护一套 CSS 变量，`@theme inline` 将其映射为 Tailwind v4 工具类（`bg-canvas`、`text-ink`、`border-line` 等），并由 `@custom-variant dark` 提供基于类的暗色变体。`<html>` 上的 `dark` 类是唯一主题开关。

不变量：

- 界面组件不得新增硬编码 hex 颜色类；必须使用语义 token，使亮暗两套主题同时生效。
- 少数有意保留的字面颜色：邮件模板（邮件客户端不支持 CSS 变量）、落地页装饰性内容色（浏览器圆点、表情底色）和 Tiptap 代码块底色。
- `.dark` 类只能由根布局（服务端）与主题初始化脚本/乐观切换逻辑（客户端）维护，其他代码不得直接改写。

## 相关代码

- `src/features/preferences/Preferences.ts`：主题与内容宽度枚举、cookie 名、默认值与值校验/解析。
- `src/features/preferences/server/GetUserPreferences.ts`：server-only 用户偏好查询。
- `src/features/preferences/server/UpdateThemePreference.ts`：主题偏好 Server Action。
- `src/features/preferences/server/UpdateContentWidth.ts`：内容宽度偏好 Server Action。
- `src/features/preferences/components/ThemePreferenceSection.tsx`：主题卡片与乐观切换。
- `src/components/layout/WorkspaceContent.tsx`：消费 `--content-read-width` 的共享内容容器。
- `src/components/layout/ContentToolbar.tsx`：内容宽度下拉与乐观切换。
- `src/app/layout.tsx`：公共 Plus Jakarta Sans 字体入口、cookie 读取、`<html>` 主题属性、`--content-read-width` 内联与主题初始化脚本；工作区字体入口位于 `src/app/(workspace)/layout.tsx`，脚本 nonce 由 Next.js 从请求 CSP 自动应用。
- `src/styles/global.css`：颜色 token 体系与 `--content-read-width` 默认值。

## 相关文档

- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库 Schema 与迁移](../database/schema-and-migrations.md)
- [系统架构概览](../architecture/overview.md)
