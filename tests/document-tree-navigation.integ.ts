import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { getDocumentNavigationPath as getDocumentNavigationPathFunction } from '@/features/documents/server/GetDocumentNavigation';
import type { moveDocument as moveDocumentFunction } from '@/features/documents/server/MoveDocument';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let getDocumentNavigationPath: typeof getDocumentNavigationPathFunction;
let moveDocument: typeof moveDocumentFunction;

const userId = 'user_tree_navigator';

const workspaceId = '10000000-0000-4000-8000-00000000a000';
const navProjectId = '20000000-0000-4000-8000-00000000a001';
const deepProjectId = '20000000-0000-4000-8000-00000000a002';
const sourceProjectId = '20000000-0000-4000-8000-00000000a003';
const targetProjectId = '20000000-0000-4000-8000-00000000a004';
const bigProjectId = '20000000-0000-4000-8000-00000000a005';

const navRootId = '3a000000-0000-4000-8000-00000000a001';
const navMidId = '3a000000-0000-4000-8000-00000000a002';
const navLeafId = '3a000000-0000-4000-8000-00000000a003';
const navLeafChildId = '3a000000-0000-4000-8000-00000000a004';

const cycleFirstId = '3a000000-0000-4000-8000-00000000b001';
const cycleSecondId = '3a000000-0000-4000-8000-00000000b002';
const cycleThirdId = '3a000000-0000-4000-8000-00000000b003';

const movedDocumentId = '3b000000-0000-4000-8000-00000000a001';
const movedChildOneId = '3b000000-0000-4000-8000-00000000a002';
const movedChildTwoId = '3b000000-0000-4000-8000-00000000a003';
const movedGrandchildId = '3b000000-0000-4000-8000-00000000a004';
const untouchedSiblingId = '3b000000-0000-4000-8000-00000000a009';

const oversizedMoverId = '3c000000-0000-4000-8000-00000000a001';

const crossLinkedOutsiderId = '3a000000-0000-4000-8000-00000000c001';

const formatDeepChainId = (index: number) =>
  `d0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

let currentUserId = userId;

beforeAll(async () => {
  database = createTestPGlite();
  await executeMigrations(database, migrationFiles);

  await database.transaction(async (transaction) => {
    await transaction.query(`
      INSERT INTO "user" (id, name, email)
      VALUES ('${userId}', 'Tree Navigator', 'tree_navigator@example.com')
    `);
    await transaction.query(`
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES ('${workspaceId}', 'team', 'Tree Workspace', '${userId}')
    `);
    await transaction.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('${workspaceId}', '${userId}', 'owner')
    `);
    await transaction.query(`
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES
        ('${navProjectId}', '${workspaceId}', 'Nav Project', '${userId}'),
        ('${deepProjectId}', '${workspaceId}', 'Deep Project', '${userId}'),
        ('${sourceProjectId}', '${workspaceId}', 'Source Project', '${userId}'),
        ('${targetProjectId}', '${workspaceId}', 'Target Project', '${userId}'),
        ('${bigProjectId}', '${workspaceId}', 'Big Project', '${userId}')
    `);
    await transaction.query(`
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      SELECT id, '${workspaceId}', '${userId}', 'owner'
      FROM projects
      WHERE workspace_id = '${workspaceId}'
    `);

    await transaction.query(`
      INSERT INTO documents (id, project_id, parent_id, title, sort_order, created_by_id)
      VALUES
        ('${navRootId}', '${navProjectId}', NULL, '导航根', 1000, '${userId}'),
        ('${navMidId}', '${navProjectId}', '${navRootId}', '导航中层', 1000, '${userId}'),
        ('${navLeafId}', '${navProjectId}', '${navMidId}', '导航叶子', 1000, '${userId}'),
        ('${navLeafChildId}', '${navProjectId}', '${navLeafId}', '导航叶子子级', 1000, '${userId}'),
        ('${cycleFirstId}', '${navProjectId}', '${cycleSecondId}', '循环一', 9000, '${userId}'),
        ('${cycleSecondId}', '${navProjectId}', '${cycleThirdId}', '循环二', 9000, '${userId}'),
        ('${cycleThirdId}', '${navProjectId}', '${cycleFirstId}', '循环三', 9000, '${userId}'),
        ('${movedDocumentId}', '${sourceProjectId}', NULL, '移动根', 1000, '${userId}'),
        ('${movedChildOneId}', '${sourceProjectId}', '${movedDocumentId}', '移动子一', 2000, '${userId}'),
        ('${movedChildTwoId}', '${sourceProjectId}', '${movedDocumentId}', '移动子二', 2500, '${userId}'),
        ('${movedGrandchildId}', '${sourceProjectId}', '${movedChildOneId}', '移动孙级', 3000, '${userId}'),
        ('${untouchedSiblingId}', '${sourceProjectId}', NULL, '未移动同级', 5000, '${userId}'),
        ('${oversizedMoverId}', '${bigProjectId}', NULL, '超限移动根', 1000, '${userId}'),
        (
          '${crossLinkedOutsiderId}',
          '${navProjectId}',
          '${movedChildTwoId}',
          '跨项目脏指针',
          9500,
          '${userId}'
        );
    `);

    await transaction.query(`
      INSERT INTO documents (id, project_id, parent_id, title, sort_order, created_by_id)
      SELECT
        ('d0000000-0000-4000-8000-' || lpad(series.i::text, 12, '0'))::uuid,
        '${deepProjectId}',
        CASE
          WHEN series.i = 1 THEN NULL
          ELSE ('d0000000-0000-4000-8000-' || lpad((series.i - 1)::text, 12, '0'))::uuid
        END,
        '深度链 ' || series.i,
        1000,
        '${userId}'
      FROM generate_series(1, 101) AS series(i);
    `);

    await transaction.query(`
      INSERT INTO documents (id, project_id, parent_id, title, created_by_id)
      SELECT
        ('3c100000-0000-4000-8000-' || lpad(series.i::text, 12, '0'))::uuid,
        '${bigProjectId}',
        '${oversizedMoverId}',
        '超限子树 ' || series.i,
        '${userId}'
      FROM generate_series(1, 10001) AS series(i);
    `);
  });

  const testDb = drizzle(database, { schema });
  vi.doMock('server-only', () => ({}));
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
  vi.doMock('@/libs/DB', () => ({ db: testDb }));
  vi.doMock('@/features/auth/server/CurrentUser', () => ({
    // oxlint-disable-next-line eslint/require-await -- The mock follows the asynchronous auth API.
    requireUser: async () => ({ id: currentUserId }),
  }));

  ({ getDocumentNavigationPath } =
    await import('@/features/documents/server/GetDocumentNavigation'));
  ({ moveDocument } = await import('@/features/documents/server/MoveDocument'));
}, 30_000);

