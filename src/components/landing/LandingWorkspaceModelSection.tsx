/**
 * Renders the dual-workspace and capability model.
 *
 * @returns The workspace-model section.
 */
export function LandingWorkspaceModelSection() {
  return (
    <section id="dual-workspace" style={{ padding: '5.5rem 0', background: 'var(--canvas)' }}>
      <div className="landing-container">
        <div className="landing-grid-2" style={{ alignItems: 'center' }}>
          <div>
            <span
              className="badge-pill"
              style={{ marginBottom: '0.75rem', color: 'var(--accent)' }}
            >
              空间隔离与安全架构
            </span>
            <h2
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--ink)',
                lineHeight: 1.25,
                marginBottom: '1rem',
              }}
            >
              个人私密思维草稿
              <br />
              与团队资产库的完美平衡
            </h2>
            <p
              style={{
                color: 'var(--ink-muted)',
                fontSize: '0.9375rem',
                lineHeight: 1.7,
                marginBottom: '1.5rem',
              }}
            >
              每位成员注册后即可由系统幂等初始化专属个人空间（Personal
              Workspace），私密记录未成形的想法。在团队协同空间中，通过两级解耦的
              RBAC+能力矩阵，保障机密文档安全，只有被授权的项目成员才能读取正文。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--ink)' }}>
                    个人空间幂等初始化与绝对隔离
                  </strong>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-faint)' }}>
                    系统在注册生命周期自动建立，独占所有权，禁止外部邀请，防止私密数据外溢。
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--ink)' }}>
                    两级权限解耦 (project.structure.read)
                  </strong>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-faint)' }}>
                    工作区成员若未加入私密项目，仅可获知项目存在，正文内容与文档列表严格不可见。
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--ink)' }}>
                    所有权不变量守卫与历史占位匿名化
                  </strong>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-faint)' }}>
                    用户退出或删除账户前自动在事务内级联清理，文档贡献者安全转为匿名占位，确保协作链条不断裂。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Permission Tree Card */}
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '1.25rem',
              padding: '2rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--ink)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>层级授权与权限决策决策树</span>
              <span
                className="badge-pill"
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--success-border)',
                  background: 'var(--success-soft)',
                }}
              >
                PGlite DB 级联约束
              </span>
            </div>

            {/* Tree Visual */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                fontSize: '0.8125rem',
              }}
            >
              <div
                style={{
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  borderRadius: '0.75rem',
                  padding: '0.875rem 1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                    🏢 团队工作区 (Team Workspace)
                  </span>
                  <span className="highlight-pill">Role: Editor</span>
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--ink-faint)',
                    marginTop: '0.25rem',
                  }}
                >
                  继承能力：workspace.read, project.create
                </div>
              </div>

              <div
                style={{
                  marginLeft: '1.5rem',
                  borderLeft: '2px dashed var(--line)',
                  paddingLeft: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    border: '1px solid var(--accent)',
                    background: 'var(--accent-soft)',
                    borderRadius: '0.75rem',
                    padding: '0.875rem 1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      📁 核心产研项目 (Direct Member)
                    </span>
                    <span
                      style={{
                        background: 'var(--accent)',
                        color: 'white',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '0.35rem',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}
                    >
                      Role: Owner
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--accent-strong)',
                      marginTop: '0.25rem',
                    }}
                  >
                    能力全集：document.create, update, delete, members.manage
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid var(--line)',
                    background: 'var(--card)',
                    borderRadius: '0.75rem',
                    padding: '0.875rem 1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--ink-muted)' }}>
                      📁 商业审计机密项目 (Restricted)
                    </span>
                    <span className="badge-pill" style={{ fontSize: '0.7rem' }}>
                      Workspace Only (Viewer)
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--ink-faint)',
                      marginTop: '0.25rem',
                    }}
                  >
                    受保护：仅可读取项目结构名称，无权访问正文内容
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
