'use client';

import {
  ArrowRight,
  Bell,
  Clock,
  FileText,
  Home,
  Keyboard,
  Loader2,
  Maximize2,
  Moon,
  Search,
  SlidersHorizontal,
  Star,
  Sun,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { OPEN_COMMAND_PALETTE_EVENT, toggleZenMode } from '@/components/layout/ShellEvents';
import { openShortcutsHelp } from '@/components/ui/ShortcutsHelpDialog';
import { applyThemePreference } from '@/features/preferences/components/ApplyThemePreference';
import { isUserThemePreference } from '@/features/preferences/Preferences';
import { updateThemePreference } from '@/features/preferences/server/UpdateThemePreference';
import type { SearchFilter, SearchResultItem } from '../Search';
import { searchWorkspaceContent } from '../server/SearchWorkspaceContent';

const RECENT_DOCS_KEY = 'knowmesh:recent-documents';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSearchResultItem(item: unknown): item is SearchResultItem {
  if (!isRecord(item)) {
    return false;
  }
  return (
    typeof item.documentId === 'string' &&
    typeof item.projectId === 'string' &&
    typeof item.projectName === 'string' &&
    typeof item.title === 'string'
  );
}

function getStoredRecentDocs(): SearchResultItem[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(RECENT_DOCS_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(isSearchResultItem);
    }
    return [];
  } catch {
    return [];
  }
}

function persistRecentDoc(item: SearchResultItem) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    const existing = getStoredRecentDocs().filter((doc) => doc.documentId !== item.documentId);
    const updated = [item, ...existing].slice(0, 4);
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

type PaletteActionItem = {
  description?: string;
  href?: string;
  icon: React.ReactNode;
  id: string;
  onSelect?: () => void;
  title: string;
};

const filterTabs: { label: string; value: SearchFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '个人空间', value: 'personal' },
  { label: '团队协作', value: 'team' },
];

