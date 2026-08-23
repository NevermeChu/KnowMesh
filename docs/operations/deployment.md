# KnowMesh 生产部署手册

本文面向第一次接触服务器部署的维护者，说明 KnowMesh 当前如何从 GitHub 仓库变成 `https://thisme.icu` 上运行的服务，以及每个配置由谁管理。当前代码、workflow、迁移和部署模板是事实来源；服务器上的未版本化文件必须通过本文命令现场核对。

## 先理解部署是什么

开发时，应用运行在自己的电脑上。生产部署则是把一个确定版本的代码构建成运行制品，安全地传到长期在线的服务器，迁移数据库，启动服务，再让域名把用户请求送到这些服务。

几个常见术语：

- **CI（持续集成）**：自动构建、Lint、单元测试和浏览器测试，回答“这个提交能否正常工作”。
- **CD（持续部署）**：CI 通过后，把同一提交自动发布到生产服务器，回答“这个提交是否已经在服务器运行”。
- **release**：某个 Git commit 对应的不可变生产目录。本项目用完整 Git SHA 标识 release。
- **artifact**：GitHub Actions 构建出的生产制品，不包含仓库源码工作树和生产密钥。
- **systemd**：Ubuntu 的进程管理器，负责启动、停止、重启服务以及服务器重启后的自动拉起。
- **Nginx**：公网入口，负责 HTTPS 证书、域名、HTTP 反向代理和 WebSocket Upgrade。
- **反向代理**：用户只访问 `thisme.icu`，Nginx 再把请求转发给服务器内部端口。
- **数据库迁移**：按顺序把 PostgreSQL Schema 升级到新代码需要的结构。
- **软链接**：`current` 是一个指针；切换它就能让两个 systemd 服务一起使用新 release。

## 五分钟全景图

```text
开发者 push / 手动运行 workflow
                │
                ▼
        GitHub Actions（Ubuntu）
        ├─ static：类型生成 + Lint
        ├─ build：构建 Next.js
        ├─ unit：运行 Vitest
        ├─ e2e：真实 PostgreSQL + Hocuspocus + Playwright
        └─ deploy：重新构建生产制品并通过 SSH 上传
                │
                ▼
        Ubuntu 生产服务器
        ├─ /srv/knowmesh-app/releases/<Git SHA>  不可变版本
        ├─ /srv/knowmesh-app/current             当前版本软链接
        ├─ /etc/knowmesh.env                     生产密钥和运行配置
        ├─ knowmesh.service                      Next.js，127.0.0.1:3000
        ├─ knowmesh-collaboration.service        Hocuspocus，127.0.0.1:1234
        └─ collaboration readiness               127.0.0.1:1235
                ▲
                │ 本机反向代理
        Nginx + Let's Encrypt TLS
        ├─ https://thisme.icu/*                  → 127.0.0.1:3000
        └─ wss://thisme.icu/collaboration-ws    → 127.0.0.1:1234
                ▲
                │
             浏览器用户

Next.js 与 Hocuspocus ───────────────→ 生产 PostgreSQL
认证和邀请邮件 ─────────────────────→ Resend（配置后）
```

用户不能直接访问 3000、1234 或 1235。公网只需要 HTTP/HTTPS 和管理用 SSH；三个应用端口都绑定到 `127.0.0.1`，由 Nginx 或服务器本机访问。

## 哪些事实能够从仓库确认

仓库可以准确确认：

- 哪些分支和事件会触发 CI/CD。
- CI 运行哪些检查、使用哪个 Node.js 和 PostgreSQL 版本。
- artifact 包含什么，以及如何上传、迁移、切换、检查和回滚。
- GitHub Secrets/Variables 的名字和用途。
- `/etc/knowmesh.env` 中应用认识的变量。
- Hocuspocus systemd unit 和两个 Nginx 协作片段的完整内容。

仓库不能独立确认或重建：

- 云服务器、DNS 和防火墙最初如何创建。
- 生产 PostgreSQL 在哪里运行、如何创建用户，以及如何备份和恢复。
- Let's Encrypt 证书最初如何申请和续期。
- 当前 `knowmesh.service`、完整 Nginx 站点和 sudoers 的完整内容。
- 服务器文件后来是否被人工修改。

