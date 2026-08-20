'use client';

import { useState } from 'react';
import { AppLogo } from '@/components/ui/AppLogo';

type DocumentItem = {
  badge: string;
  badgeColor?: string;
  codeSnippet?: {
    code: string;
    file: string;
    lang: string;
  };
  content: string;
  tasks?: string[];
  title: string;
};

const defaultDocument: DocumentItem = {
  badge: '🔒 RBAC+Capability',
  badgeColor: 'var(--accent)',
  codeSnippet: {
    code: `export const getWorkspacePermissions = (role: Role, kind: Kind) => {
  if (kind === 'personal' && role === 'owner') {
    return ['workspace.read', 'workspace.update', 'project.create'];
  }
  return TEAM_ROLE_CAPABILITIES[role];
};`,
    file: 'PermissionPolicy.ts',
    lang: 'TypeScript · 权限策略定义',
  },
  content:
    'Workspace 层作为组织边界，项目层作为协作边界。个人空间具有独立所有权保护，团队空间支持细粒度能力委派。',
  tasks: [
    '实现全盘基于 Better Auth 的轻量本地化认证流',
    '完成 PGlite 本地开发数据库约束验证',
    '支持 ProseMirror 块级文档 Markdown 导出',
  ],
  title: '0004: 基于能力模型与协作继承的权限架构',
};

const documents: DocumentItem[] = [
  defaultDocument,
  {
    badge: '🎉 重点发布规划',
    badgeColor: '#10b981',
    content: '已完成基础权限与本地运行时验证。下一阶段将引入实时多人协同光标与知识关联图谱。',
    tasks: [
      '8月：替换 Clerk 为 Better Auth，实现本地身份、会话与业务数据管理',
      '9月：精简测试矩阵，强化核心 Owner 不变量数据库约束',
      '10月：完善块级富文本 Markdown 导出与全域高亮搜索',
    ],
    title: '🚀 2026 Q3-Q4 团队知识网络研发里程碑',
  },
  {
    badge: '🖌️ Tailwind v4 规范',
    badgeColor: '#f59e0b',
    codeSnippet: {
      code: `@theme inline {
  --color-canvas: var(--canvas);
  --color-card: var(--card);
  --color-ink: var(--ink);
  --color-accent: var(--accent);
}`,
      file: 'global.css',
      lang: 'Tailwind v4 · Semantic Tokens',
    },
    content:
      '所有组件均使用 var(--canvas)、var(--ink)、var(--accent) 语义 Token，严禁硬编码 hex 颜色。',
    tasks: [
      '遵循 HSL / Neutral 高质感中性色谱',
      '避免紫色背景、繁杂 Bento 堆砌等俗套设计',
      '保证所有交互元素具有流动响应式适配',
    ],
    title: '🎨 KnowMesh 2.0 设计系统与语义化 Token 规范',
  },
];

/**
 * Interactive product mockup preview showcasing documents, blocks, and tasks.
 *
 * @returns The interactive workspace preview component.
 */
