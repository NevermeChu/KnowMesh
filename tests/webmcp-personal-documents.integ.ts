import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  readPersonalDocument as readPersonalDocumentFunction,
  writePersonalDocument as writePersonalDocumentFunction,
} from '@/features/webmcp/server/PersonalDocumentTools';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let readPersonalDocument!: typeof readPersonalDocumentFunction;
let writePersonalDocument!: typeof writePersonalDocumentFunction;

const userId = 'webmcp-user';
const personalWorkspaceId = '10000000-0000-4000-8000-000000000081';
const teamWorkspaceId = '10000000-0000-4000-8000-000000000082';
const personalProjectId = '20000000-0000-4000-8000-000000000081';
const teamProjectId = '20000000-0000-4000-8000-000000000082';
const personalDocumentId = '30000000-0000-4000-8000-000000000081';
const teamDocumentId = '30000000-0000-4000-8000-000000000082';
const whiteboardDocumentId = '30000000-0000-4000-8000-000000000083';
const initialUpdatedAt = '2026-09-03T01:00:00.000Z';

describe('Personal WebMCP document boundary', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
    await database.exec(`
      BEGIN;
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES ('${userId}', 'WebMCP User', 'webmcp@example.com', true);
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES
        ('${personalWorkspaceId}', 'personal', 'Personal', '${userId}'),
        ('${teamWorkspaceId}', 'team', 'Team', '${userId}');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES
        ('${personalWorkspaceId}', '${userId}', 'owner'),
        ('${teamWorkspaceId}', '${userId}', 'owner');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES
        ('${personalProjectId}', '${personalWorkspaceId}', 'Personal project', '${userId}'),
        ('${teamProjectId}', '${teamWorkspaceId}', 'Team project', '${userId}');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES
        ('${personalProjectId}', '${personalWorkspaceId}', '${userId}', 'owner'),
        ('${teamProjectId}', '${teamWorkspaceId}', '${userId}', 'owner');
      INSERT INTO documents (id, project_id, title, content, search_text, created_by_id, updated_at)
      VALUES
        (
          '${personalDocumentId}',
          '${personalProjectId}',
          'Personal note',
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Original"}]}]}'::jsonb,
          'Original',
          '${userId}',
          '${initialUpdatedAt}'
        ),
        (
          '${teamDocumentId}',
          '${teamProjectId}',
          'Team note',
          '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
          '',
          '${userId}',
          '${initialUpdatedAt}'
        );
      INSERT INTO documents (id, kind, project_id, title, created_by_id)
      VALUES ('${whiteboardDocumentId}', 'whiteboard', '${personalProjectId}', 'Board', '${userId}');
      INSERT INTO document_whiteboard_states (document_id)
      VALUES ('${whiteboardDocumentId}');
      COMMIT;
    `);

    const testDb = drizzle(database, { schema });
    vi.doMock('server-only', () => ({}));
    vi.doMock('@/libs/DB', () => ({ db: testDb }));
    vi.doMock('@/features/auth/server/CurrentUser', () => ({
      // oxlint-disable-next-line eslint/require-await -- Mock follows the asynchronous auth API.
      requireUser: async () => ({ id: userId }),
    }));

    ({ readPersonalDocument, writePersonalDocument } =
      await import('@/features/webmcp/server/PersonalDocumentTools'));
  }, 30_000);

  afterAll(async () => {
    vi.doUnmock('@/features/auth/server/CurrentUser');
    vi.doUnmock('@/libs/DB');
    vi.doUnmock('server-only');
    await database.close();
  });

  it('reads one Personal rich-text document', async () => {
    const result = await readPersonalDocument({ documentId: personalDocumentId });

    expect(result).toMatchObject({
      contentSchemaVersion: 1,
      documentId: personalDocumentId,
      title: 'Personal note',
      updatedAt: initialUpdatedAt,
    });
  });

  it('rejects Team document reads', async () => {
    await expect(readPersonalDocument({ documentId: teamDocumentId })).rejects.toThrow(
      '没有权限执行该操作',
    );
  });

  it('rejects whiteboard document reads', async () => {
    await expect(readPersonalDocument({ documentId: whiteboardDocumentId })).rejects.toThrow(
      '没有权限执行该操作',
    );
  });

  it('writes one Personal document through optimistic concurrency', async () => {
    const content = {
      content: [{ content: [{ text: 'Updated', type: 'text' }], type: 'paragraph' }],
      type: 'doc',
    };
    const result = await writePersonalDocument({
      content,
      documentId: personalDocumentId,
      expectedUpdatedAt: initialUpdatedAt,
    });
    const rows = await database.query<{ content: typeof content; search_text: string }>(`
      SELECT content, search_text
      FROM documents
      WHERE id = '${personalDocumentId}'
    `);

    expect(result.status).toBe('saved');
    expect(rows.rows).toStrictEqual([{ content, search_text: 'Updated' }]);
  });

  it('rejects stale Personal document writes', async () => {
    const result = await writePersonalDocument({
      content: { content: [{ type: 'paragraph' }], type: 'doc' },
      documentId: personalDocumentId,
      expectedUpdatedAt: initialUpdatedAt,
    });

    expect(result).toStrictEqual({ status: 'conflict' });
  });

  it('rejects Team document writes', async () => {
    await expect(
      writePersonalDocument({
        content: { content: [{ type: 'paragraph' }], type: 'doc' },
        documentId: teamDocumentId,
        expectedUpdatedAt: initialUpdatedAt,
      }),
    ).rejects.toThrow('没有权限执行该操作');
  });
});