本项目当前不是“空服务器一键安装”。首次引导完成后，日常发布已经自动化。当前服务器通过实际命令确认过两个 systemd 服务、本地 readiness、本地 Next.js、公网 HTTPS 和公网 WSS Upgrade；这些运行事实仍可能在未来人工改动后漂移，因此手册保留了现场检查命令。

## 当前生产拓扑

| 项目 | 当前值或位置 | 管理者 |
| --- | --- | --- |
| 公网域名 | `thisme.icu`，`www.thisme.icu` 重定向到主域名 | DNS + Nginx |
| HTTPS 证书 | `/etc/letsencrypt/live/thisme.icu/` | Certbot / Nginx |
| 部署服务器和 SSH 用户 | 定义在 `.github/workflows/CI.yml` 的 deploy job | GitHub workflow |
| Node.js | 24；workflow 与 systemd 使用的具体路径必须同步 | GitHub Actions + 服务器 NVM |
| Next.js 服务 | `knowmesh.service`，本机 `127.0.0.1:3000` | systemd |
| 协作服务 | `knowmesh-collaboration.service`，本机 `127.0.0.1:1234` | systemd |
| 协作健康检查 | `http://127.0.0.1:1235/ready` | Hocuspocus |
| release 根目录 | `/srv/knowmesh-app/releases/<GITHUB_SHA>` | deploy job |
| 当前版本 | `/srv/knowmesh-app/current` 软链接 | deploy job |
| 生产环境变量 | `/etc/knowmesh.env` | 服务器管理员 |
| 生产数据库 | 由 `/etc/knowmesh.env` 的 `DATABASE_URL` 指向 | 外部于仓库 |

不要把 `/etc/knowmesh.env`、数据库连接串、SSH 私钥或真实用户数据复制到文档、Issue、Actions 日志或聊天记录。

## 什么情况下会部署

当前 `.github/workflows/CI.yml` 的触发规则如下：

| 操作 | 运行检查 | 部署生产 |
| --- | --- | --- |
| push `main` | 是 | 是 |
| push `feature/permissions` | 是 | 是；这是正式开放前的临时规则 |
| 向 `main` 提交 Pull Request | 是 | 否 |
| Actions 页面手动运行 `CI` | 是 | 是，部署所选分支的当前 SHA |
| Actions 页面手动运行 `Release` | 只构建 artifact | 否 |
| commit message 包含 `[skip ci]` | GitHub 跳过 push workflow | 否 |

`feature/permissions` 目前和 `main` 一样会直接覆盖 `thisme.icu`。功能分支部署规则不会自动合并分支；项目正式开放前应删除这条例外，只允许 `main` 自动部署。

deploy job 使用 `production-deployment` 并发组且不取消进行中的部署，所以两个生产发布不会同时切换 `current`。

## 一次 CI 实际做什么

### 1. `static`：静态检查

它先执行 Next.js 类型生成，再运行项目 Lint。这里主要发现类型、格式和静态规则问题，不启动生产服务。

### 2. `build`：构建检查

它在 GitHub 的 Ubuntu runner 上使用 Node.js 24 和 `npm ci` 安装锁定依赖，然后运行 `npm run build-local`。这个脚本启动一次临时 PGlite、执行迁移并构建 Next.js；临时数据库不包含生产数据。

成功后的 `.next` 被按当前 Git SHA 缓存，供 E2E job 使用。这个缓存是 CI 加速手段，不是生产 release。

### 3. `unit`：单元和集成测试

它在固定版本的 Playwright 容器中运行 `npm run test -- --coverage`。这一步验证函数和模块行为，但不替代真实浏览器验收。

### 4. `e2e`：完整浏览器路径

它启动独立的 PostgreSQL 17 service，并明确设置：

- `E2E_REAL_POSTGRES=true`，禁止本地运行器再启动 PGlite。
- `COLLABORATION_ENABLED=true`，启动真实 Hocuspocus。
- `NEXT_PUBLIC_COLLABORATION_URL=ws://localhost:1234`。
- Playwright 通过真实页面和数据库验证关键用户路径。

这里的 PostgreSQL 是本次 GitHub job 的临时测试数据库，不是生产数据库。job 结束后容器和数据都会销毁。

### 5. `deploy`：生产部署

