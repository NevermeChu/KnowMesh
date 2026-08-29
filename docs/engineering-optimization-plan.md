# 工程优化计划

状态：实施中（P0 已完成；其余条目仍是计划，不是当前实现说明）

本文合并两轮审查中**已用当前仓库核实**的问题，给出优先顺序与可独立合入的实施步骤。事实以工作区代码、CI 和工作流为准；未复跑的指标会标明。

相关当前状态文档：[`architecture/overview.md`](architecture/overview.md)、[`architecture/rendering-and-data-flow.md`](architecture/rendering-and-data-flow.md)、[`features/documents.md`](features/documents.md)、[`operations/deployment.md`](operations/deployment.md)、[`PROBLEMS.md`](PROBLEMS.md)。实现完成后应更新对应 Current 文档，并删除或改写本文中已完成条目。

## 核实结论摘要

| 条目 | 核实 | 说明 |
| --- | --- | --- |
| Toast 导致团队白板 socket 重建并覆盖画布 | **已修复（P0）** | `ToastProvider` 现在提供稳定分发器并清理定时器；`TeamWhiteboardEditor` 通过 Effect Event 调用提示，连接 effect 不再依赖 `toast` |
| CI 生产主机回退值、陈旧分支、`build` job 挂 production environment | **成立** | 见 `.github/workflows/CI.yml` |
| `npm run build` 先迁移再构建 | **成立** | `package.json` 的 `build` 为 `db:migrate` + `build:next` |
| 拖宽触发整 Shell `setState` | **结构成立** | `onPointerMove` → `onResize` → `AppShell` state；卡顿程度未用 Profiler 量化 |
| 导航文档提升到 `AppShell` | **结构成立** | `notifyDocumentsChange` → `setNavigationDocuments` |
| 每项目 `buildDocumentTree`、每次 render 重建 sections | **结构成立** | 开发态无 React Compiler；生产有编译器，体感需 Profiler |
| 授权三件套完全无测试 | **不准确** | `tests/authorization-queries.integ.ts` 已覆盖 Team join 与 workspace-only 无正文；缺 Personal 等缺口；`PermissionPolicy` 已有 100% 单测门槛 |
| `isSessionActive` 无专项测试 | **成立** | 仅通知路由测试中 mock；`DocumentCollaborationAuthorization` 真实调用 |
| CI 无独立 `tsc` | **成立** | static job 为 `next typegen` + `ultracite --type-check` |
| `removeWorkspaceMember` 按项目循环三次 DELETE | **成立** | 小工作区可忽略 |
| `authorizeWorkspace` 未 `cache()` | **成立** | 与 `getCachedProjectAuthorization` 不一致 |
| 白板队列双 `JSON.stringify` | **结构成立** | 大场景代价未 profile |
| 落地页 `getCurrentUser` + 交互组件进首屏 | **结构成立** | Lighthouse 未跑 |
| PGlite 迁移文件名手写 | **成立** | `tests/helpers/PGliteMigrations.ts` 与 `migrations/meta/_journal.json` 双源 |
| 真库 integ 仅 E2E | **成立** | 见 PROBLEMS 中 PGlite 与 LISTEN 的记录 |
| Excalidraw / React 19 peer、`npm audit` | **部分** | 依赖版本可查；本次未跑官方 registry audit |
| 备份/空机引导/防火墙 | **成立** | 已在 PROBLEMS #37–#39，本文不重复展开 |
| `.tmp/` 未进 `.gitignore` | **成立** | `*.db` 不覆盖名为 `*.db` 的目录；`.tmp/` 未列出 |

全仓 coverage 百分比（例如 32% / 23.9%）本次**未重跑** `vitest --coverage`，不以该数字作为门槛依据。

## 原则

- 一次只合入一类问题，可回滚。
- 不把计划写成已实现；不引入 `revalidateTag` 或全局客户端状态库。
- 不合并 Yjs 与白板协议。
- 文档树展示仍以侧边栏局部 hook 为准，不把导航抬进新的全局 store。
- 引用稳定路径与符号名，不把易变行号当作长期依据。

---

## 已完成（P0）

### 1. 稳定 Toast 调用，避免团队白板重连丢笔（2026-08-29）

`ToastProvider` 的 context 分发器现在只创建一次，无 Provider 时的 no-op 对象也保持稳定；每个自动移除定时器都被跟踪，手动关闭或 Provider 卸载时会清理。`TeamWhiteboardEditor` 通过 `useEffectEvent` 读取最新 toast 分发器，socket 连接 effect 只依赖协作开关、编辑权限与文档 ID。服务端 `baseline` 语义未改变。

