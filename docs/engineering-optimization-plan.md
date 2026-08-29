# 工程优化计划

状态：计划中（不是当前实现说明）

本文合并两轮审查中**已用当前仓库核实**的问题，给出优先顺序与可独立合入的实施步骤。事实以工作区代码、CI 和工作流为准；未复跑的指标会标明。

相关当前状态文档：[`architecture/overview.md`](architecture/overview.md)、[`architecture/rendering-and-data-flow.md`](architecture/rendering-and-data-flow.md)、[`features/documents.md`](features/documents.md)、[`operations/deployment.md`](operations/deployment.md)、[`PROBLEMS.md`](PROBLEMS.md)。实现完成后应更新对应 Current 文档，并删除或改写本文中已完成条目。

## 核实结论摘要

| 条目 | 核实 | 说明 |
| --- | --- | --- |
| Toast 导致团队白板 socket 重建并覆盖画布 | **成立，作 P0** | `ToastProvider` 每次 render 新建 context 对象；`TeamWhiteboardEditor` 连接 effect 依赖 `toast`；`baseline` 先 `dispose` 再 `applyScene(baseline.scene)`，不与未入队本地笔迹调和 |
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

## 立即执行（P0）

### 1. 稳定 Toast 调用，避免团队白板重连丢笔

**机制（已核对）**

1. `ToastProvider` 在每次 render 用内联函数组装 `contextValue`（含 `showToast` 闭包）。`toasts` 变化（弹出或 2.8s 后 `setTimeout` 移除）必定重渲染 Provider，消费者拿到**新对象引用**。
2. `TeamWhiteboardEditor` 的连接 `useEffect` 依赖数组包含 `toast`。引用变化即 cleanup：`queue.dispose()` + `socket.disconnect()`，再新建 socket 并 `connect()`。
3. 服务端重发 `baseline` 时无条件 `applyScene(baseline.scene)`。队列已 dispose，本地未成功保存的元素不会进入 `reconcileWhiteboardScenes`。
4. 一次会自动消失的 toast ≈ 两次状态更新（出现 + 移除），即两次断连。工作区任意 toast 都会触发，包括 `RealtimeNotificationProvider` 的站内通知提示（该处已用 `useEffectEvent` 包住 toast，**自身 SSE 不会因 toast 重连**，但仍会驱动 `ToastProvider` 重渲染，从而打到白板）。
5. `showToast` 的 `setTimeout` 无卸载清理。React Compiler 仅生产开启（`next.config.ts`），且无法把「每次 render 新建的 context 对象」稳定成依赖。

**改法**

- `ToastProvider`：用 `useState` 存列表；`showToast` / `removeToast` 用稳定函数（`useEffectEvent`，或 ref 保存最新 setter）。Context value 只在方法身份稳定时创建一次，或拆成「方法 context」与「列表仅给 viewport」避免方法随列表变。
- 卸载时 `clearTimeout` 所有未触发的移除定时器。
- `TeamWhiteboardEditor`：toast 调用移出连接 effect 依赖（`useEffectEvent`），与 `RealtimeNotificationContext` 同一模式。
- 保持 `useToast()` 在无 Provider 时返回 no-op。

**验证：** 打开 Team 白板作未保存笔迹 → 触发任意 toast（含通知）→ 画布不得被 baseline 抹掉、Network 不得因 toast 反复建 websocket。跑现有白板相关 e2e/integ。

**不要做：** 把 `baseline` 改成永远 merge（那是另一条产品语义）；本项只消除**误触发的**重连。

---

## 优先队列（按合入顺序）

下列编号是实施顺序，不是原审查编号。

### 批次 A — 低风险、无产品语义（可与 P0 并行除白板手动验）

**A1. CI 收紧（原 P1-1）**

- deploy 相关主机、用户、路径、指纹：**禁止**仓库字面量回退；vars/secrets 缺失则失败。
- 从 push 触发去掉 `feature/permissions`。
- `environment: production` 只保留在 `deploy` job；`build` / `Release.yml` 构建不要挂 production environment（构建所需 `BETTER_AUTH_SECRET` 用 job 级 secrets，不必整个 environment）。
- `Release.yml` 与 CI deploy 对齐 `NEXT_PUBLIC_WHITEBOARD_*`（此前审查已确认漂移）。
- `workflow_dispatch` 部署范围：仅允许 `main`，或显式确认，避免任意分支覆盖生产。