deploy 只有在 `build`、`static`、`unit` 和 `e2e` 全部成功后才开始。它不会下载 `build` job 的产物直接发布，而是使用生产 URL 再构建一次 standalone 应用，确保浏览器代码包含生产地址。

## 生产 artifact 包含什么

Next.js 在 `next.config.ts` 中启用了 `output: 'standalone'`。deploy job 在 standalone 目录中补齐：

- `server.js` 和 Next.js 运行依赖。
- `public/` 与 `.next/static/` 静态文件。
- `migrations/` 及 Drizzle journal。
- 自包含的 `migrate-production.cjs`。
- 自包含的 `collaboration-server.cjs`。
- `deploy/systemd/knowmesh-collaboration.service`。
- `deploy/nginx/` 下的两个协作代理片段。

打包前会删除 `.next/standalone/.env*`，所以生产密钥不会进入 artifact。CI workflow 同时把压缩 artifact 保存 14 天，便于审计或人工恢复。

应用、迁移程序和 Hocuspocus 来自同一个 Git SHA；切换或回滚 `current` 时，两个服务因此会一起切换版本。

## deploy 如何把 artifact 变成线上版本

按 `.github/workflows/CI.yml` 的真实顺序：

1. GitHub runner 获取生产专用 SSH 私钥。
2. `ssh-keyscan` 获取服务器 ED25519 host key，并与 workflow 中固定的 SHA-256 指纹比较。指纹不一致立即停止，不能静默接受陌生主机。
3. artifact 通过 `scp` 上传到服务器 `/tmp/knowmesh-release-<SHA>.tgz`。
4. SSH 以部署用户登录，再通过非交互 `sudo -n bash` 执行服务器端发布脚本。
5. 压缩包先解到 `/srv/knowmesh-app/releases/.<SHA>.staging`，逐项检查关键文件，再重命名为 `/srv/knowmesh-app/releases/<SHA>`。
6. 检查 `/etc/knowmesh.env` 可读、Node.js 可执行，以及 GitHub 与服务器的协作开关一致。
7. 新 release 中的迁移程序读取 `/etc/knowmesh.env`，对生产 PostgreSQL 执行尚未执行的迁移。
8. 记录旧 release，用临时链接加 `mv -Tf` 原子切换 `/srv/knowmesh-app/current`。
9. 先重启 Hocuspocus 并等待 `/ready`，再重启 Next.js 并检查 `http://127.0.0.1:3000/`。
10. GitHub runner 从公网检查 `https://thisme.icu/`；协作启用时还要求 WSS 路径返回 `101 Switching Protocols`。
11. 全部成功后删除本次回滚标记；失败则把 `current` 指回旧 release，并重启两个服务。

服务器上没有 Git checkout、`git pull` 或 `npm install`。服务器只运行 GitHub 已构建和验证过的 release，这避免了服务器工作树、依赖安装和未提交文件导致版本不确定。

## 配置分成三层

### GitHub production environment

打开仓库的 **Settings → Environments → production**。当前 workflow 需要：

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Secret | `PRODUCTION_SSH_PRIVATE_KEY` | GitHub 连接生产服务器的专用私钥 |
| Secret | `BETTER_AUTH_SECRET` | 生产构建时校验 Better Auth 配置；应与服务器值一致 |
| Variable | `PRODUCTION_APP_URL` | 当前为 `https://thisme.icu` |
| Variable | `PRODUCTION_COLLABORATION_URL` | 当前为 `wss://thisme.icu/collaboration-ws` |
| Variable | `PRODUCTION_COLLABORATION_ENABLED` | 当前为 `true`；必须和服务器开关一致 |

Secret 的值在 Actions 页面不可读回；Variable 不是秘密。不要把数据库连接串放到 GitHub：生产迁移和运行时从服务器文件读取它。

### workflow 内固定的服务器参数

deploy job 的 `env` 还固定了部署主机、SSH 端口、部署用户、host fingerprint、Node.js 路径、release 路径、systemd 服务名和健康检查地址。更换服务器、SSH key、Node.js 安装位置或端口时，不能只改服务器，必须同步修改这里。

