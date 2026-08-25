import { LandingSectionHeading } from '@/components/landing/LandingSectionHeading';

/**
 * Renders the current technology capability cards.
 *
 * @returns The technology section.
 */
export function LandingTechnologySection() {
  return (
    <section
      id="tech-stack"
      style={{
        padding: '5.5rem 0',
        background: 'var(--canvas)',
        borderTop: '1px solid var(--line)',
      }}
    >
      <div className="landing-container">
        <LandingSectionHeading
          description="彻底移除外部云认证锁定，采用现代 Web 最前沿的性能与类型安全实践。"
          eyebrow="现代轻量级工程底座"
          spacious
          title="拒绝臃肿，拥抱极速与自主"
        />

        <div className="landing-grid-3">
          <div className="card-feature">
            <h3
              style={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--ink)',
                marginBottom: '0.5rem',
              }}
            >
              Next.js 16 + React 19
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
              React Compiler 减少手动 useMemo/useCallback，Turbopack 提供快速开发启动，SSR 与 Server
              Components 直接组合服务端数据。
            </p>
          </div>

          <div className="card-feature">
            <h3
              style={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--ink)',
                marginBottom: '0.5rem',
              }}
            >
              Better Auth 自主认证
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
              告别第三方 Auth SaaS 账单与延迟。支持邮箱验证、密码找回、会话生命周期管理与本地
              PostgreSQL 无缝结合。
            </p>
          </div>

          <div className="card-feature">
            <h3
              style={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--ink)',
                marginBottom: '0.5rem',
              }}
            >
              Drizzle ORM + PGlite / Postgres
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
              全类型安全 SQL 体验。本地运行时使用 PGlite 兼容数据库，可一键启动全栈测试与构建。
            </p>
          </div>

          <div className="card-feature">
            <h3
              style={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--ink)',
                marginBottom: '0.5rem',
              }}
            >
              Tailwind CSS v4
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
              现代化 CSS 原生变量驱动的 Semantic Token
              系统，支持丝滑的暗黑/明亮模式切换与自定义阅读宽度设置。
            </p>
          </div>

          <div className="card-feature">
            <h3
              style={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--ink)',
                marginBottom: '0.5rem',
              }}
            >
              ProseMirror & Markdown
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
              块级富文本（Callout、Details、TaskList、代码块）可导出为标准
              Markdown，复杂节点按兼容规则转换。
            </p>
          </div>

          <div className="card-feature">
            <h3
              style={{
                fontWeight: 700,
                fontSize: '1.125rem',
                color: 'var(--ink)',
                marginBottom: '0.5rem',
              }}
            >
              Playwright + Vitest 精益测试
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
              精简掉脆弱的内部实现
              mock，专注于真实数据库约束与端到端核心交互，保障业务不变量固若金汤。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