export function InteractiveWorkspacePreview() {
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({
    '实现全盘基于 Better Auth 的轻量本地化认证流': true,
    '完成 PGlite 本地开发数据库约束验证': true,
    '支持 ProseMirror 块级文档 Markdown 导出': true,
    '遵循 HSL / Neutral 高质感中性色谱': true,
  });

  const activeDoc = documents[activeDocIndex] ?? defaultDocument;

  const toggleTask = (task: string) => {
    setCheckedTasks((prev) => ({
      ...prev,
      [task]: !prev[task],
    }));
  };

  return (
    <div
      id="hero-workspace"
      className="workspace-window"
      style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        textAlign: 'left',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-overlay)',
      }}
    >
      {/* Window Top Bar */}
      <div
        style={{
          height: '2.75rem',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: '#ff5f56',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: '#ffbd2e',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              width: '0.75rem',
              height: '0.75rem',
              borderRadius: '50%',
              background: '#27c93f',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--ink-faint)',
              marginLeft: '0.75rem',
              fontFamily: 'monospace',
            }}
          >
            KnowMesh Workspace v2.0 · Live Interactive Demo
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            className="badge-pill"
            style={{
              padding: '0.15rem 0.5rem',
              fontSize: '0.7rem',
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
            }}
          >
            ⚡ 示例状态已同步
          </span>
        </div>
      </div>

      {/* Window Body (2 Columns: Sidebar + Canvas) */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]" style={{ minHeight: '480px' }}>
        {/* Left Sidebar */}
        <aside
          style={{
            background: 'var(--surface)',
            borderRight: '1px solid var(--line)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {/* Workspace Selector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AppLogo className="size-8 rounded-lg" />
                <div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: 'var(--ink)',
                      lineHeight: 1.2,
                    }}
                  >
                    核心产研团队
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--ink-faint)' }}>
                    团队空间 · Owner
                  </div>
                </div>
              </div>
              <svg
                style={{ width: '1rem', height: '1rem', color: 'var(--ink-faint)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                />
              </svg>
            </div>

            {/* Nav Section */}
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--ink-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
                paddingLeft: '0.5rem',
              }}
            >
              项目与文档
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveDocIndex(0);
                }}
                className={`sidebar-item w-full text-left ${activeDocIndex === 0 ? 'active' : ''}`}
              >
                <span>📁</span> <span>产品架构设计 ADR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveDocIndex(1);
                }}
                className={`sidebar-item w-full text-left ${activeDocIndex === 1 ? 'active' : ''}`}
              >
                <span>🚀</span> <span>2026 核心里程碑</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveDocIndex(2);
                }}
                className={`sidebar-item w-full text-left ${activeDocIndex === 2 ? 'active' : ''}`}
              >
                <span>🎨</span> <span>设计系统与规范</span>
              </button>
            </div>

            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--ink-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: '1.25rem 0 0.5rem',
                paddingLeft: '0.5rem',
              }}
            >
              高频关注
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div className="sidebar-item" style={{ color: 'var(--ink-muted)' }}>
                <span>⭐</span> <span>权限能力矩阵表</span>
              </div>
              <div className="sidebar-item" style={{ color: 'var(--ink-muted)' }}>
                <span>⭐</span> <span>本地开发数据库 (PGlite)</span>
              </div>
            </div>
          </div>

          {/* Sidebar User Profile */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              borderTop: '1px solid var(--line)',
              fontSize: '0.8125rem',
            }}
          >
            <div
              style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Alex
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  color: 'var(--ink)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Alex Chen
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--ink-faint)' }}>
                alex@knowmesh.io
              </div>
            </div>
          </div>
        </aside>

        {/* Right Content Canvas */}
        <main style={{ padding: '2rem 2.5rem', background: 'var(--card)', overflowY: 'auto' }}>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                className="badge-pill"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  color: 'var(--accent)',
                  background: 'var(--accent-soft)',
                }}
              >
                {activeDoc.badge}
              </span>
              <span
                className="badge-pill"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  background: 'var(--surface)',
                  color: 'var(--ink-secondary)',
                }}
              >
                👥 8 位示例成员
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--ink-faint)',
                  marginLeft: 'auto',
                }}
              >
                上次更新：刚刚
              </span>
            </div>
            <h2
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.03em',
                marginBottom: '1rem',
              }}
            >
              {activeDoc.title}
            </h2>
          </div>

          <div>
            <div className="callout-box">
              <strong>💡 架构核心决策：</strong>
              <p style={{ marginTop: '0.25rem' }}>{activeDoc.content}</p>
            </div>

            {activeDoc.tasks && activeDoc.tasks.length > 0 && (
              <div style={{ margin: '1.25rem 0' }}>
                <h4
                  style={{
                    fontSize: '0.9375rem',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    marginBottom: '0.5rem',
                  }}
                >
                  📌 本期交付检查清单 (可点击交互)
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--ink-secondary)',
                  }}
                >
                  {activeDoc.tasks.map((task) => (
                    <label
                      key={task}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={task}
                        checked={Boolean(checkedTasks[task])}
                        onChange={() => {
                          toggleTask(task);
                        }}
                        style={{
                          accentColor: 'var(--accent)',
                          width: '1rem',
                          height: '1rem',
                        }}
                      />
                      <span className={checkedTasks[task] ? 'text-ink-muted line-through' : ''}>
                        {task}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeDoc.codeSnippet && (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginTop: '1.25rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    color: 'var(--ink-faint)',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span>{activeDoc.codeSnippet.lang}</span>
                  <span>{activeDoc.codeSnippet.file}</span>
                </div>
                <pre
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--ink)',
                    lineHeight: 1.5,
                    overflowX: 'auto',
                  }}
                >
                  <code>{activeDoc.codeSnippet.code}</code>
                </pre>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