host fingerprint 不是密码，它用来确认 GitHub 连接的是预期服务器。服务器重装后 host key 会变化，应该在可信通道重新核对新指纹，再更新 workflow；不能为了让部署通过而关闭 `StrictHostKeyChecking`。

### 服务器 `/etc/knowmesh.env`

这个文件同时由 Next.js、Hocuspocus 和生产迁移程序读取。建议权限只允许 root 与运行服务的受控身份读取。不要在命令中打印完整文件。

结构示例只写占位符：

```dotenv
# Next.js standalone server; migration code enforces these exact values.
HOSTNAME=localhost
PORT=3000
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# Public URLs. NEXT_PUBLIC_* values are also baked into browser code at build time.
NEXT_PUBLIC_APP_URL=https://thisme.icu
NEXT_PUBLIC_COLLABORATION_URL=wss://thisme.icu/collaboration-ws

# PostgreSQL and Better Auth secrets.
DATABASE_URL=<production-postgresql-url>
BETTER_AUTH_SECRET=<at-least-32-random-characters>

# Email delivery. Env validation permits omission, but authentication and invitation
# emails need valid Resend configuration to be delivered.
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=KnowMesh <verified-sender@example.com>

# Team document collaboration.
COLLABORATION_ENABLED=true
COLLABORATION_ADDRESS=127.0.0.1
COLLABORATION_PORT=1234
COLLABORATION_HEALTH_PORT=1235
```

变量的关键区别：

- 生产 `DATABASE_URL`、`BETTER_AUTH_SECRET` 和 Resend 配置是运行时秘密；生产数据库连接串只存在于服务器。CI 中另外使用公开的临时测试数据库连接串，不接触生产数据。
- `NEXT_PUBLIC_*` 会进入浏览器 JavaScript，绝不能放秘密；它们在生产构建时必须正确。只修改服务器文件不会重写已经构建好的浏览器 bundle，需要重新部署。
- `HOSTNAME=localhost` 和 `PORT=3000` 由生产迁移程序强制检查，防止应用意外监听公网地址或错误端口。
- `COLLABORATION_ENABLED` 不写或不是精确的 `true` 时，应用按关闭处理。当前生产启用协作，因此 GitHub Variable 和服务器文件都必须为 `true`。
- `COLLABORATION_ADDRESS=127.0.0.1` 让 WebSocket 和健康端口只监听本机。

安全地检查变量名是否存在，可以使用：

```bash
sudo grep -nE '^(HOSTNAME|PORT|NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_COLLABORATION_URL|DATABASE_URL|BETTER_AUTH_SECRET|RESEND_API_KEY|RESEND_FROM_EMAIL|COLLABORATION_[A-Z_]+)=' \
  /etc/knowmesh.env \
  | sed -E 's/=.*/=<configured>/'
```

这条命令只显示名称，不显示值。若要排查单个非敏感开关，可只 grep 那一个变量。

## systemd 如何运行应用

### Next.js

部署链路要求 `knowmesh.service` 在 restart 后从 `/srv/knowmesh-app/current` 启动 standalone Next.js、读取 `/etc/knowmesh.env` 并监听本机 3000 端口。当前服务器已经满足健康检查，但仓库没有这个 unit 的版本化模板，无法仅从代码证明它的实际 `WorkingDirectory`、`EnvironmentFile` 和 `ExecStart`；修改前必须查看现场配置：

```bash
sudo systemctl cat knowmesh.service --no-pager
sudo systemctl status knowmesh.service --no-pager -l
```

不要根据本文猜测 `ExecStart`；以 `systemctl cat` 为准。workflow 假定该服务已经存在，并允许部署身份执行 restart。

### Hocuspocus

`knowmesh-collaboration.service` 的权威模板在 `deploy/systemd/knowmesh-collaboration.service`。它：

- 以 `thisme:thisme` 运行。
- 使用 `/srv/knowmesh-app/current` 作为工作目录。
- 读取 `/etc/knowmesh.env`。
- 使用固定 Node.js 路径执行 `collaboration-server.cjs`。
- 异常退出后自动重启，并在停止时给持久化留出时间。
- 应用 systemd 的基础沙箱限制。

修改 unit 后需要：

```bash
sudo systemctl daemon-reload
sudo systemctl restart knowmesh-collaboration.service
```