afterAll(async () => {
  vi.doUnmock('@/libs/DB');
  vi.doUnmock('@/features/auth/server/CurrentUser');
  vi.doUnmock('next/cache');
  vi.doUnmock('server-only');
  await database.close();
});

describe('document navigation path queries', () => {
  it('returns the complete ancestor chain from root to selected document', async () => {
    currentUserId = userId;

    const midPath = await getDocumentNavigationPath({
      documentId: navLeafChildId,
      projectId: navProjectId,
    });

    expect(midPath?.map((item) => item.id)).toStrictEqual([
      navRootId,
      navMidId,
      navLeafId,
      navLeafChildId,
    ]);
    expect(midPath?.map((item) => item.hasChildren)).toStrictEqual([true, true, true, false]);

    const branchPath = await getDocumentNavigationPath({
      documentId: navLeafId,
      projectId: navProjectId,
    });
    expect(branchPath?.map((item) => [item.id, item.hasChildren])).toStrictEqual([
      [navRootId, true],
      [navMidId, true],
      [navLeafId, true],
    ]);
  });

  it('returns null when the document belongs to another project', async () => {
    currentUserId = userId;
    const path = await getDocumentNavigationPath({
      documentId: movedDocumentId,
      projectId: navProjectId,
    });

    expect(path).toBeNull();
  });

  it('rejects cyclic ancestor chains with an error', async () => {
    currentUserId = userId;

    await expect(
      getDocumentNavigationPath({ documentId: cycleFirstId, projectId: navProjectId }),
    ).rejects.toThrow('文档导航层级存在循环或超过最大深度');
  });

  it('accepts chains at the maximum depth and rejects longer chains', async () => {
    currentUserId = userId;

    const maxDepthPath = await getDocumentNavigationPath({
      documentId: formatDeepChainId(100),
      projectId: deepProjectId,
    });
    expect(maxDepthPath).toHaveLength(100);
    expect(maxDepthPath?.at(0)?.id).toBe(formatDeepChainId(1));
    expect(maxDepthPath?.at(-1)?.id).toBe(formatDeepChainId(100));

    await expect(
      getDocumentNavigationPath({ documentId: formatDeepChainId(101), projectId: deepProjectId }),
    ).rejects.toThrow('文档导航层级存在循环或超过最大深度');
  });
});

describe('cross-project document moves', () => {
  it('updates every descendant into the target project within one transaction', async () => {
    currentUserId = userId;

    const moved = await moveDocument({
      documentId: movedDocumentId,
      targetParentId: null,
      targetProjectId,
    });
    expect(moved.projectId).toBe(targetProjectId);

    const movedRows = await database.query<{ id: string; project_id: string; sort_order: number }>(`
      SELECT id, project_id::text, sort_order
      FROM documents
      WHERE id IN (
        '${movedDocumentId}',
        '${movedChildOneId}',
        '${movedChildTwoId}',
        '${movedGrandchildId}',
        '${untouchedSiblingId}',
        '${crossLinkedOutsiderId}'
      );
    `);
    const projectById = new Map(movedRows.rows.map((row) => [row.id, row]));
    expect(projectById.get(movedDocumentId)?.project_id).toBe(targetProjectId);
    expect(projectById.get(movedChildOneId)?.project_id).toBe(targetProjectId);
    expect(projectById.get(movedChildTwoId)?.project_id).toBe(targetProjectId);
    expect(projectById.get(movedGrandchildId)?.project_id).toBe(targetProjectId);
    expect(projectById.get(movedGrandchildId)?.sort_order).toBe(3000);
    expect(projectById.get(untouchedSiblingId)?.project_id).toBe(sourceProjectId);
    expect(projectById.get(crossLinkedOutsiderId)?.project_id).toBe(navProjectId);
  });

  it('rejects oversized subtrees without partial updates', async () => {
    currentUserId = userId;

    await expect(
      moveDocument({ documentId: oversizedMoverId, targetParentId: null, targetProjectId }),
    ).rejects.toThrow('移动的文档子树规模超过限制');

    const counts = await database.query<{ big_count: number; moved_count: number }>(`
      SELECT
        (SELECT count(*)::int FROM documents WHERE project_id = '${bigProjectId}') AS big_count,
        (
          SELECT count(*)::int FROM documents
          WHERE project_id = '${targetProjectId}' AND title LIKE '超限子树%'
        ) AS moved_count;
    `);
    expect(counts.rows[0]?.big_count).toBe(10_002);
    expect(counts.rows[0]?.moved_count).toBe(0);
  });
});
