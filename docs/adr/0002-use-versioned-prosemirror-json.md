# ADR 0002：文档内容使用版本化 ProseMirror JSON

- 状态：Accepted
- 日期：2026-08-04
- 适用范围：Personal 文档；Team 文档正文权威状态由 [ADR 0012](0012-use-yjs-for-team-document-collaboration.md) 替代

## 背景

KnowMesh 需要实现富文本知识文档，并保留未来增加复杂节点和实时协作的路径。候选主存储格式包括 Markdown 字符串、编辑器无关的自定义 JSON，以及 ProseMirror 文档树。

Markdown 适合纯文本交换，但复杂块、节点属性和协作位置需要额外约定；过早设计自定义 JSON 会同时承担编辑器 Schema、命令和兼容层的成本。

## 决策

使用 Tiptap 作为当前编辑器层，以 ProseMirror JSON 作为 `documents.content` 的权威持久化格式，并在 PostgreSQL `JSONB` 中保存。每篇文档同时记录独立的 `content_schema_version`。

当前只实现单人自动保存，不存储 Yjs 更新。Markdown 只作为未来可能的导入、导出或复制格式，不作为主存储格式。

## 原因

- ProseMirror Schema 为节点类型、属性和嵌套关系提供明确约束。
- Tiptap 提供 React 集成和可组合扩展，减少直接使用 ProseMirror 的界面与命令开发成本。
- JSONB 保留结构化内容，便于执行版本迁移和服务端转换。
- Tiptap 可以在未来接入 Yjs，而当前无需承担实时基础设施和冲突处理成本。

## 后果

- 服务端必须验证客户端提交的内容是合法、可序列化的文档 JSON。
- extension 或节点语义变化需要兼容旧内容，并通过内容版本管理迁移。
- 不能把数据库 JSON 直接当作可信 HTML 渲染。
- Markdown 转换可能是有损的，导入导出能力需要单独定义兼容范围。
- 多客户端同时编辑在当前阶段仍是后写覆盖；实时协作需要新的存储和同步决策。

## 备选方案

### Markdown 作为主存储

未采用，因为它不能自然保留所有富文本节点属性和未来协作元数据。它仍适合作为交换格式。

### 直接使用 ProseMirror

未采用，因为当前没有需要绕过 Tiptap 抽象的底层定制需求，直接使用会增加菜单、命令和 React 集成成本。

### BlockNote

未采用，因为当前希望保留更大的界面与交互定制空间，而不是接受更完整、更固定的块编辑产品层。

## 相关代码和文档

- `src/features/documents/`
- `src/models/Schema.ts`
- [文档业务](../features/documents.md)
- [数据库与迁移](../database/schema-and-migrations.md)