普通代码发布不需要重新复制 unit；部署只会让 `current` 指向包含新 bundle 的 release。如果仓库模板本身改变，服务器管理员必须明确重新安装模板并执行 `daemon-reload`，当前 CI 不会自动覆盖 `/etc/systemd/system`。

## Nginx 如何把域名转给两个服务

当前完整站点位于服务器 `/etc/nginx/sites-available/knowmesh`，但不在仓库中。已确认的结构是：

- HTTP 的 `thisme.icu` 和 `www.thisme.icu` 重定向到主域 HTTPS。
- `www.thisme.icu` HTTPS 重定向到 `https://thisme.icu`。
- `thisme.icu` HTTPS 使用 Let's Encrypt 证书，并把普通请求代理到 `127.0.0.1:3000`。
- HTTPS `server {}` include `/etc/nginx/snippets/knowmesh-collaboration-location.conf`，把精确路径 `/collaboration-ws` 转到 `127.0.0.1:1234`。
- Nginx `http` 上下文加载 WebSocket connection map，保证普通请求与 Upgrade 使用正确的 `Connection` header。

协作片段的权威版本位于：

- `deploy/nginx/knowmesh-websocket-map.conf`
- `deploy/nginx/knowmesh-collaboration-location.conf`

每次修改 Nginx 后必须先测试，成功后才能 reload：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

`reload` 会平滑加载新配置；`restart` 会停止再启动 Nginx，通常没有必要。

## PostgreSQL 与迁移

生产应用只认识 `DATABASE_URL`，仓库无法判断数据库是本机、云数据库还是其他主机。部署前必须确保服务器能够通过该 URL 连接 PostgreSQL，并且数据库有可靠备份。

生产迁移由 artifact 中的 `migrate-production.cjs` 执行，不依赖服务器安装 Drizzle CLI，也不使用服务器源码。迁移发生在 `current` 切换之前：

- 迁移失败：部署停止，旧应用继续运行。
- 迁移成功但新服务健康检查失败：应用代码回滚，数据库 Schema 不回滚。

因此所有生产迁移必须向后兼容。破坏性 Schema 变更使用 expand/contract：先增加兼容结构并部署兼容代码，确认旧版本不再依赖旧结构后，再由后续 release 删除旧结构。不要依赖自动 down migration 恢复生产数据。

GitHub E2E 使用的 PostgreSQL 只证明迁移和关键行为能在真实 PostgreSQL 上运行；它不验证生产数据库容量、备份、网络、磁盘和权限配置。

## 当前自动回滚能保护什么

自动回滚会恢复：

- `/srv/knowmesh-app/current` 指向的旧 release。
- Next.js 与 Hocuspocus 的代码版本。
- 两个服务的运行进程。

自动回滚不会恢复：

- 已经成功执行的数据库迁移和数据写入。
- `/etc/knowmesh.env` 的人工修改。
- systemd、Nginx、证书、DNS、sudoers 或防火墙配置。
- 被人工删除的旧 release。

workflow 要求部署前已经存在有效的 `current` 软链接作为回滚目标，因此不能用它给一台空服务器做第一次发布。首次 release 必须由管理员引导安装并确认服务可运行，之后自动部署才接管。

当前 workflow 也不会自动清理旧 release。清理前必须先解析 `current`、确认没有回滚需要，并保留足够的已知可用版本；不要对 release 根目录执行宽泛递归删除。

## 第一次建立服务器需要做什么

这一节解释边界，不冒充已经存在的一键脚本。新服务器至少需要人工完成：

1. 创建 Ubuntu x86-64 主机，配置只允许必要端口的防火墙。
2. 为域名配置 DNS，使 `thisme.icu` 和 `www.thisme.icu` 指向该主机。
3. 安装 Nginx，申请并验证 Let's Encrypt 证书和自动续期。
4. 安装 Node.js 24，并让 workflow 与两个 systemd unit 使用同一稳定路径。
5. 创建生产 PostgreSQL、数据库用户、连接限制、备份和恢复流程。
6. 创建部署用户和专用 SSH key，把私钥放进 GitHub Secret，把公钥放进服务器 `authorized_keys`。
7. 配置最小 sudoers 权限，使 deploy job 能管理 release 目录并重启两个指定服务。
8. 创建 `/etc/knowmesh.env`，设置严格权限，不把它放进 release。
9. 安装 `knowmesh.service`、协作 systemd unit 和完整 Nginx 站点。
10. 人工建立第一个 release 和 `current`，确认本地服务与公网 HTTPS 正常。
11. 在 GitHub production environment 配置 Secrets/Variables，再手动运行 `CI` 接管后续发布。

