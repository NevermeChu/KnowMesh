'use client';

import { useState } from 'react';
import { escapeRegularExpression } from '@/utils/RegularExpression';

type SearchItem = {
  date: string;
  project: string;
  snippet: string;
  title: string;
};

const searchDatabase: SearchItem[] = [
  {
    date: '2026-08-18',
    project: '核心产研项目',
    snippet: '在团队工作区中，用户通过权限继承树获得相应能力。项目所有者角色不可修改或移除...',
    title: '0004: 基于能力模型与协作继承的权限架构',
  },
  {
    date: '2026-08-18',
    project: '技术基础设施',
    snippet:
      '使用 Better Auth 替代外部云服务，数据存储在本地 PostgreSQL，实现完全的 Session 自治...',
    title: '0009: 采用 Better Auth 实现本地化自主认证与会话管理',
  },
  {
    date: '2026-08-16',
    project: '编辑器核心',
    snippet:
      '支持 Callout、Details 折叠块、Task List 待办项与高亮代码块，并按兼容规则导出为标准 Markdown...',
    title: 'ProseMirror 块级富文本与 Markdown 导出引擎',
  },
  {
    date: '2026-08-17',
    project: '测试与持续集成',
    snippet: '使用 PGlite 提供毫秒级内存 Postgres 实例，严格校验复合外键与级联删除约束...',
    title: 'PGlite 嵌入式数据库与 Owner 不变量集成测试',
  },
];

/**
 * Highlights matched query substring with styled mark.
 *
 * @param props - Query and text string.
 * @returns React element with highlighted tokens.
 */
function HighlightSnippet(props: { query: string; text: string }) {
  if (!props.query.trim()) {
    return <span>{props.text}</span>;
  }

  const normalizedQuery = props.query.trim();
  const escapedQuery = escapeRegularExpression(normalizedQuery);
  const parts = props.text.split(new RegExp(`(${escapedQuery})`, 'giu'));

  return (
    <span>
      {parts.map((part, index) =>
        part.toLowerCase() === normalizedQuery.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              fontWeight: 700,
              padding: '0.1rem 0.25rem',
              borderRadius: '0.25rem',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  );
}

/**
 * Interactive fulltext search simulator demonstrating context-aware snippet extraction.
 *
 * @returns The interactive search simulator component.
 */
export function InteractiveSearchSimulator() {
  const [query, setQuery] = useState('权限');

  const filtered = searchDatabase.filter((item) => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.snippet.toLowerCase().includes(q) ||
      item.project.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        maxWidth: '860px',
        width: '100%',
        margin: '0 auto',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: '1.25rem',
        padding: '2rem',
        boxShadow: 'var(--shadow-overlay)',
      }}
    >
      {/* Live Search Input */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <svg
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '1.125rem',
            height: '1.125rem',
            color: 'var(--ink-faint)',
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          aria-label="搜索文档关键词"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="输入关键词（如：权限、ADR、Better Auth、Markdown、PGlite）..."
          className="search-mock-input"
        />
      </div>

      {/* Search Result Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              color: 'var(--ink-faint)',
              fontSize: '0.875rem',
            }}
          >
            未找到与 “{query}” 相关的文档结果
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.title}
              style={{
                padding: '1rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--line)',
                background: 'var(--canvas)',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}
              className="hover:border-accent"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.25rem',
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--ink)',
                  }}
                >
                  <HighlightSnippet text={item.title} query={query} />
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>{item.date}</span>
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  marginBottom: '0.35rem',
                }}
              >
                📂 {item.project}
              </div>
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--ink-muted)',
                  lineHeight: 1.5,
                }}
              >
                <HighlightSnippet text={item.snippet} query={query} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
