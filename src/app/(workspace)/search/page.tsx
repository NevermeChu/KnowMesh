import type { Metadata } from 'next';
import { WorkspaceContent } from '@/components/layout/WorkspaceContent';
import { SearchInterface } from '@/features/search/components/SearchInterface';
import type { SearchFilter } from '@/features/search/Search';
import { searchWorkspaceContent } from '@/features/search/server/SearchWorkspaceContent';
import { AppConfig } from '@/utils/AppConfig';

export const metadata: Metadata = {
  description: '在个人知识与团队协作内容中查找文档。',
  title: `搜索 - ${AppConfig.name}`,
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const getStringParam = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

const getPageParam = (value: string | string[] | undefined) => {
  if (typeof value !== 'string') {
    return 1;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
};

export default async function SearchPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const rawQuery = getStringParam(searchParams.q) ?? '';
  const rawFilter = getStringParam(searchParams.filter);
  const page = getPageParam(searchParams.page);
  const filter: SearchFilter = rawFilter === 'personal' || rawFilter === 'team' ? rawFilter : 'all';

  const results = rawQuery.trim()
    ? await searchWorkspaceContent({ filter, page, query: rawQuery })
    : {
        hasMore: false,
        items: [],
        page: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
      };

  return (
    <WorkspaceContent className="py-10 sm:py-14">
      <header className="border-b border-line pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">全站搜索</h1>
        <p className="mt-1 text-sm text-ink-muted">
          在个人知识空间与团队协作项目中查找文档与笔记。
        </p>
      </header>

      <div className="mt-8">
        <SearchInterface initialFilter={filter} initialQuery={rawQuery} results={results} />
      </div>
    </WorkspaceContent>
  );
}