当前仓库只版本化了协作 systemd unit 和两个协作 Nginx 片段，没有覆盖上述整个 bootstrap。迁移到新服务器前，必须先从当前服务器导出并审查未版本化配置，不能只 clone 仓库就开始部署。

## 日常发布：你实际需要做什么

正常情况下，维护者不登录服务器发布代码：

1. 在本地完成修改和必要验证。
2. 提交并 push 到会部署的分支。
3. 打开 GitHub 仓库的 **Actions → CI**。
4. 先看 `static`、`build`、`unit`、`e2e`；任何一个失败都不会开始部署。
5. 再看 `Deploy production` 中的构建、SSH 上传、迁移、服务切换和公网验证。
6. 所有 job 绿色后访问生产站点，完成与改动风险相称的人工业务验收。

需要重新验证当前分支但没有新 commit 时，可以在 **Actions → CI → Run workflow** 选择分支并运行。注意：这不是“只跑测试”，它在所有检查通过后会真实部署所选 SHA。

如果只想生成可下载的生产 artifact，使用 **Actions → Release → Run workflow**。Release workflow 不连接服务器、不迁移数据库、不切换生产版本，artifact 保留 14 天。

## 发布后的检查

### GitHub 侧

- 确认 workflow 的 commit SHA 正是要发布的版本。
- 确认五个 job 全部成功，而不是只看 build。
- 在 deploy log 中确认迁移、服务健康检查、公网 HTTPS 和 WSS Upgrade 都成功。
- 不要把失败日志中的命令输出复制到公开位置前，先检查是否含敏感信息。

### 服务器侧

```bash
readlink -f /srv/knowmesh-app/current
sudo systemctl status knowmesh.service --no-pager -l
sudo systemctl status knowmesh-collaboration.service --no-pager -l
curl --fail --silent --show-error http://127.0.0.1:3000/ >/dev/null \
  && echo "Next.js 本地健康检查通过"
curl --fail --silent --show-error http://127.0.0.1:1235/ready
curl --fail --silent --show-error https://thisme.icu/ >/dev/null \
  && echo "公网 HTTPS 检查通过"
```

`readlink` 输出应当以预期 Git SHA 结尾。`/ready` 的 JSON 中 `status` 必须是 `ready`；指标非零不等于故障，应结合字段语义和日志判断。

### 业务侧

自动 WSS 冒烟只证明 TLS、Nginx 和 Hocuspocus 能完成 Upgrade，不证明登录 Cookie、文档权限和 Yjs 业务都正确。协作相关发布还应使用两个真实登录会话确认：

1. 同一 Team 文档可以实时同步。
2. viewer 不能编辑。
3. 降权、移除成员或撤销 Session 后旧页面失去写入能力。
4. 网络恢复后能够重连。
5. 服务重启并重新打开文档后，正文仍是最近一次成功持久化的内容。

## 常用运维命令

查看服务和最近日志：

```bash
sudo systemctl status knowmesh.service --no-pager -l
sudo systemctl status knowmesh-collaboration.service --no-pager -l
sudo journalctl -u knowmesh.service -n 100 --no-pager
sudo journalctl -u knowmesh-collaboration.service -n 100 --no-pager
```

重启应用：

```bash
sudo systemctl restart knowmesh-collaboration.service
sudo systemctl restart knowmesh.service
```

检查配置而不泄露环境变量：

```bash
sudo systemctl cat knowmesh.service --no-pager
sudo systemctl cat knowmesh-collaboration.service --no-pager
sudo nginx -T | grep -nE 'server_name|collaboration-ws'
```

`systemctl cat` 不会展开 `EnvironmentFile` 内容。不要使用会完整打印 `/etc/knowmesh.env` 的命令收集诊断信息。

## 故障从哪里开始查

### CI 在 deploy 之前失败

这是代码、构建或测试问题，生产尚未切换。先打开失败 job 的第一个真实错误，不要因为后续步骤被取消而误判部署问题。