本地验证已通过完整 lint、`check:types`、`build:next`、6 个白板单元测试文件（21 个测试），以及团队白板 Chromium E2E（6 个场景）。新增浏览器回归场景覆盖 toast 出现和自动消失，确认期间只建立一条白板 websocket 且同步状态保持正常。

---

## 优先队列（按合入顺序）

下列编号是实施顺序，不是原审查编号。

### 已完成：批次 A — 低风险、无产品语义（2026-08-29）

**A1. CI 收紧（原 P1-1）：已完成。** push 仅监听 `main`；手动 CI 仅在 `main` 部署。production environment 只挂在 deploy job，普通构建读取 repository Secret。部署主机、用户、路径、服务名和可信指纹全部来自 GitHub 配置，缺失时在构建、SSH 或迁移前失败。`Release.yml` 已对齐白板公开构建变量，仓库与文档不再保存真实主机或指纹。

**A2. 独立 `tsc`（原 P1-5）：已完成。** static job 依次执行 Next 类型生成、`npm run check:types` 和 lint。

**A3. `npm run build` 与迁移解耦（原 P1-2）：已完成。** 默认 `build` 只调用 `build:next`；现有 `build-local` 保留“临时 PGlite + 迁移 + 构建”语义并已在 README/AGENTS 标明。生产迁移仍只由 release 激活流程执行。

**A4. `.gitignore` 增加 `.tmp/`（原 P2-9 中可立即做的部分）：已完成。** 根目录 `/.tmp/` 已忽略；未读取或提交其中内容。

**A5. 授权与会话测试补洞（修正后的原 P1-4）：已完成。** PGlite 授权集成测试现覆盖 Personal Workspace/Project/Document、跨项目正文隔离及不存在 ID；新增 Session 授权集成测试覆盖有效、过期、邮箱未验证及 session/user 不匹配。未重复扩张 `PermissionPolicy` 单测或设置全仓覆盖率门槛。

批次 A 本地验证：workflow YAML 可解析，配置中无生产主机/指纹回退；授权与 Session 集成测试 20/20、lint、`check:types` 和默认 `npm run build` 均通过。

### 批次 B — 已确认性能 / 交互（P0 之后）

**B1. 侧边栏拖宽不打进 React state（原 P1-3 第一刀）：已完成。**

- pointermove 只写 `--app-sidebar-width`（可 rAF 节流）；pointerup 或双击再 `setState` 以便键盘与持久化（若当前未持久化宽度，可仅 CSS）。
- 守住：不引入全局状态库。

验证：Chromium 回归覆盖拖动期间 CSS 变量预览、`pointerup` 提交、键盘步进与双击复位；类型检查通过。

**B2. 字体按路由加载：已完成。**

- 根 layout 不再同步三套 Fontsource。落地页 / 认证以拉丁为主；工作区 layout 再加载 Noto Sans SC 与 JetBrains Mono。
- 落地页 `font-family` 字符串与实际加载一致。
- 验证：未登录 `/` 的 Network 不再拉 CJK 大包；工作区中文与代码块正常。

生产构建验证：未登录 `/` 只引用公共字体 CSS，不引用工作区字体 CSS；工作区路由同时引用两者。Noto Sans SC 与 JetBrains Mono 的 107 个字体文件（约 4.6 MB）已退出公开路由资源图。

**B3. 编辑器二次 `dynamic`：已完成。**

- `DocumentEditorDispatcher` 对单人 Tiptap、协作 Tiptap、白板分别 `import()`。
- `build:next` 确认 Personal 文档 chunk 不含 Hocuspocus 客户端。
- 回归 Personal 保存、Team 协同、白板、Strict Mode 进退文档。

生产构建验证：分发层约 9.9 KB，Personal 编辑器约 12.5 KB 且不含 Hocuspocus/Excalidraw，协作实现独立为约 174 KB chunk。Chromium 回归覆盖 Personal 自动保存与离开时刷新、Team 富文本双会话同步和 Team 白板双会话同步。

批次 B 本地验证：lint、`check:types`、`build:next` 通过；上述 5 条 Chromium 回归全部通过。

### 批次 C — 失效面（需改测试预期）

