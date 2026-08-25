# ADR 0013：页面使用请求级 nonce 执行严格脚本 CSP

- 状态：Accepted
- 日期：2026-08-25

## 背景

根布局包含首帧主题初始化脚本，Next.js App Router 也会生成框架内联脚本。只在 `next.config.ts` 配置允许 `unsafe-inline` 的 CSP 不能阻止脚本注入；哈希与 Subresource Integrity 方案当前依赖实验性的 webpack 构建能力。请求级 nonce 是 Next.js 当前稳定支持的严格脚本策略，但会让页面改为按请求动态渲染。

## 决策

- `src/proxy.ts` 为每个页面请求生成不可预测 nonce，把同一 CSP 写入上游请求头和响应头。
- `script-src` 只允许同源、当前 nonce 与 `strict-dynamic`；开发环境额外允许 React 调试需要的 `unsafe-eval`。
- Next.js 从请求 CSP 自动提取 nonce，并把它应用到框架脚本和根布局主题脚本；应用组件不重复传递 nonce，避免浏览器隐藏 nonce 属性后产生 hydration 属性差异。
- 现有 React `style` 属性仍需要 `style-src 'unsafe-inline'`；字体通过 Fontsource 依赖随应用同源发布，样式与字体策略不开放外部来源，脚本策略也不因此放宽。
- `/api` 继续由 Route Handler 自身处理身份、内容类型和缓存边界，不经过页面 CSP matcher。

## 原因

KnowMesh 的认证工作区和协作编辑器处理敏感用户内容，阻止未授权内联脚本比公开页 CDN 静态缓存更重要。稳定 nonce 机制也避免把生产构建切换到实验性 SRI/webpack 路径。

## 后果

- 页面需要按请求动态渲染，不能依赖普通静态 HTML 或 CDN 页面缓存；根布局读取主题 cookie 不再是这一结果的唯一原因。
- 新增外部脚本、连接目标、字体或图片来源时必须显式审查并更新 CSP；字体升级通过锁文件固定的 Fontsource 包完成，不能恢复运行时 Google Fonts 外链或临时加入宽泛 HTTPS 来源。
- 如果未来必须恢复公开页静态化，应新增 ADR，评估独立路由边界或成熟的构建期 SRI，而不是删除 CSP。

## 相关代码和文档

- `src/proxy.ts`
- `src/app/layout.tsx`
- [渲染与数据流](../architecture/rendering-and-data-flow.md)
- [系统偏好](../features/preferences.md)