function SearchTrailingElement(props: {
  isSearching: boolean;
  onClear: () => void;
  query: string;
}) {
  if (props.isSearching) {
    return (
      <Loader2 aria-hidden="true" className="size-4 animate-spin text-accent" strokeWidth={2} />
    );
  }

  if (props.query) {
    return (
      <button
        type="button"
        aria-label="清除搜索"
        className="grid size-6 place-items-center rounded-md text-ink-faint transition-colors hover:text-ink"
        onClick={props.onClear}
      >
        <X aria-hidden="true" className="size-4" strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-faint sm:inline-block">
      ESC
    </kbd>
  );
}

function PaletteSearchResults(props: {
  onSelect: (result: SearchResultItem) => void;
  results: SearchResultItem[];
  selectedIndex: number;
}) {
  return (
    <ul className="space-y-1">
      {props.results.map((result, idx) => {
        const isSelected = props.selectedIndex === idx;

        return (
          <li key={result.documentId}>
            <button
              type="button"
              aria-label={`打开文档 ${result.title}`}
              className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors ${
                isSelected ? 'bg-accent-soft text-accent' : 'hover:bg-overlay'
              }`}
              onClick={() => {
                props.onSelect(result);
              }}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                  isSelected ? 'bg-accent text-white' : 'bg-surface text-ink-muted'
                }`}
              >
                <FileText aria-hidden="true" className="size-4" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{result.title}</span>
                  <span className="shrink-0 text-[11px] text-ink-faint">
                    {result.projectName} · {result.workspaceKind === 'personal' ? '个人' : '团队'}
                  </span>
                </span>
                {result.snippet && (
                  <span className="mt-1 block truncate text-xs text-ink-muted">
                    {result.snippet}
                  </span>
                )}
              </span>
              {isSelected && (
                <ArrowRight
                  aria-hidden="true"
                  className="mt-2 size-4 shrink-0 text-accent"
                  strokeWidth={2}
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PaletteSuggestions(props: {
  actions: PaletteActionItem[];
  navigations: PaletteActionItem[];
  onSelectAction: (item: PaletteActionItem) => void;
  onSelectRecent: (item: SearchResultItem) => void;
  recentDocs: SearchResultItem[];
  selectedIndex: number;
}) {
  const recentCount = props.recentDocs.length;
  const navOffset = recentCount;
  const actionOffset = recentCount + props.navigations.length;

  return (
    <div className="space-y-4 p-1">
      {recentCount > 0 && (
        <div>
          <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
            最近访问
          </div>
          <ul className="space-y-0.5">
            {props.recentDocs.map((item, idx) => {
              const isSelected = props.selectedIndex === idx;

              return (
                <li key={item.documentId}>
                  <button
                    type="button"
                    aria-label={`打开文档 ${item.title}`}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-accent-soft font-medium text-accent'
                        : 'text-ink-secondary hover:bg-overlay hover:text-ink'
                    }`}
                    onClick={() => {
                      props.onSelectRecent(item);
                    }}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-md ${
                        isSelected ? 'bg-accent text-white' : 'bg-surface text-ink-muted'
                      }`}
                    >
                      <Clock aria-hidden="true" className="size-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="text-xs text-ink-faint">
                      {item.projectName} · {item.workspaceKind === 'personal' ? '个人' : '团队'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
          快捷导航
        </div>
        <ul className="space-y-0.5">
          {props.navigations.map((item, idx) => {
            const isSelected = props.selectedIndex === navOffset + idx;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={`前往 ${item.title}`}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-ink-secondary hover:bg-overlay hover:text-ink'
                  }`}
                  onClick={() => {
                    props.onSelectAction(item);
                  }}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-md ${
                      isSelected ? 'bg-accent text-white' : 'bg-surface text-ink-muted'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="text-xs text-ink-faint">{item.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
          快捷动作
        </div>
        <ul className="space-y-0.5">
          {props.actions.map((item, idx) => {
            const isSelected = props.selectedIndex === actionOffset + idx;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={`执行操作 ${item.title}`}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent-soft font-medium text-accent'
                      : 'text-ink-secondary hover:bg-overlay hover:text-ink'
                  }`}
                  onClick={() => {
                    props.onSelectAction(item);
                  }}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-md ${
                      isSelected ? 'bg-accent text-white' : 'bg-surface text-ink-muted'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="text-xs text-ink-faint">{item.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Global command palette dialog supporting keyboard shortcuts (Cmd+K / Ctrl+K),
 * debounced document search, quick navigation, recent history, and shortcuts help.
 *
 * @returns The command palette modal portal.
 */
export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [recentDocs, setRecentDocs] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [, startTransition] = useTransition();
  const searchRequestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleTheme = () => {
    const root = document.documentElement;
    const previousPreference = isUserThemePreference(root.dataset.theme)
      ? root.dataset.theme
      : 'system';
    const nextTheme = root.classList.contains('dark') ? 'light' : 'dark';

    applyThemePreference(nextTheme);
    startTransition(async () => {
      try {
        await updateThemePreference({ theme: nextTheme });
      } catch {
        applyThemePreference(previousPreference);
      }
    });
  };

  const quickNavigations: PaletteActionItem[] = [
    {
      description: '概览仪表盘与最近文档',
      href: '/dashboard',
      icon: <Home aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'nav-dashboard',
      title: '首页',
    },
    {
      description: '个人笔记与私有资料',
      href: '/personal',
      icon: <FileText aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'nav-personal',
      title: '个人知识库',
    },
    {
      description: '团队项目与多人协作文档',
      href: '/collaboration',
      icon: <Users aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'nav-collaboration',
      title: '团队协作区',
    },
    {
      description: '快速访问已星标的文档',
      href: '/starred',
      icon: <Star aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'nav-starred',
      title: '已收藏文档',
    },
    {
      description: '查看权限申请与系统动态',
      href: '/notifications',
      icon: <Bell aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'nav-notifications',
      title: '通知中心',
    },
    {
      description: '界面外观与排版参数',
      href: '/settings/preferences',
      icon: <SlidersHorizontal aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'nav-preferences',
      title: '系统偏好设置',
    },
    {
      description: '个人身份与安全配置',
      href: '/settings/user-profile',
      icon: <UserRound aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'nav-profile',
      title: '账号设置',
    },
  ];

  const quickActions: PaletteActionItem[] = [
    {
      description: '切换浅色 / 深色界面模式',
      icon: (
        <>
          <Moon aria-hidden="true" className="size-4 dark:hidden" strokeWidth={1.8} />
          <Sun aria-hidden="true" className="hidden size-4 dark:block" strokeWidth={1.8} />
        </>
      ),
      id: 'action-theme-toggle',
      onSelect: toggleTheme,
      title: '切换界面主题',
    },
    {
      description: '快捷键 ⌘⇧F，隐藏侧边栏专注阅读与写作',
      icon: <Maximize2 aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'action-zen-mode',
      onSelect: () => {
        toggleZenMode();
      },
      title: '切换全屏专注模式',
    },
    {
      description: '查看全部键盘快捷键速查表 (⌘/)',
      icon: <Keyboard aria-hidden="true" className="size-4" strokeWidth={1.8} />,
      id: 'action-shortcuts-help',
      onSelect: () => {
        openShortcutsHelp();
      },
      title: '键盘快捷键指南',
    },
  ];

  // Listen for Cmd+K / Ctrl+K and custom event
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleCustomOpen);
    };
  }, []);

  // Reset query, load stored recents and focus input upon opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setRecentDocs(getStoredRecentDocs());
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Debounced search when query or filter changes
  useEffect(() => {
    const trimmedQuery = query.trim();
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (trimmedQuery) {
      const currentReqId = searchRequestId.current + 1;
      searchRequestId.current = currentReqId;
      setIsSearching(true);

      timer = setTimeout(async () => {
        try {
          const data = await searchWorkspaceContent({
            filter: filter === 'all' ? undefined : filter,
            query: trimmedQuery,
          });

          if (searchRequestId.current === currentReqId) {
            setResults(data);
            setIsSearching(false);
            setSelectedIndex(0);
          }
        } catch {
          if (searchRequestId.current === currentReqId) {
            setResults([]);
            setIsSearching(false);
          }
        }
      }, 180);
    } else {
      setResults([]);
      setIsSearching(false);
      setSelectedIndex(0);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [query, filter]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const isQueryMode = query.trim().length > 0;
  const totalItemsCount = isQueryMode
    ? results.length
    : recentDocs.length + quickNavigations.length + quickActions.length;

  const handleSelectResult = (result: SearchResultItem) => {
    persistRecentDoc(result);
    setIsOpen(false);
    const targetHref = `/${result.workspaceKind === 'personal' ? 'personal' : 'collaboration'}?project=${result.projectId}&document=${result.documentId}`;
    router.push(targetHref);
  };

  const handleSelectAction = (action: PaletteActionItem) => {
    setIsOpen(false);
    if (action.href) {
      router.push(action.href);
    } else if (action.onSelect) {
      action.onSelect();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (totalItemsCount > 0) {
        setSelectedIndex((prev) => (prev + 1) % totalItemsCount);
      } else {
        setSelectedIndex(0);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (totalItemsCount > 0) {
        setSelectedIndex((prev) => (prev - 1 + totalItemsCount) % totalItemsCount);
      } else {
        setSelectedIndex(0);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (isQueryMode) {
        const item = results[selectedIndex];
        if (item) {
          handleSelectResult(item);
        }
      } else if (selectedIndex < recentDocs.length) {
        const item = recentDocs[selectedIndex];
        if (item) {
          handleSelectResult(item);
        }
      } else {
        const combined = [...quickNavigations, ...quickActions];
        const item = combined[selectedIndex - recentDocs.length];
        if (item) {
          handleSelectAction(item);
        }
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-80 flex items-start justify-center p-4 pt-16 sm:p-6 sm:pt-24">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="关闭快捷指令面板"
        className="animate-overlay-in absolute inset-0 size-full cursor-default bg-black/45 backdrop-blur-[3px]"
        onClick={() => {
          setIsOpen(false);
        }}
      />

      {/* Dialog Surface */}
      <dialog
        open
        aria-modal="true"
        aria-label="快捷指令面板"
        className="animate-modal-in relative z-10 flex max-h-[min(82vh,38rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-card p-0 text-ink shadow-overlay"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="relative flex items-center border-b border-line px-4 py-3">
          <Search aria-hidden="true" className="size-5 shrink-0 text-ink-muted" strokeWidth={1.8} />
          <input
            ref={inputRef}
            type="search"
            aria-label="搜索文档或输入指令"
            value={query}
            placeholder="搜索文档正文、标题，或输入指令…"
            className="ml-3 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <SearchTrailingElement
            isSearching={isSearching}
            query={query}
            onClear={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 border-b border-line-soft bg-surface/50 px-4 py-2 text-xs">
          <span className="text-[11px] font-medium text-ink-faint">筛选范围:</span>
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={filter === tab.value}
              className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
                filter === tab.value
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:bg-overlay hover:text-ink'
              }`}
              onClick={() => {
                setFilter(tab.value);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Result & Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {isQueryMode && results.length === 0 && !isSearching && (
            <div className="py-12 text-center text-sm text-ink-muted">
              未找到与“<span className="font-semibold text-ink">{query}</span>”相关的文档
            </div>
          )}

          {isQueryMode && results.length > 0 && (
            <PaletteSearchResults
              onSelect={handleSelectResult}
              results={results}
              selectedIndex={selectedIndex}
            />
          )}

          {!isQueryMode && (
            <PaletteSuggestions
              actions={quickActions}
              navigations={quickNavigations}
              onSelectAction={handleSelectAction}
              onSelectRecent={handleSelectResult}
              recentDocs={recentDocs}
              selectedIndex={selectedIndex}
            />
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="flex items-center justify-between border-t border-line bg-surface/30 px-4 py-2 text-[11px] text-ink-faint">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-card px-1 py-0.5 font-sans">↑</kbd>
              <kbd className="rounded border border-line bg-card px-1 py-0.5 font-sans">↓</kbd>
              <span>导航</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line bg-card px-1 py-0.5 font-sans">↵</kbd>
              <span>选择</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line bg-card px-1 py-0.5 font-sans">ESC</kbd>
            <span>关闭</span>
          </span>
        </div>
      </dialog>
    </div>,
    document.body,
  );
}