写入仍大量 `revalidatePath('/(workspace)', 'layout')`，与 ADR 0015「文档树局部刷新、仅项目列表变化才失效 layout」错位。layout 实际只拉项目列表（`getWorkspaceNavigation`），但 Client `AppShell` 会随 layout 刷新重挂。

| 写入 | 建议 |
| --- | --- |
| 主题 / 内容宽度 | 去掉 workspace/根 layout 失效；cookie + 客户端已够 |
| 文档标题、创建/删除/移动 | 去掉 layout 失效；侧边栏对受影响父节点 `getDocumentNavigationChildren` |
| 项目与 Workspace 创建/更新/删除/切换 | **继续**失效 layout |
| 成员/邀请/转让 | 默认继续失效 layout（可见项目集合会变）；不要第一轮全删 |

同步修改断言 `revalidatePath('/(workspace)')` 的单元测试。跑文档树与标题实时 integ。

**C1. 偏好失效面：已完成。** 主题与内容宽度 Server Action 不再失效根 layout 或工作区 layout；Chromium 回归验证两项偏好即时生效、活动编辑器 DOM 保持、cookie 持久化及刷新恢复。

**C2. 文档树失效面：已完成。** 标题、创建、删除与移动不再失效工作区 layout；创建后的选中路径加载父节点，标题与删除通过客户端事件刷新原父节点，移动刷新来源与目标父节点。文档写入单测与真实迁移 PGlite 导航测试 26/26 通过；Chromium 覆盖标题局部刷新、删除局部刷新、拖拽移动和新建白板后导航/编辑。

### 批次 D — 中期（有重复写入或有数据再做）

- 导航文档列表从 `AppShell` 下移到 `ContentToolbar` 的直接父级或侧边栏内部，避免分页 merge 重绘 CommandPalette；用 Profiler 确认后再动。
- `buildDocumentTree` / `workspaceSections`：仅在确认 dev 卡顿后，按 `documents` 引用记忆化；生产 Compiler 可能已足够。
- 协作 process kit（限额、复查循环、健康 HTTP），**不**合并协议。
- `removeWorkspaceMember`：对申请/邀请/成员三表 `inArray(projectId)` 批量删。
- `getWorkspaceAuthorization` 对齐 `cache()`。
- PGlite 迁移列表改读 `_journal.json`。
- 白板 `enqueue` / `receiveCanonical` 的 stringify：大场景 profile 后再改版本号/脏标记。
- 落地页 Lighthouse 后再决定交互块 `dynamic` 与是否把 `getCurrentUser` 限制在 Header。
- CI 复用 e2e 的 Postgres 服务跑选定 integ（LISTEN / 租约），不替代 PGlite 快测。
- Excalidraw 升级窗口；官方 registry `npm audit` 建基线。
- PROBLEMS #37–#39：备份演练、防火墙、空机引导（运维，不阻塞应用 PR）。

---

## 建议日历

```text
已完成       P0 Toast + 白板 effect
已完成       批次 A（CI、tsc、build/迁移、gitignore、授权/会话测试）
已完成       批次 B（拖宽、字体、编辑器 chunk）
下一步       批次 C（revalidatePath，分 3a 偏好 / 3b 文档树 / 3c 成员）
其后        批次 D
```

P0 未合入前，Team 白板协作中任意 toast（含通知）都可能丢掉未保存笔迹，应避免在该页长时间依赖 toast 反馈，或暂时关闭通知 toast（权宜，不是修复）。

## 明确不做

- 全仓覆盖率 70%。
- 把 Hocuspocus 并进 Next。
- 通用成员管理引擎。
- 为 chunk 手写复杂 splitChunks。
- 未 profile 就改白板 stringify 或落地页大拆包。

## 相关代码

- `src/components/ui/Toast.tsx`、`src/features/whiteboards/components/TeamWhiteboardEditor.tsx`
- `src/features/notifications/context/RealtimeNotificationContext.tsx`
- `src/components/layout/AppShell.tsx`、`AppSidebar`、`useSidebarDocumentNavigation.ts`
- `src/app/layout.tsx`、`src/features/documents/components/DocumentEditorDispatcher.tsx`
- `.github/workflows/CI.yml`、`package.json`、`vitest.config.ts`
- `src/features/permissions/server/*Authorization.ts`、`src/features/auth/server/SessionAuthorization.ts`
- `tests/authorization-queries.integ.ts`
- [`adr/0015-lazy-load-document-navigation.md`](adr/0015-lazy-load-document-navigation.md)
