import { KnowledgeMeshCanvas } from '@/components/landing/KnowledgeMeshCanvas';
import { LandingSectionHeading } from '@/components/landing/LandingSectionHeading';

/**
 * Renders the interactive knowledge-mesh explanation.
 *
 * @returns The knowledge-mesh section.
 */
export function LandingKnowledgeMeshSection() {
  return (
    <section
      id="knowledge-mesh"
      style={{
        padding: '5.5rem 0',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div className="landing-container">
        <LandingSectionHeading
          description="在 KnowMesh 中，空间、项目、文档、权限策略与数据库存储不是孤立的文件夹，而是可以关联理解的有机构架。尝试拖拽下方节点，查看拓扑网格的交互式结构演示："
          eyebrow="☍ 知识拓扑网格"
          softBadge
          title="编织自生长的团队知识连接网"
          wide
        />

        <KnowledgeMeshCanvas />
      </div>
    </section>
  );
}
