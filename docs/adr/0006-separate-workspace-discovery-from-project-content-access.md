# ADR 0006：分离 Workspace 结构发现与 Project 内容访问

- 状态：Accepted
- 日期：2026-08-13

## 背景

ADR 0004 和 ADR 0005 让 Team Workspace 角色向其中所有项目和文档继承。该模型无法表达“同一团队可以发现全部项目结构，但项目正文只对被邀请或获批的成员开放”：Workspace editor 会自动编辑所有项目，Workspace owner 也能读取所有正文，项目直接成员关系不再是内容隔离边界。

产品现已确定 Workspace 是团队范围，Project 是正文访问范围。Workspace 成员需要在导航栏发现团队的项目、文件夹和文件名称及其从属关系，但不得从导航、正文查询、搜索、摘要或大纲获得正文信息；只有 Project 直接成员可以读取正文。

## 决策

- `workspace_members` 决定 Team Workspace 结构发现权。所有 Workspace 成员，包括 owner，都可以读取项目以及导航所需的文件夹、文件名称和从属关系。
- `project_members` 是项目正文访问的强制门槛。不存在直接成员记录时，用户不能读取正文、正文层级、摘要、搜索片段、附件或正文派生信息。
- Project 权限只由 `project_members.role` 决定：viewer 可读，editor 可读写，owner 可读写并管理项目。Workspace 角色不再与 Project 角色取权限并集。
- Personal Workspace 继续只允许 owner；其项目 owner 必须同时具有 Project owner 成员记录。
- Workspace 与 Project 邀请接受后均以 viewer 加入。Project 邀请对象只允许已有 Workspace 成员接受。
- Workspace viewer 可申请 editor；非 Project 成员可申请 viewer；Project viewer 可申请 editor。管理员批准后才更新正式成员关系。
- Document 继续完全继承 Project 内容权限，不增加文档级 ACL。
- 当前数据模型尚无文件夹；未来增加文件夹时，其名称与从属关系属于导航结构元数据，正文和正文派生信息仍受 Project 直接成员门槛保护。

## 原因

- 团队成员能够发现资源，便于提出访问申请，同时项目正文保持最小授权。
- 直接成员记录成为唯一内容权限来源，避免 Workspace 角色与 Project 角色冲突。
- 服务端可以在读取 `documents.content` 前完成成员门槛检查，降低仅靠前端隐藏导致的泄露风险。
- 默认 viewer 与显式升级申请避免邀请动作直接授予写权限。

## 后果

- 导航查询与正文查询必须分离；导航可以返回 ID、名称和从属关系，正文查询必须要求 `document.read`。
- Workspace owner 不再自动管理或读取其未加入的 Team Project。
- 项目成员管理使用邀请、接受和访问申请状态；不得把 Workspace 成员直接显示为项目权限成员。
- 正文搜索、摘要、预览、大纲和附件等后续能力必须复用 Project 内容授权，不能从导航可见性推断正文权限。
- ADR 0004 中“Team Project 合并 Workspace 与 Project 权限”的决策，以及 ADR 0005 中相同的继承条款，由本 ADR 替代；Workspace 类型仍是项目模式的唯一来源。

## 备选方案

### Workspace 成员自动继承全部项目权限

未采用。它不能隔离同一团队中的敏感项目，并使 Project 成员关系失去访问门槛作用。

### Workspace 内完全隐藏未授权项目

未采用。它不能满足团队成员发现资源并申请访问的需求。

### Workspace 角色作为 Project 默认角色并允许覆盖

未采用。它保留两个内容权限来源，降级和冲突规则难以解释。邀请或申请加入 Project 时统一从 viewer 开始更明确。

## 相关代码和文档

- `src/features/permissions/PermissionPolicy.ts`
- `src/features/permissions/server/ProjectAuthorization.ts`
- `src/features/workspaces/server/GetWorkspaceNavigation.ts`
- `src/features/documents/server/GetProjectDocuments.ts`
- `src/features/permissions/server/ProjectMembers.ts`
- [项目业务](../features/projects.md)
- [文档业务](../features/documents.md)
