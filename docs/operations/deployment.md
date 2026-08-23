# 生产部署

本文描述 KnowMesh 当前的生产构建、迁移、发布与应用回滚边界。生产部署由 `.github/workflows/CI.yml` 执行，服务器工作树不参与产物构建。

## 运行边界

- 生产环境运行在 Ubuntu x86-64，Node.js 24；Next.js 由 `knowmesh.service` 管理，单实例 Hocuspocus 由 `knowmesh-collaboration.service` 管理。
- Nginx 将公网 HTTPS 请求反向代理到 `127.0.0.1:3000`，将同源 `/collaboration-ws` WSS 转发到 `127.0.0.1:1234`。协作健康端口 `127.0.0.1:1235` 只允许服务器和部署脚本访问。
- standalone release 位于 `/srv/knowmesh-app/releases/<GITHUB_SHA>`，`/srv/knowmesh-app/current` 原子指向当前版本。
- `/etc/knowmesh.env` 只保留在服务器，workflow 和 release 均不得复制或输出其中内容。
- `/etc/knowmesh.env` 必须包含至少 32 字符的高熵 `BETTER_AUTH_SECRET`、生产 `NEXT_PUBLIC_APP_URL`、数据库和 Resend 邮件配置。协作启用时还必须包含 `COLLABORATION_ENABLED=true`、loopback 地址、WebSocket 与健康端口；生产环境不再需要认证 Webhook。
- `NEXT_PUBLIC_COLLABORATION_URL` 是构建期客户端配置，由 GitHub production environment 注入 `wss://thisme.icu/collaboration-ws`；只修改服务器运行时环境不会改变已经构建的浏览器代码。
- `HOSTNAME` 必须保持为 `localhost`，`PORT` 必须保持为 `3000`。

## 自动部署流程

`main` 分支 push 会先执行 build、static、unit 和 e2e。只有四个 job 全部成功，deploy job 才会继续。项目正式开放前，临时允许 `feature/permissions` push 通过相同检查后部署到当前 `thisme.icu` 服务；该规则不会合并或修改 `main`，功能开发完成后应删除：

CI workflow 的 build 和默认测试继续使用 runner 内由本地运行器启动的临时 PGlite；E2E job 使用独立 PostgreSQL service，并以 `E2E_REAL_POSTGRES=true` 阻止运行器再次启动 PGlite，从而覆盖跨连接通知、协作权限失效和 Session 撤销。两者都不是生产数据库地址；部署后的应用仍从服务器 `/etc/knowmesh.env` 读取真实生产连接。

1. 从确定的 `GITHUB_SHA` 检出源码并构建 Next.js standalone。
2. 将 `public`、`.next/static`、`migrations`、部署模板、自包含的 `migrate-production.cjs` 和 `collaboration-server.cjs` 放入 release 根目录；应用与协作进程因此来自同一 Git SHA。
3. 上传压缩包前通过预置的 ED25519 指纹验证生产主机；SSH 禁止绕过 host key 检查。
4. 在服务器的 staging 目录解压和校验，然后以 `GITHUB_SHA` 命名不可变 release。
5. 迁移程序读取 `/etc/knowmesh.env`，对生产 PostgreSQL 执行已提交的 Drizzle migrations。
6. 记录旧 release，使用临时软链接和 `mv -Tf` 原子切换 `current`。协作部署开关开启时先重启 Hocuspocus 并等待 `/ready`，再重启 Next.js。
7. 依次验证服务器本地协作 readiness、本地应用根路径、公网 HTTPS 根路径和公网 WSS Upgrade。任一步失败都恢复旧软链接并重启两个服务。

`PRODUCTION_COLLABORATION_ENABLED` 是部署层保护开关，必须与服务器 `/etc/knowmesh.env` 中的 `COLLABORATION_ENABLED` 一致。首次安装 systemd 与 Nginx 前保持两者为 `false`；不一致时部署在迁移和软链接切换前失败，避免应用进入有编辑入口但无协作服务的半启用状态。

手动 `Release` workflow 只生成保留 14 天的 production artifact，不会部署服务器。它用于审计、下载或人工恢复。

部署功能分支会覆盖 `thisme.icu` 当前运行的应用，并对同一个生产数据库执行该分支包含的迁移。之后再次 push `main`，原有自动部署仍会照常运行并切回 `main` 的最新版本。由于应用回滚不会逆转数据库 schema，功能分支迁移必须保持与当前 `main` 版本兼容。

## 数据库迁移与回滚

迁移发生在应用软链接切换之前。迁移失败时当前应用保持不变；迁移成功后，健康检查失败只会回滚应用代码，不会逆转数据库 schema。

所有生产迁移必须保持新旧应用版本同时可用。破坏性变更使用 expand/contract：先增加兼容结构并部署读写兼容代码，确认旧版本不再使用旧结构后，再在后续 release 删除旧结构。不能依赖自动 down migration 恢复生产数据。

## GitHub 配置

production environment 必须提供：

- Secret `PRODUCTION_SSH_PRIVATE_KEY`：与服务器授权公钥匹配的专用部署私钥。
- Secret `BETTER_AUTH_SECRET`：构建和运行 Better Auth 使用的生产密钥；必须与 `/etc/knowmesh.env` 中的当前密钥一致。
- Variable `PRODUCTION_APP_URL`：生产公网地址。
- Variable `PRODUCTION_COLLABORATION_URL`：生产同源 WSS 地址，当前为 `wss://thisme.icu/collaboration-ws`。
- Variable `PRODUCTION_COLLABORATION_ENABLED`：是否由部署流程强制重启并验证协作服务；首次服务器配置完成前保持 `false`。

部署私钥不得复用个人管理密钥。服务器 sudoers 应限制部署身份只能管理 release 目录、`knowmesh.service` 和 `knowmesh-collaboration.service`；当前宽泛的 sudo 权限属于待收紧的运维风险。

## 协作服务首次启用

首次启用是一次性服务器操作，必须在包含 `collaboration-server.cjs` 与 `deploy/` 的 release 已成为 `current` 后执行：

1. 从 `deploy/systemd/knowmesh-collaboration.service` 安装并启用 systemd unit。
2. 将 `deploy/nginx/knowmesh-websocket-map.conf` 安装到 Nginx `http` 上下文，将 `deploy/nginx/knowmesh-collaboration-location.conf` include 到现有 HTTPS `server` 块。
3. 在 `/etc/knowmesh.env` 设置同源 URL、loopback 端口与 `COLLABORATION_ENABLED=true`，启动协作服务并确认 `/ready`。
4. 重启 Next.js，使服务端模式分流读取新开关；通过 `nginx -t` 后 reload Nginx。
5. 将 GitHub production variable `PRODUCTION_COLLABORATION_ENABLED` 改为 `true`，再从 Actions 手动运行 `CI` workflow 验证当前 SHA。后续发布自动执行双服务健康检查、WSS Upgrade 冒烟和双服务回滚。

完整生产验收仍需使用两个真实登录会话确认同步、只读权限、撤权、重连和服务重启后的持久化；公网 Upgrade 冒烟只证明 TLS、Nginx 和 Hocuspocus 握手链路可达，不替代应用协议与权限验收。

## 相关实现

- `.github/workflows/CI.yml`
- `.github/workflows/Release.yml`
- `scripts/migrate-production.ts`
- `scripts/collaboration-server.ts`
- `deploy/systemd/knowmesh-collaboration.service`
- `deploy/nginx/`
- `next.config.ts`
- `docs/database/schema-and-migrations.md`
