'use client';

import { FileText, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { escapeRegularExpression } from '@/utils/RegularExpression';
import type { SearchFilter, SearchResultItem } from '../Search';

const filterLabels: { label: string; value: SearchFilter }[] = [
  { label: '全部空间', value: 'all' },
  { label: '个人空间', value: 'personal' },
  { label: '团队协作', value: 'team' },
];

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
});

/**
 * Highlights matches of the query inside a text string.
 *
 * @param props - Query string and target text.
 * @returns The highlighted text span.
 */
function HighlightedText(props: { query: string; text: string }) {
  const normalizedQuery = props.query.trim();

  if (!normalizedQuery || !props.text) {
    return <span>{props.text}</span>;
  }

  const escapedQuery = escapeRegularExpression(normalizedQuery);
  const parts = props.text.split(new RegExp(`(${escapedQuery})`, 'giu'));

  return (
    <span>
      {parts.map((part, index) =>
        part.toLowerCase() === normalizedQuery.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded-xs bg-amber-500/20 px-0.5 font-medium text-ink dark:bg-amber-400/25"
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
 * Renders search results or corresponding empty states.
 *
 * @param props - Search state and result items.
 * @returns The search content block.
 */
function SearchResultsSection(props: {
  hasSearched: boolean;
  initialQuery: string;
  results: SearchResultItem[];
}) {
  if (!props.hasSearched) {
    return (
      <div className="mt-12">
        <EmptyState
          description="输入关键词并在全部或指定空间中查找文档内容。"
          icon={<Search aria-hidden="true" className="size-5" strokeWidth={1.6} />}
          title="开始搜索"
        />
      </div>
    );
  }

  if (props.results.length === 0) {
    return (
      <div className="mt-12">
        <EmptyState
          description="尝试更换搜索关键词，或切换空间筛选范围。"
          icon={<Search aria-hidden="true" className="size-5" strokeWidth={1.6} />}
          title={`未找到与“${props.initialQuery}”相关的文档`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-ink-faint">
        找到 <span className="font-semibold text-ink">{props.results.length}</span> 篇相关文档
      </p>

      <ul className="divide-y divide-line-soft rounded-xl border border-line bg-card shadow-card">
        {props.results.map((result) => (
          <li key={result.documentId}>
            <Link
              href={`/${result.workspaceKind === 'personal' ? 'personal' : 'collaboration'}?project=${result.projectId}&document=${result.documentId}`}
              className="block p-4 transition-colors hover:bg-overlay"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                    <FileText aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  </span>
                  <h2 className="truncate text-sm font-semibold text-ink">
                    <HighlightedText query={props.initialQuery} text={result.title} />
                  </h2>
                </div>
                <time
                  className="shrink-0 text-xs text-ink-faint"
                  dateTime={result.updatedAt.toISOString()}
                >
                  {dateTimeFormatter.format(result.updatedAt)}
                </time>
              </div>

              {result.snippet && (
                <p className="mt-2 text-xs leading-5 text-ink-muted">
                  <HighlightedText query={props.initialQuery} text={result.snippet} />
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                <span className="rounded bg-surface px-1.5 py-0.5 font-medium text-ink-secondary">
                  {result.projectName}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {result.workspaceKind === 'personal'
                    ? '个人空间'
                    : `团队: ${result.workspaceName}`}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Interactive search interface component supporting keyword query, scope filter, and direct navigation.
 *
 * @param props - Current query, filter, and search results.
 * @returns The search UI.
 */
export function SearchInterface(props: {
  initialFilter: SearchFilter;
  initialQuery: string;
  results: SearchResultItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(props.initialQuery);
  const [filter, setFilter] = useState<SearchFilter>(props.initialFilter);
  const [isPending, startTransition] = useTransition();

  const updateSearchUrl = (nextQuery: string, nextFilter: SearchFilter) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextQuery.trim()) {
      params.set('q', nextQuery.trim());
    } else {
      params.delete('q');
    }

    if (nextFilter && nextFilter !== 'all') {
      params.set('filter', nextFilter);
    } else {
      params.delete('filter');
    }

    startTransition(() => {
      router.replace(`/search${params.toString() ? `?${params.toString()}` : ''}`);
    });
  };

  const handleQuerySubmit = (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateSearchUrl(query, filter);
  };

  const handleFilterChange = (nextFilter: SearchFilter) => {
    setFilter(nextFilter);
    updateSearchUrl(query, nextFilter);
  };

  const handleClear = () => {
    setQuery('');
    updateSearchUrl('', filter);
  };

  const hasSearched = props.initialQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      <form onSubmit={handleQuerySubmit} className="relative">
        <div className="relative flex items-center">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 size-4.5 text-ink-muted"
            strokeWidth={1.8}
          />
          <input
            type="search"
            aria-label="搜索文档与项目"
            className="h-11 w-full rounded-xl border border-line bg-card pr-10 pl-10 text-sm text-ink transition-colors outline-none placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="搜索文档标题或正文关键词…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="清除搜索词"
              className="absolute right-3 grid size-6 place-items-center rounded-md text-ink-faint transition-colors hover:text-ink"
              onClick={handleClear}
            >
              <X aria-hidden="true" className="size-4" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {filterLabels.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            disabled={isPending}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === item.value
                ? 'bg-accent text-white shadow-card'
                : 'border border-line bg-card text-ink-secondary hover:bg-overlay hover:text-ink'
            }`}
            onClick={() => {
              handleFilterChange(item.value);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <SearchResultsSection
        hasSearched={hasSearched}
        initialQuery={props.initialQuery}
        results={props.results}
      />
    </div>
  );
}
