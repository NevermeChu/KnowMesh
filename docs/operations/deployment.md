# 生产部署

本文描述 KnowMesh 当前的生产构建、迁移、发布与应用回滚边界。生产部署由 `.github/workflows/CI.yml` 执行，服务器工作树不参与产物构建。

## 运行边界

- 生产环境运行在 Ubuntu x86-64，Node.js 24，由 `knowmesh.service` 管理。
- Nginx 将公网 HTTPS 请求反向代理到 `127.0.0.1:3000`。
- standalone release 位于 `/srv/knowmesh-app/releases/<GITHUB_SHA>`，`/srv/knowmesh-app/current` 原子指向当前版本。
- `/etc/knowmesh.env` 只保留在服务器，workflow 和 release 均不得复制或输出其中内容。
- `/etc/knowmesh.env` 必须包含 Clerk endpoint 对应的 `CLERK_WEBHOOK_SIGNING_SECRET`；Clerk Dashboard 必须将生产 `/api/webhooks/clerk` 订阅到 `user.created` 和 `user.deleted`。
- `HOSTNAME` 必须保持为 `localhost`，`PORT` 必须保持为 `3000`。

## 自动部署流程

`main` 分支 push 会先执行 build、static、unit 和 e2e。只有四个 job 全部成功，deploy job 才会继续。项目正式开放前，临时允许 `feature/permissions` push 通过相同检查后部署到当前 `thisme.icu` 服务；该规则不会合并或修改 `main`，功能开发完成后应删除：

CI workflow 中的 `DATABASE_URL` 只连接 runner 内由本地运行器启动的临时 PGlite，用于迁移、构建和测试，不是生产数据库地址。部署后的应用仍从服务器 `/etc/knowmesh.env` 读取真实生产连接。

1. 从确定的 `GITHUB_SHA` 检出源码并构建 Next.js standalone。
2. 将 `public`、`.next/static`、`migrations` 和自包含的 `migrate-production.cjs` 放入 release 根目录。
3. 上传压缩包前通过预置的 ED25519 指纹验证生产主机；SSH 禁止绕过 host key 检查。
4. 在服务器的 staging 目录解压和校验，然后以 `GITHUB_SHA` 命名不可变 release。
5. 迁移程序读取 `/etc/knowmesh.env`，对生产 PostgreSQL 执行已提交的 Drizzle migrations。
6. 记录旧 release，使用临时软链接和 `mv -Tf` 原子切换 `current`，再重启 systemd 服务。
7. 依次验证服务器本地根路径和公网 HTTPS 根路径。失败时恢复旧应用软链接并重启服务。

手动 `Release` workflow 只生成保留 14 天的 production artifact，不会部署服务器。它用于审计、下载或人工恢复。

部署功能分支会覆盖 `thisme.icu` 当前运行的应用，并对同一个生产数据库执行该分支包含的迁移。之后再次 push `main`，原有自动部署仍会照常运行并切回 `main` 的最新版本。由于应用回滚不会逆转数据库 schema，功能分支迁移必须保持与当前 `main` 版本兼容。

## 数据库迁移与回滚

迁移发生在应用软链接切换之前。迁移失败时当前应用保持不变；迁移成功后，健康检查失败只会回滚应用代码，不会逆转数据库 schema。

所有生产迁移必须保持新旧应用版本同时可用。破坏性变更使用 expand/contract：先增加兼容结构并部署读写兼容代码，确认旧版本不再使用旧结构后，再在后续 release 删除旧结构。不能依赖自动 down migration 恢复生产数据。

## GitHub 配置

production environment 必须提供：

- Secret `PRODUCTION_SSH_PRIVATE_KEY`：与服务器授权公钥匹配的专用部署私钥。
- Secret `PRODUCTION_CLERK_PUBLISHABLE_KEY`：生产 Clerk publishable key。
- Variable `PRODUCTION_APP_URL`：生产公网地址。

部署私钥不得复用个人管理密钥。服务器 sudoers 应限制部署身份只能管理 release 目录和 `knowmesh.service`；当前宽泛的 sudo 权限属于待收紧的运维风险。

## 相关实现

- `.github/workflows/CI.yml`
- `.github/workflows/Release.yml`
- `scripts/migrate-production.ts`
- `next.config.ts`
- `docs/database/schema-and-migrations.md`
