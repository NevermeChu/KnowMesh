import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { getRecentPaletteDocuments as getRecentPaletteDocumentsFunction } from '@/features/search/server/GetRecentPaletteDocuments';
import type { searchWorkspaceContent as searchWorkspaceContentFunction } from '@/features/search/server/SearchWorkspaceContent';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let searchWorkspaceContent: typeof searchWorkspaceContentFunction;
let getRecentPaletteDocuments: typeof getRecentPaletteDocumentsFunction;

const workspaceId = '10000000-0000-4000-8000-000000000300';
const personalWorkspaceId = '10000000-0000-4000-8000-000000000301';
const memberProjectId = '20000000-0000-4000-8000-000000000300';
const otherProjectId = '20000000-0000-4000-8000-000000000301';
const personalProjectId = '20000000-0000-4000-8000-000000000302';
const directDocId = '30000000-0000-4000-8000-000000000300';
const bodyMatchDocId = '30000000-0000-4000-8000-000000000301';
const secretDocId = '30000000-0000-4000-8000-000000000302';
const personalDocId = '30000000-0000-4000-8000-000000000303';
const tieDocumentIds = [
  '30000000-0000-4000-8000-000000000410',
  '30000000-0000-4000-8000-000000000411',
  '30000000-0000-4000-8000-000000000412',
  '30000000-0000-4000-8000-000000000413',
  '30000000-0000-4000-8000-000000000414',
  '30000000-0000-4000-8000-000000000415',
];
const longBodyDocId = '30000000-0000-4000-8000-000000000420';
const titleOnlyDocId = '30000000-0000-4000-8000-000000000421';

const longBodyText = `${'a'.repeat(3000)} needlelong ${'b'.repeat(3000)} TAILMARKER99`;

let currentUserId = 'user_direct';

