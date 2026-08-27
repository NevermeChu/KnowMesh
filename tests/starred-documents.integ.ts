import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { setDocumentStarred as setDocumentStarredFunction } from '@/features/documents/server/StarredDocuments';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let setDocumentStarred!: typeof setDocumentStarredFunction;

const ownerId = 'user_star_owner';
const idempotentUserId = 'user_star_idempotent';
const unstarUserId = 'user_star_unstar';
const cascadeUserId = 'user_star_cascade';
const orphanUserId = 'user_star_orphan';
const workspaceId = '81000000-0000-4000-8000-000000000001';
const projectId = '82000000-0000-4000-8000-000000000001';
const documentId = '83000000-0000-4000-8000-000000000001';

let currentUserId = idempotentUserId;

beforeAll(async () => {
  database = createTestPGlite();
  await executeMigrations(database, migrationFiles.slice(0, -1));

  await database.exec(`
    INSERT INTO "user" (id, name, email)
    VALUES
      ('${ownerId}', 'Star Owner', 'star-owner@example.com'),
      ('${idempotentUserId}', 'Star Idempotent', 'star-idempotent@example.com'),
      ('${unstarUserId}', 'Star Unstar', 'star-unstar@example.com'),
      ('${cascadeUserId}', 'Star Cascade', 'star-cascade@example.com');

    INSERT INTO workspaces (id, kind, name, owner_id)
    VALUES ('${workspaceId}', 'team', 'Star Workspace', '${ownerId}');

    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES
      ('${workspaceId}', '${ownerId}', 'owner'),
      ('${workspaceId}', '${idempotentUserId}', 'viewer'),
      ('${workspaceId}', '${unstarUserId}', 'viewer'),
      ('${workspaceId}', '${cascadeUserId}', 'viewer');

    INSERT INTO projects (id, workspace_id, name, owner_id)
    VALUES ('${projectId}', '${workspaceId}', 'Star Project', '${ownerId}');

    INSERT INTO project_members (project_id, workspace_id, user_id, role)
    VALUES
      ('${projectId}', '${workspaceId}', '${ownerId}', 'owner'),
      ('${projectId}', '${workspaceId}', '${idempotentUserId}', 'viewer'),
      ('${projectId}', '${workspaceId}', '${unstarUserId}', 'viewer'),
      ('${projectId}', '${workspaceId}', '${cascadeUserId}', 'viewer');

    INSERT INTO documents (id, project_id, title, created_by_id)
    VALUES ('${documentId}', '${projectId}', 'Star Document', '${ownerId}');

    INSERT INTO starred_documents (user_id, document_id)
    VALUES
      ('${unstarUserId}', '${documentId}'),
      ('${cascadeUserId}', '${documentId}'),
      ('${orphanUserId}', '${documentId}');
  `);

  await executeMigrations(database, migrationFiles.slice(-1));

  const testDb = drizzle(database, { schema });
  vi.doMock('server-only', () => ({}));
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
  vi.doMock('@/libs/DB', () => ({ db: testDb }));
  vi.doMock('@/features/auth/server/CurrentUser', () => ({
    // oxlint-disable-next-line eslint/require-await -- The mock follows the asynchronous auth API.
    requireUser: async () => ({ id: currentUserId }),
  }));

  ({ setDocumentStarred } = await import('@/features/documents/server/StarredDocuments'));
});

afterAll(async () => {
  vi.doUnmock('@/features/auth/server/CurrentUser');
  vi.doUnmock('@/libs/DB');
  vi.doUnmock('next/cache');
  vi.doUnmock('server-only');
  await database.close();
});

describe(setDocumentStarred, () => {
  it('removes legacy orphan stars before enforcing the user foreign key', async () => {
    const count = await database.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM starred_documents
      WHERE user_id = '${orphanUserId}';
    `);
    expect(count.rows[0]?.count).toBe(0);

    await expect(
      database.exec(`
        INSERT INTO starred_documents (user_id, document_id)
        VALUES ('${orphanUserId}', '${documentId}');
      `),
    ).rejects.toThrow(/foreign key/iu);
  });

  it('keeps repeated concurrent star requests idempotent', async () => {
    currentUserId = idempotentUserId;

    const results = await Promise.all([
      setDocumentStarred({ documentId, isStarred: true }),
      setDocumentStarred({ documentId, isStarred: true }),
    ]);

    expect(results).toStrictEqual([{ isStarred: true }, { isStarred: true }]);
    const count = await database.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM starred_documents
      WHERE user_id = '${idempotentUserId}' AND document_id = '${documentId}';
    `);
    expect(count.rows[0]?.count).toBe(1);
  });

  it('keeps repeated concurrent unstar requests idempotent', async () => {
    currentUserId = unstarUserId;

    const results = await Promise.all([
      setDocumentStarred({ documentId, isStarred: false }),
      setDocumentStarred({ documentId, isStarred: false }),
    ]);

    expect(results).toStrictEqual([{ isStarred: false }, { isStarred: false }]);
    const count = await database.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM starred_documents
      WHERE user_id = '${unstarUserId}' AND document_id = '${documentId}';
    `);
    expect(count.rows[0]?.count).toBe(0);
  });

  it('cascades stars when a non-owner user is deleted', async () => {
    await database.exec(`DELETE FROM "user" WHERE id = '${cascadeUserId}';`);

    const state = await database.query<{ document_count: number; star_count: number }>(`
      SELECT
        (SELECT count(*)::int FROM documents WHERE id = '${documentId}') AS document_count,
        (
          SELECT count(*)::int
          FROM starred_documents
          WHERE user_id = '${cascadeUserId}' AND document_id = '${documentId}'
        ) AS star_count;
    `);
    expect(state.rows[0]).toStrictEqual({ document_count: 1, star_count: 0 });
  });
});
