# KnowMesh (知序)

KnowMesh 是一个现代化的团队知识工作空间，提供文档协同、项目沉淀、权限管控与高效检索能力，帮助团队将零散信息沉淀为可持续使用的共同知识。

---

## 🌟 核心特性

- **工作空间与多租户**：内置个人空间与团队空间（Team Workspace），支持灵活切换与成员邀请。
- **项目与文档管理**：以项目划分边界，支持树状文档组织、收藏与最近访问。
- **富文本编辑**：基于 Tiptap (ProseMirror JSON) 构建的沉浸式富文本编辑器，支持自动保存。
- **权限与审计**：细粒度角色控制（Owner / Admin / Member / Viewer），支持所有权转移与安全审计日志。
- **快速全局检索**：支持命令面板（`Ctrl/Cmd + K`）与全文检索，自动隔离无权限内容。
- **通知与个性化**：站内实时通知系统，支持亮暗主题与内容宽度个性化偏好。

---

## 🛠️ 技术栈

- **框架**：[Next.js 16](https://nextjs.org/) (App Router, Server Components & Actions) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **样式**：[Tailwind CSS v4](https://tailwindcss.com/) + [Lucide React](https://lucide.dev/)
- **认证**：[Better Auth](https://better-auth.com/)
- **数据库 & ORM**：[PostgreSQL](https://www.postgresql.org/) / [PGlite](https://pglite.dev/) (本地无依赖运行) + [Drizzle ORM](https://orm.drizzle.team/)
- **质量保障**：[Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) + [Ultracite](https://github.com/ultracite/ultracite) / [Oxlint](https://oxc.rs/)

---

## 🚀 快速开始

### 1. 环境准备

- **Node.js**: `>= 24`
- **包管理器**: `npm`

### 2. 安装与配置

```bash
# 克隆仓库并安装依赖
git clone <repo-url>
cd knowmesh
npm install

# 复制环境变量配置
cp .env.example .env.local
```

> **说明**：本地开发默认使用嵌入式 PGlite 数据库，无需单独安装或运行外部 PostgreSQL 服务。

### 3. 启动开发服务器

```bash
npm run dev
```

启动后访问 [http://localhost:3000](http://localhost:3000) 即可体验。

---

## 📜 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 启动本地开发环境（自动拉起 PGlite、运行数据库迁移并启动 Next.js） |
| `npm run dev:next` | 仅启动 Next.js 开发服务器（需数据库已就绪） |
| `npm run build` | 仅构建 Next.js 生产包，不修改数据库 |
| `npm run build-local` | 启动临时 PGlite、执行迁移并验证本地生产构建 |
| `npm run start` | 启动生产服务 |
| `npm run test` | 运行单元测试与集成测试 |
| `npm run test:e2e` | 运行 Playwright 端到端测试 |
| `npm run lint` | 代码风格与 Lint 检查 |
| `npm run check:types` | 执行 TypeScript 类型检查 |
| `npm run db:studio` | 打开 Drizzle Studio 数据库可视化管理面板 |

---

## 📁 目录结构概览

```text
src/
├── app/          # Next.js App Router 路由与页面
├── components/   # 通用 UI 组件与全局外壳布局 (AppShell, AppSidebar 等)
├── features/     # 按业务领域内聚的功能模块 (auth, documents, projects, permissions 等)
├── libs/         # 数据库连接、环境变量校验与第三方服务配置
├── models/       # Drizzle ORM 数据模型 (Schema)
└── styles/       # 全局样式与 Tailwind 配置
docs/             # 系统架构、业务设计与 ADR 决策记录
```

---

## 📚 详细文档

更多详细的系统架构、数据流设计与开发规范，请参阅 [docs/README.md](docs/README.md)。