beforeAll(async () => {
  database = createTestPGlite();
  await executeMigrations(database, migrationFiles);

  await database.transaction(async (transaction) => {
    await transaction.query(`
      INSERT INTO "user" (id, name, email)
      VALUES
        ('user_owner', 'Owner', 'search_owner@example.com'),
        ('user_direct', 'Direct Member', 'search_direct@example.com'),
        ('user_wsonly', 'Workspace Only', 'search_wsonly@example.com')
    `);
    await transaction.query(`
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES
        ('${workspaceId}', 'team', 'Search Team', 'user_owner'),
        ('${personalWorkspaceId}', 'personal', 'Owner Personal', 'user_owner')
    `);
    await transaction.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES
        ('${workspaceId}', 'user_owner', 'owner'),
        ('${workspaceId}', 'user_direct', 'editor'),
        ('${workspaceId}', 'user_wsonly', 'viewer'),
        ('${personalWorkspaceId}', 'user_owner', 'owner')
    `);
    await transaction.query(`
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES
        ('${memberProjectId}', '${workspaceId}', 'Member Project', 'user_owner'),
        ('${otherProjectId}', '${workspaceId}', 'Secret Project', 'user_owner'),
        ('${personalProjectId}', '${personalWorkspaceId}', 'Personal Notes', 'user_owner')
    `);
    await transaction.query(`
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES
        ('${memberProjectId}', '${workspaceId}', 'user_owner', 'owner'),
        ('${memberProjectId}', '${workspaceId}', 'user_direct', 'editor'),
        ('${otherProjectId}', '${workspaceId}', 'user_owner', 'owner'),
        ('${personalProjectId}', '${personalWorkspaceId}', 'user_owner', 'owner')
    `);
    await transaction.query(`
      INSERT INTO documents (id, project_id, title, search_text, created_by_id)
      VALUES
        (
          '${directDocId}',
          '${memberProjectId}',
          'Alpha 设计文档',
          '讨论 alpha 与 quantum 密钥的落地方案',
          'user_owner'
        ),
        (
          '${bodyMatchDocId}',
          '${memberProjectId}',
          '评审记录',
          'alpha 仅出现在正文里',
          'user_owner'
        ),
        (
          '${secretDocId}',
          '${otherProjectId}',
          'Beta 机密规划',
          '机密 quantum 蓝图',
          'user_owner'
        ),
        (
          '${personalDocId}',
          '${personalProjectId}',
          'Personal 笔记',
          '个人 quantum 笔记',
          'user_owner'
        ),
        (
          '${longBodyDocId}',
          '${memberProjectId}',
          '长文正文匹配记录',
          '${longBodyText}',
          'user_owner'
        ),
        (
          '${titleOnlyDocId}',
          '${memberProjectId}',
          'needlelong 标题命中',
          'plain body text without the term',
          'user_owner'
        )
    `);
    await transaction.query(`
      INSERT INTO documents (id, project_id, title, search_text, created_by_id, updated_at)
      VALUES
        ${tieDocumentIds
          .map(
            (documentId) =>
              `('${documentId}', '${memberProjectId}', 'Tie 排序样本', 'pagetie 顺序验证正文', 'user_owner', TIMESTAMPTZ '2026-01-01 00:00:00+00')`,
          )
          .join(',\n        ')}
    `);
  });

  const testDb = drizzle(database, { schema });
  vi.doMock('server-only', () => ({}));
  vi.doMock('@/libs/DB', () => ({ db: testDb }));
  vi.doMock('@/features/auth/server/CurrentUser', () => ({
    // oxlint-disable-next-line eslint/require-await -- The mock follows the asynchronous auth API.
    requireUser: async () => ({ id: currentUserId }),
  }));

  ({ searchWorkspaceContent } = await import('@/features/search/server/SearchWorkspaceContent'));
  ({ getRecentPaletteDocuments } =
    await import('@/features/search/server/GetRecentPaletteDocuments'));
}, 30_000);

afterAll(async () => {
  vi.doUnmock('@/libs/DB');
  vi.doUnmock('@/features/auth/server/CurrentUser');
  vi.doUnmock('server-only');
  await database.close();
});

describe('search permission boundary', () => {
  it('returns only documents in projects with direct membership', async () => {
    currentUserId = 'user_direct';
    const results = await searchWorkspaceContent({ query: 'quantum' });

    expect(results.items.map((item) => item.documentId)).toStrictEqual([directDocId]);
    expect(results.totalCount).toBe(1);
  });

  it('hides non-member content from workspace-only viewers', async () => {
    currentUserId = 'user_wsonly';
    const results = await searchWorkspaceContent({ query: 'quantum' });

    expect(results.totalCount).toBe(0);
  });

  it('ranks exact title matches above body matches', async () => {
    currentUserId = 'user_direct';
    const results = await searchWorkspaceContent({ query: 'alpha' });

    expect(results.items.map((item) => item.documentId)).toStrictEqual([
      directDocId,
      bodyMatchDocId,
    ]);
    expect(results.items[0]?.snippet).toContain('alpha');
  });

  it('applies workspace kind filters for owners across both kinds', async () => {
    currentUserId = 'user_owner';

    const personal = await searchWorkspaceContent({ query: 'quantum', filter: 'personal' });
    expect(personal.items.map((item) => item.documentId)).toStrictEqual([personalDocId]);

    const team = await searchWorkspaceContent({ query: 'quantum', filter: 'team' });
    expect(team.totalCount).toBe(2);
  });

  it('reports pagination metadata without leaking rows across pages', async () => {
    currentUserId = 'user_direct';
    const firstPage = await searchWorkspaceContent({
      query: 'alpha',
      page: 1,
      pageSize: 1,
    });

    expect(firstPage).toMatchObject({ page: 1, pageSize: 1, totalCount: 2, totalPages: 2 });
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.items.map((item) => item.documentId)).toStrictEqual([directDocId]);

    const secondPage = await searchWorkspaceContent({
      query: 'alpha',
      page: 2,
      pageSize: 1,
    });
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.items.map((item) => item.documentId)).toStrictEqual([bodyMatchDocId]);
  });

  it('treats like wildcards as literal text through the real query path', async () => {
    currentUserId = 'user_direct';
    const results = await searchWorkspaceContent({ query: '%' });

    expect(results.totalCount).toBe(0);
  });

  it('hydrates recent palette documents only when still directly accessible', async () => {
    currentUserId = 'user_direct';
    const unknownId = '3fffffff-0000-4000-8000-000000000001';
    const hydrated = await getRecentPaletteDocuments({
      documentIds: [secretDocId, directDocId, unknownId],
    });

    expect(hydrated.map((item) => item.documentId)).toStrictEqual([directDocId]);
    expect(hydrated[0]?.projectName).toBe('Member Project');
  });
});

describe('search pagination ordering', () => {
  it('orders documents with tied score and update time by descending document id across pages', async () => {
    currentUserId = 'user_direct';
    const pageSize = 2;
    const collectedDocumentIds: string[] = [];
    const hasMoreFlags: boolean[] = [];

    for (let page = 1; page <= 3; page += 1) {
      const results = await searchWorkspaceContent({ page, pageSize, query: 'pagetie' });
      expect(results.totalCount).toBe(tieDocumentIds.length);
      expect(results.totalPages).toBe(3);
      collectedDocumentIds.push(...results.items.map((item) => item.documentId));
      hasMoreFlags.push(results.hasMore);
    }

    expect(collectedDocumentIds).toStrictEqual(tieDocumentIds.toReversed());
    expect(hasMoreFlags).toStrictEqual([true, true, false]);

    const repeatFirstPage = await searchWorkspaceContent({ page: 1, pageSize, query: 'pagetie' });
    expect(repeatFirstPage.items.map((item) => item.documentId)).toStrictEqual(
      collectedDocumentIds.slice(0, pageSize),
    );
  });

  it('returns an empty page when the requested page exceeds total pages', async () => {
    currentUserId = 'user_direct';
    const results = await searchWorkspaceContent({ page: 99, pageSize: 2, query: 'pagetie' });

    expect(results).toMatchObject({
      hasMore: false,
      items: [],
      page: 99,
      totalCount: tieDocumentIds.length,
      totalPages: 3,
    });
  });
});

describe('search snippet generation', () => {
  it('returns a bounded window around the first body match without shipping full text', async () => {
    currentUserId = 'user_direct';
    const results = await searchWorkspaceContent({ query: 'needlelong' });

    expect(results.items[0]?.documentId).toBe(titleOnlyDocId);
    const longBodyItem = results.items.find((item) => item.documentId === longBodyDocId);
    expect(longBodyItem?.snippet).toContain('needlelong');
    expect(longBodyItem?.snippet.startsWith('…')).toBe(true);
    expect(longBodyItem?.snippet.endsWith('…')).toBe(true);
    expect(longBodyItem?.snippet.length).toBeLessThanOrEqual(142);
    expect(JSON.stringify(results.items)).not.toContain('TAILMARKER99');
  });

  it('falls back to head-truncated body when only the title matches', async () => {
    currentUserId = 'user_direct';
    const results = await searchWorkspaceContent({ query: 'needlelong' });

    const titleOnlyItem = results.items.find((item) => item.documentId === titleOnlyDocId);
    expect(titleOnlyItem?.snippet).toBe('plain body text without the term');
  });
});
