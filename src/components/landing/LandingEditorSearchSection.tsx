import { InteractiveSearchSimulator } from '@/components/landing/InteractiveSearchSimulator';
import { LandingSectionHeading } from '@/components/landing/LandingSectionHeading';

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
        <LandingSectionHeading
          description="尝试在下方交互搜索框中输入关键词，体验 KnowMesh 的上下文片段高亮效果。"
          eyebrow="全域内容搜索"
          title="在庞大的知识网格中，瞬间穿透定位"
        />

        <InteractiveSearchSimulator />
      </div>
    </section>
  );
}
