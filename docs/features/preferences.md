# 系统偏好设置

状态：Current

本文描述 KnowMesh 当前的用户偏好模型、外观主题机制和全站颜色约束。

## 产品边界

偏好属于 Clerk 用户，不属于任何 Workspace。当前唯一已实现的偏好是外观主题：`浅色`、`深色`、`跟随系统`，默认 `跟随系统`。`/settings/preferences` 在「外观」小节呈现三张主题卡片；点击后立即在本地切换主题并调用 Server Action 持久化，失败时回滚到之前的主题并显示错误信息。

主题对全站生效，包括公开首页、Clerk 登录/注册页、账号设置页和工作区页面。Clerk 组件通过引用同一组 CSS 变量跟随主题。

## 主题解析与防闪烁

主题的持久化真相源是数据库，但根布局渲染时只读取镜像 cookie，避免每次请求查询数据库：

```text
updateThemePreference Server Action
→ auth.protect() 鉴权 + Zod 校验
→ upsert user_preferences
→ 写入 HttpOnly cookie knowmesh-theme（有效期一年）
→ revalidatePath('/', 'layout')

根布局（每个请求）
→ 读取 knowmesh-theme，非法值回退 system
→ <html data-theme="..." class="dark?">
→ <head> 内联脚本在首帧前解析 system → prefers-color-scheme
→ 内联脚本持续监听系统主题变化，跟随系统时实时切换
```

由此产生的边界：根布局读取 cookie，因此所有路由（含公开首页）都是动态渲染；未登录或没有 cookie 的访客按 `跟随系统` 处理。设置页展示的当前值从数据库读取，跨设备一致；cookie 只用于渲染加速，两者短暂不一致时以数据库为准。

## 持久化模型

`user_preferences` 每个用户最多一行：

- `user_id` 保存 Clerk 用户 ID，带唯一索引，既是 upsert 冲突目标也是读取隔离条件。
- `theme` 为 `light`、`dark`、`system` 枚举，默认 `system`。
- Clerk `user.deleted` 清理流程会删除该用户的偏好行。

## 全站颜色约束

颜色语义 token 定义在 `src/styles/global.css`：`:root` 与 `.dark` 各维护一套 CSS 变量，`@theme inline` 将其映射为 Tailwind v4 工具类（`bg-canvas`、`text-ink`、`border-line` 等），并由 `@custom-variant dark` 提供基于类的暗色变体。`<html>` 上的 `dark` 类是唯一主题开关。

不变量：

- 界面组件不得新增硬编码 hex 颜色类；必须使用语义 token，使亮暗两套主题同时生效。
- 少数有意保留的字面颜色：邮件模板（邮件客户端不支持 CSS 变量）、落地页装饰性内容色（浏览器圆点、表情底色）和 Tiptap 代码块底色。
- `.dark` 类只能由根布局（服务端）与主题初始化脚本/乐观切换逻辑（客户端）维护，其他代码不得直接改写。

## 相关代码

- `src/features/preferences/Preferences.ts`：主题枚举、cookie 名和值校验。
- `src/features/preferences/server/GetUserPreferences.ts`：server-only 用户偏好查询。
- `src/features/preferences/server/UpdateThemePreference.ts`：主题偏好 Server Action。
- `src/features/preferences/components/ThemePreferenceSection.tsx`：主题卡片与乐观切换。
- `src/app/layout.tsx`：cookie 读取、`<html>` 主题属性和内联初始化脚本。
- `src/styles/global.css`：颜色 token 体系。

## 相关文档

- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [数据库 Schema 与迁移](../database/schema-and-migrations.md)
- [系统架构概览](../architecture/overview.md)
