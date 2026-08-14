# KnowMesh 项目知识库

本目录保存与代码一起演进的项目知识，目标是让开发者和 AI 都能快速回答：系统现在如何工作、为什么这样设计、哪些约束不能破坏，以及修改后需要同步更新什么。

知识库不替代代码。当前工作区中的代码、Schema、迁移、配置和脚本是当前实现事实的唯一来源；本文档只是这些事实的可维护解释。

## 阅读入口

| 任务 | 必读文档 |
| --- | --- |
| 理解系统整体结构 | [`architecture/overview.md`](architecture/overview.md) |
| 修改项目读取、Server Component 或 Server Action | [`architecture/rendering-and-data-flow.md`](architecture/rendering-and-data-flow.md) |
| 修改项目、个人/协作区域或项目成员 | [`features/projects.md`](features/projects.md) |
| 修改站内通知、未读状态或通知触发事件 | [`features/notifications.md`](features/notifications.md) |
| 修改文档模型、编辑器或文档权限 | [`features/documents.md`](features/documents.md) 和 [`adr/0002-use-versioned-prosemirror-json.md`](adr/0002-use-versioned-prosemirror-json.md) |
| 修改表、索引或迁移 | [`database/schema-and-migrations.md`](database/schema-and-migrations.md) |
| 修改生产构建、部署或回滚流程 | [`operations/deployment.md`](operations/deployment.md) |
| 理解“为什么这样选” | [`adr/README.md`](adr/README.md) 和相关 Accepted ADR |
| 查看非权威 UI 参考 | [`design-references/README.md`](design-references/README.md) |
| 新增或维护知识文档 | [`KNOWLEDGE_MAINTENANCE.md`](KNOWLEDGE_MAINTENANCE.md) |

## 当前知识地图

```text
公开页面与认证页面
        │
        └─ 登录后的 (workspace) 路由布局
             ├─ 服务端解析永久个人空间与活动 Team Workspace
             └─ AppShell 客户端应用外壳
                  ├─ AppSidebar
                  │    ├─ Workspace 切换器
                  │    ├─ Personal Workspace 项目及文档
                  │    └─ 活动 Team Workspace 项目及文档
                  └─ ContentToolbar（含文档格式命令）+ 路由内容

项目业务
├─ workspaces + workspace_members
├─ projects（归属 Workspace）
├─ project_members
├─ Server Action 写入
└─ server-only 查询

文档业务
├─ documents + ProseMirror JSON
├─ 项目成员资源授权
├─ Tiptap 单人编辑器
└─ Server Action 自动保存

通知业务
├─ 用户级 notifications 历史
├─ 权限事务内写入事件
├─ Workspace Layout 未读统计
└─ /notifications 已读操作
```

## 文档类型

- `architecture/`：描述当前系统边界和跨模块数据流，随实现更新。
- `features/`：描述业务概念、不变量、权限和主要流程。
- `database/`：描述持久化模型、迁移规则和本地数据库操作。
- `adr/`：记录重要决策的背景、取舍和后果；Accepted ADR 保留历史。
- `design-references/`：保存非权威视觉参考；不得据此推断已实现功能。
- 根目录中的旧说明：已标记为历史资料，不作为当前实现依据。

## 事实来源

- 当前工作区中的代码、Schema、迁移、配置和脚本共同表达当前可执行状态，是当前实现事实的唯一来源。
- 测试只能作为特定行为的验证证据，不能替代被测实现，也不能证明没有覆盖到的业务语义。
- `architecture/`、`features/` 和 `database/` 是从当前实现提炼出的说明；发生冲突时必须以当前实现为准并修正文档。
- Accepted ADR 记录设计决定及原因，用于识别代码是否偏离原决定，但不能单独证明当前代码仍然这样运行。
- 历史资料和设计参考只提供上下文，不是当前事实来源。

如果代码与 Accepted ADR 不一致，应把“当前实现事实”和“设计决策偏离”分开报告，再决定修复代码还是新增替代 ADR；不得为了消除表面冲突而把 ADR 或当前状态文档静默改写成另一方。
