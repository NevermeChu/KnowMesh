import { InteractiveSearchSimulator } from '@/components/landing/InteractiveSearchSimulator';

/**
 * Renders the editor and search demonstration.
 *
 * @returns The search demonstration section.
 */
export function LandingEditorSearchSection() {
  return (
    <section
      id="editor-search"
      style={{
        padding: '5.5rem 0',
        borderTop: '1px solid var(--line)',
        background: 'var(--surface)',
      }}
    >
      <div className="landing-container">
        <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 3rem' }}>
          <span className="badge-pill" style={{ marginBottom: '0.75rem', color: 'var(--accent)' }}>
            全域内容搜索
          </span>
          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
            }}
          >
            在庞大的知识网格中，瞬间穿透定位
          </h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: '1rem', marginTop: '0.75rem' }}>
            尝试在下方交互搜索框中输入关键词，体验 KnowMesh 的上下文片段高亮效果。
          </p>
        </div>

        <InteractiveSearchSimulator />
      </div>
    </section>
  );
}