不要把真实主机、指纹写入知识库正文。

**A2. 独立 `tsc`（原 P1-5）**

- CI static job 增加 `npm run check:types`（或 `tsc --noEmit`）。本地仍用 lefthook + ultracite。

**A3. `npm run build` 与迁移解耦（原 P1-2）**

- 默认 `build` 只跑 `build:next`（或改名为避免误用）。
- 需要「迁移 + 构建」的本地脚本单独命名，并在 `AGENTS.md` / README 标明。
- 可选：`db:migrate` 在 `NODE_ENV=production` 且未设显式允许变量时拒绝。生产激活仍以 `deploy/scripts/activate-release.sh` 为准（迁移前校验回滚目标，见 deployment 手册）。

**A4. `.gitignore` 增加 `.tmp/`（原 P2-9 中可立即做的部分）**

- 不提交损坏的本地库目录。不把已有损坏目录的内容写进文档。

**A5. 授权与会话测试补洞（修正后的原 P1-4）**

- **不要**再为 `PermissionPolicy` 加一套重复单测。
- 扩展 `tests/authorization-queries.integ.ts`：Personal Workspace；文档属于项目 A、用户仅在项目 B；不存在的 id。
- 为 `isSessionActive` 补 PGlite/integ：未过期已验证、过期、邮箱未验证、session/user 不匹配。
- 维持现有 per-file 门槛策略；不为全仓虚荣覆盖率设 70%。可考虑给 `SessionAuthorization.ts` 加一条低门槛（有测试即可）。

### 批次 B — 已确认性能 / 交互（P0 之后）

**B1. 侧边栏拖宽不打进 React state（原 P1-3 第一刀）**

- pointermove 只写 `--app-sidebar-width`（可 rAF 节流）；pointerup 或双击再 `setState` 以便键盘与持久化（若当前未持久化宽度，可仅 CSS）。
- 守住：不引入全局状态库。

**B2. 字体按路由加载**

- 根 layout 不再同步三套 Fontsource。落地页 / 认证以拉丁为主；工作区 layout 再加载 Noto Sans SC 与 JetBrains Mono。
- 落地页 `font-family` 字符串与实际加载一致。
- 验证：未登录 `/` 的 Network 不再拉 CJK 大包；工作区中文与代码块正常。

**B3. 编辑器二次 `dynamic`**

- `DocumentEditorDispatcher` 对单人 Tiptap、协作 Tiptap、白板分别 `import()`。
- `build:next` 确认 Personal 文档 chunk 不含 Hocuspocus 客户端。
- 回归 Personal 保存、Team 协同、白板、Strict Mode 进退文档。

### 批次 C — 失效面（需改测试预期）

写入仍大量 `revalidatePath('/(workspace)', 'layout')`，与 ADR 0015「文档树局部刷新、仅项目列表变化才失效 layout」错位。layout 实际只拉项目列表（`getWorkspaceNavigation`），但 Client `AppShell` 会随 layout 刷新重挂。

| 写入 | 建议 |
| --- | --- |
| 主题 / 内容宽度 | 去掉 workspace/根 layout 失效；cookie + 客户端已够 |
| 文档标题、创建/删除/移动 | 去掉 layout 失效；侧边栏对受影响父节点 `getDocumentNavigationChildren` |
| 项目与 Workspace 创建/更新/删除/切换 | **继续**失效 layout |
| 成员/邀请/转让 | 默认继续失效 layout（可见项目集合会变）；不要第一轮全删 |

同步修改断言 `revalidatePath('/(workspace)')` 的单元测试。跑文档树与标题实时 integ。

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
第 0 天     P0 Toast + 白板 effect（可热修单独 PR）
第 0–1 天   批次 A（CI、tsc、build/迁移、gitignore、授权/会话测试）
第 1–3 天   批次 B（拖宽、字体、编辑器 chunk）
第 3–5 天   批次 C（revalidatePath，分 3a 偏好 / 3b 文档树 / 3c 成员）
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
