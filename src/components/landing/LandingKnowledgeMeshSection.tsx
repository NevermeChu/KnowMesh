import { KnowledgeMeshCanvas } from '@/components/landing/KnowledgeMeshCanvas';

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
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 3rem' }}>
          <span
            className="badge-pill"
            style={{
              marginBottom: '0.75rem',
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
            }}
          >
            ☍ 知识拓扑网格
          </span>
          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
            }}
          >
            编织自生长的团队知识连接网
          </h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: '1rem', marginTop: '0.75rem' }}>
            在 KnowMesh
            中，空间、项目、文档、权限策略与数据库存储不是孤立的文件夹，而是可以关联理解的有机构架。尝试拖拽下方节点，查看拓扑网格的交互式结构演示：
          </p>
        </div>

        <KnowledgeMeshCanvas />
      </div>
    </section>
  );
}