### SSH host fingerprint 失败

GitHub 看到的服务器身份和 workflow 固定值不一致。可能是服务器重装、IP 指向变化或中间人风险。先从可信的服务器控制台核对 ED25519 指纹，不能关闭校验绕过。

### GitHub 与服务器协作开关不一致

检查 GitHub Variable `PRODUCTION_COLLABORATION_ENABLED` 和 `/etc/knowmesh.env` 的 `COLLABORATION_ENABLED`。两者必须都是精确的 `true` 或都关闭；当前生产预期都是 `true`。

### 数据库迁移失败

旧应用尚未切换。查看迁移错误、数据库连通性、权限和磁盘状态；不要反复重跑未知的非幂等人工 SQL。Drizzle 已记录成功迁移，正常重跑 workflow 会跳过已完成项。

### 本地 Next.js 健康检查失败

workflow 会把 `current` 恢复为旧 release。检查 `journalctl -u knowmesh.service`、Node.js 路径、环境变量校验、端口占用和数据库连接。

### Hocuspocus readiness 失败

workflow 不会继续启动新 Next.js，并会回滚。检查协作服务日志、1234/1235 端口、`DATABASE_URL`、Better Auth secret，以及 `/ready` 是否报告未恢复的存储失败。

### 本地正常但公网失败

重点检查 Nginx、证书、DNS 和云防火墙。公网验证失败也会触发应用 release 回滚，但不会修改这些外围配置。

## 还没有被自动化的运维责任

下列事项不能因为 CI 绿色就视为已经解决：

- PostgreSQL 定时备份、备份加密、保留周期和实际恢复演练。
- 服务器系统更新、磁盘容量、时钟、证书续期和防火墙审计。
- 应用和数据库监控、告警、日志保留与敏感信息检查。
- 旧 release 的安全清理。
- 部署 SSH key、Better Auth secret、数据库密码和 Resend key 的轮换。
- 最小化 sudoers；当前文档已知服务器部署权限仍需收紧。
- 将 `knowmesh.service`、完整 Nginx 站点和首次 bootstrap 收入版本控制。

这些是“系统能部署”与“系统可长期可靠运营”之间的差别。生产上线前至少要补齐数据库恢复演练、监控告警和最小权限审计。

## 修改部署配置时的同步规则

- 更换域名：同时更新 DNS、证书、Nginx、GitHub 两个 URL Variable 和服务器的两个 `NEXT_PUBLIC_*`，然后重新部署。
- 更换 Node.js：同时更新 Actions Node 版本、deploy job 的 `NODE_BINARY`、两个 systemd unit 的 `ExecStart`，再验证原生依赖兼容性。
- 更换服务器：更新 deploy host、可信 host fingerprint、SSH key、公钥和 GitHub Secret；先完成首次 bootstrap。
- 更换端口：同时更新服务器环境、systemd/Nginx、workflow 健康检查和安全组；当前生产迁移明确要求 Next.js 仍为 3000。
- 更换 Better Auth secret：GitHub Secret 与服务器值必须协调切换，现有 Session 可能全部失效。
- 修改协作 unit 或 Nginx 模板：artifact 会包含新模板，但 CI 不会自动安装到 `/etc`；需要服务器管理员比较并安装。
- 修改 Schema：提交新的迁移并确保向后兼容；不能改写已经用于生产的旧迁移。

## 相关实现

- [CI workflow](../../.github/workflows/CI.yml)
- [Release workflow](../../.github/workflows/Release.yml)
- [GitHub 项目初始化 action](../../.github/actions/setup-project/action.yml)
- [生产迁移入口](../../scripts/migrate-production.ts)
- [协作服务入口](../../scripts/collaboration-server.ts)
- [协作 systemd unit](../../deploy/systemd/knowmesh-collaboration.service)
- [Nginx WebSocket map](../../deploy/nginx/knowmesh-websocket-map.conf)
- [Nginx WebSocket location](../../deploy/nginx/knowmesh-collaboration-location.conf)
- [环境变量校验](../../src/libs/Env.ts)
- [Next.js standalone 配置](../../next.config.ts)
- [数据库 Schema 与迁移](../database/schema-and-migrations.md)
