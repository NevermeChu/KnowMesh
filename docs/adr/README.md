# 架构决策记录

ADR 记录具有真实替代方案和长期影响的架构决定。它回答“为什么这样选择”，不替代描述当前行为的 architecture 或 feature 文档。

## 状态

- `Proposed`：正在讨论，不能作为强制约束。
- `Accepted`：当前有效，代码修改必须遵循。
- `Superseded`：被新的 ADR 替代，保留历史。
- `Rejected`：明确评估后未采用。

## 当前决策

| ADR | 状态 | 决策 |
| --- | --- | --- |
| [0001](0001-use-server-components-for-workspace-data.md) | Accepted | 工作区初始数据使用 Server Component 查询 |
| [0002](0002-use-versioned-prosemirror-json.md) | Accepted | 文档内容使用版本化 ProseMirror JSON 持久化 |
| [0003](0003-introduce-workspace-resource-boundary.md) | Accepted | 引入真实 Workspace 资源边界并分阶段实现权限继承 |
| [0004](0004-use-capability-authorization-and-collaboration-inheritance.md) | Accepted | 使用能力授权并继承协作项目权限 |

## 新 ADR 模板

```md
# ADR NNNN：决策标题

- 状态：Proposed
- 日期：YYYY-MM-DD

## 背景

问题、约束和触发决策的事实。

## 决策

明确说明选择什么，以及适用边界。

## 原因

为什么该方案优于真实存在的替代方案。

## 后果

正面结果、代价、限制和未来需要重新评估的条件。

## 备选方案

评估过但未采用的方案及原因。

## 相关代码和文档

稳定的相对路径和文档链接。
```

Accepted ADR 不改写核心决策。需要改变时新增 ADR，并将旧 ADR 标记为 `Superseded by ADR NNNN`。
