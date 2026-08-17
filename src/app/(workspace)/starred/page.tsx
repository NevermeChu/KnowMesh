import { FileText, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { EmptyState } from '@/components/ui/EmptyState';
import { StarDocumentButton } from '@/features/documents/components/StarDocumentButton';
import { getStarredDocuments } from '@/features/documents/server/StarredDocuments';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  description: '快速访问你标记的重要文档与常用知识。',
  title: `收藏 - ${AppConfig.name}`,
};

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
});

export default async function StarredPage() {
  const starredDocuments = await getStarredDocuments();

  return (
    <WorkspaceContent className="py-10 sm:py-14">
      <header className="border-b border-line pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">已收藏文档</h1>
        <p className="mt-1 text-sm text-ink-muted">快速访问你标记的重要文档与常用知识。</p>
      </header>

      {starredDocuments.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            description="在文档页面点击星标按钮，即可将常用文档收藏至此处。"
            icon={<Star aria-hidden="true" className="size-5" strokeWidth={1.6} />}
            title="暂无收藏文档"
          />
        </div>
      ) : (
        <div className="mt-8">
          <ul className="divide-y divide-line-soft rounded-xl border border-line bg-card shadow-card">
            {starredDocuments.map((document) => (
              <li
                key={document.documentId}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-overlay"
              >
                <Link
                  href={`/${document.workspaceKind === 'personal' ? 'personal' : 'collaboration'}?project=${document.projectId}&document=${document.documentId}`}
                  className="flex min-w-0 flex-1 items-center gap-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400">
                    <FileText aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {document.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                      <span>{document.projectName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{document.workspaceKind === 'personal' ? '个人空间' : '团队协作'}</span>
                    </span>
                  </span>
                  <time
                    className="hidden shrink-0 text-xs text-ink-faint sm:block"
                    dateTime={document.updatedAt.toISOString()}
                  >
                    更新于 {dateTimeFormatter.format(document.updatedAt)}
                  </time>
                </Link>
                <div className="shrink-0">
                  <StarDocumentButton documentId={document.documentId} initialIsStarred={true} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </WorkspaceContent>
  );
}
