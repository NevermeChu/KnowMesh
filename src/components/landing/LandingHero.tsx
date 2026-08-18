import Link from 'next/link';
import { InteractiveWorkspacePreview } from '@/components/landing/InteractiveWorkspacePreview';

/**
 * Renders the landing hero and interactive workspace preview.
 *
 * @param props - Current authentication state.
 * @returns The hero section.
 */
export function LandingHero(props: { isAuthenticated: boolean }) {
  return (
    <section
      style={{
        position: 'relative',
        padding: '5rem 0 4rem',
        overflow: 'hidden',
      }}
    >
      {/* Luminous Blue-Cyan Radial Gradient Blur */}
      <div aria-hidden="true" className="hero-glow" />

      <div
        className="landing-container"
        style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
      >
        {/* Top Tag Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.75rem' }}>
          <div className="badge-pill">
            <span
              style={{
                display: 'inline-block',
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                background: '#10b981',
              }}
            />
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>KnowMesh 2.0</span>
            <span>·</span>
            <span>为团队打造的知识工作空间</span>
          </div>
        </div>

        {/* Main Headline */}
        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.25rem)',
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: '-0.04em',
            color: 'var(--ink)',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          让知识有序构建，
          <br />
          <span
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--teal) 100%)',
              display: 'inline-block',
              fontSize: 'clamp(1rem, 4.2vw, 4.25rem)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            让团队协作在上下文中自然发生。
          </span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(1.0625rem, 2vw, 1.25rem)',
            lineHeight: 1.65,
            color: 'var(--ink-muted)',
            maxWidth: '760px',
            margin: '1.5rem auto 2.25rem',
            fontWeight: 400,
          }}
        >
          告别散落的聊天记录与割裂文件。KnowMesh
          将双轨空间、细粒度能力权限、块级结构化编辑、全文检索与拓扑关系演示融为一体，为高敏捷团队沉淀持久生长的集体大脑。
        </p>

        {/* Hero Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '4rem',
          }}
        >
          {props.isAuthenticated ? (
            <Link
              href="/dashboard"
              className="btn-primary"
              style={{ padding: '0.875rem 1.75rem', fontSize: '1rem' }}
            >
              <svg
                style={{ width: '1.25rem', height: '1.25rem' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              进入工作台
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="btn-primary"
              style={{ padding: '0.875rem 1.75rem', fontSize: '1rem' }}
            >
              <svg
                style={{ width: '1.25rem', height: '1.25rem' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              开始使用
            </Link>
          )}
          <a
            href="#knowledge-mesh"
            className="btn-secondary"
            style={{ padding: '0.875rem 1.5rem', fontSize: '1rem' }}
          >
            <svg
              style={{ width: '1.25rem', height: '1.25rem', color: 'var(--accent)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
              />
            </svg>
            探索动态知识拓扑
          </a>
        </div>

        {/* Live Interactive Workspace Mockup */}
        <InteractiveWorkspacePreview />
      </div>
    </section>
  );
}
