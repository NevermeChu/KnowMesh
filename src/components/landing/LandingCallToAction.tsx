import Link from 'next/link';

/**
 * Renders the final landing call to action.
 *
 * @param props - Current authentication state.
 * @returns The call-to-action section.
 */
export function LandingCallToAction(props: { isAuthenticated: boolean }) {
  return (
    <section
      style={{
        padding: '5.5rem 0',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
      }}
    >
      <div className="landing-container" style={{ textAlign: 'center' }}>
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '1.5rem',
            padding: '3.5rem 2rem',
            boxShadow: 'var(--shadow-lg)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            }}
          />

          <h2
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--ink)',
              marginBottom: '1rem',
            }}
          >
            准备好构建团队的共同记忆了吗？
          </h2>
          <p
            style={{
              color: 'var(--ink-muted)',
              fontSize: '1.0625rem',
              maxWidth: '580px',
              margin: '0 auto 2rem',
              lineHeight: 1.6,
            }}
          >
            从今天开始，让每一次团队探讨都有清晰沉淀，让每一份重要知识都能在需要时随时被发现与复用。
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {props.isAuthenticated ? (
              <Link
                href="/dashboard"
                className="btn-primary"
                style={{ padding: '0.875rem 2rem', fontSize: '1rem' }}
              >
                返回工作台
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="btn-primary"
                style={{ padding: '0.875rem 2rem', fontSize: '1rem' }}
              >
                免费开启 KnowMesh
              </Link>
            )}
            <a
              href="#dual-workspace"
              className="btn-secondary"
              style={{ padding: '0.875rem 1.5rem', fontSize: '1rem' }}
            >
              查阅架构文档
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
