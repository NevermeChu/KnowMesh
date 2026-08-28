import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { updatePersonalWhiteboard as updatePersonalWhiteboardFunction } from '@/features/whiteboards/server/UpdatePersonalWhiteboard';
import { EMPTY_WHITEBOARD_SCENE } from '@/features/whiteboards/WhiteboardScene';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let updatePersonalWhiteboard!: typeof updatePersonalWhiteboardFunction;

const userId = 'personal-whiteboard-owner';
const workspaceId = '10000000-0000-4000-8000-000000000035';
const teamWorkspaceId = '10000000-0000-4000-8000-000000000036';
const projectId = '20000000-0000-4000-8000-000000000035';
const teamProjectId = '20000000-0000-4000-8000-000000000036';
const whiteboardId = '30000000-0000-4000-8000-000000000035';
const teamWhiteboardId = '30000000-0000-4000-8000-000000000036';
const richTextId = '30000000-0000-4000-8000-000000000037';

const createScene = (background: string) => ({
  ...EMPTY_WHITEBOARD_SCENE,
  appState: { viewBackgroundColor: background },
  elements: [
    {
      height: 80,
      id: `rectangle-${background}`,
      isDeleted: false,
      type: 'rectangle',
      version: 1,
      versionNonce: 123,
      width: 120,
      x: 20,
      y: 30,
    },
  ],
});

describe('personal whiteboard save', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
    await database.exec(`
      BEGIN;
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES ('${userId}', 'Owner', 'personal-whiteboard@example.com', true);
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES
        ('${workspaceId}', 'personal', 'Personal', '${userId}'),
        ('${teamWorkspaceId}', 'team', 'Team', '${userId}');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES
        ('${workspaceId}', '${userId}', 'owner'),
        ('${teamWorkspaceId}', '${userId}', 'owner');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES
        ('${projectId}', '${workspaceId}', 'Personal project', '${userId}'),
        ('${teamProjectId}', '${teamWorkspaceId}', 'Team project', '${userId}');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES
        ('${projectId}', '${workspaceId}', '${userId}', 'owner'),
        ('${teamProjectId}', '${teamWorkspaceId}', '${userId}', 'owner');
      INSERT INTO documents (id, kind, project_id, title, content, search_text, created_by_id)
      VALUES
        (
          '${whiteboardId}',
          'whiteboard',
          '${projectId}',
          'Personal board',
          '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
          'legacy search text',
          '${userId}'
        ),
        ('${teamWhiteboardId}', 'whiteboard', '${teamProjectId}', 'Team board', DEFAULT, '', '${userId}'),
        ('${richTextId}', 'rich-text', '${projectId}', 'Rich text', DEFAULT, '', '${userId}');
      INSERT INTO document_whiteboard_states (document_id)
      VALUES ('${whiteboardId}'), ('${teamWhiteboardId}');
      COMMIT;
    `);

    const testDb = drizzle(database, { schema });
    vi.doMock('server-only', () => ({}));
    vi.doMock('@/libs/DB', () => ({ db: testDb }));
    vi.doMock('@/features/auth/server/CurrentUser', () => ({
      // oxlint-disable-next-line eslint/require-await -- Mock follows the asynchronous auth API.
      requireUser: async () => ({ id: userId }),
    }));

    ({ updatePersonalWhiteboard } =
      await import('@/features/whiteboards/server/UpdatePersonalWhiteboard'));
  }, 30_000);

  afterAll(async () => {
    vi.doUnmock('@/features/auth/server/CurrentUser');
    vi.doUnmock('@/libs/DB');
    vi.doUnmock('server-only');
    await database.close();
  });

  it('saves scene with a monotonic revision without changing rich-text payload columns', async () => {
    const scene = createScene('#f8fafc');
    const result = await updatePersonalWhiteboard({
      documentId: whiteboardId,
      expectedRevision: 1,
      scene,
    });

    expect(result).toMatchObject({ revision: 2, status: 'saved' });
    const saved = await database.query<{
      content: unknown;
      revision: number;
      scene: unknown;
      search_text: string;
    }>(`
      SELECT documents.content, documents.search_text,
        document_whiteboard_states.revision, document_whiteboard_states.scene
      FROM documents
      JOIN document_whiteboard_states
        ON document_whiteboard_states.document_id = documents.id
      WHERE documents.id = '${whiteboardId}'
    `);
    expect(saved.rows[0]).toMatchObject({
      content: { content: [{ type: 'paragraph' }], type: 'doc' },
      revision: 2,
      scene,
      search_text: 'legacy search text',
    });
  });

  it('rejects a stale revision without overwriting the committed scene', async () => {
    const result = await updatePersonalWhiteboard({
      documentId: whiteboardId,
      expectedRevision: 1,
      scene: createScene('#000000'),
    });

    expect(result).toStrictEqual({ revision: 2, status: 'conflict' });
    const saved = await database.query<{ revision: number; scene: unknown }>(`
      SELECT revision, scene
      FROM document_whiteboard_states
      WHERE document_id = '${whiteboardId}'
    `);
    expect(saved.rows[0]).toMatchObject({
      revision: 2,
      scene: { appState: { viewBackgroundColor: '#f8fafc' } },
    });
  });

  it('keeps one winner for concurrent compare-and-swap saves', async () => {
    const results = await Promise.all([
      updatePersonalWhiteboard({
        documentId: whiteboardId,
        expectedRevision: 2,
        scene: createScene('#fee2e2'),
      }),
      updatePersonalWhiteboard({
        documentId: whiteboardId,
        expectedRevision: 2,
        scene: createScene('#dbeafe'),
      }),
    ]);

    expect(results.filter((result) => result.status === 'saved')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'conflict')).toHaveLength(1);
    expect(results.map((result) => result.revision)).toStrictEqual([3, 3]);
  });

  it('rejects team whiteboards and rich-text documents', async () => {
    await expect(
      updatePersonalWhiteboard({
        documentId: teamWhiteboardId,
        expectedRevision: 1,
        scene: createScene('#ffffff'),
      }),
    ).rejects.toThrow('团队白板必须通过白板协作服务保存');
    await expect(
      updatePersonalWhiteboard({
        documentId: richTextId,
        expectedRevision: 1,
        scene: createScene('#ffffff'),
      }),
    ).rejects.toThrow('富文本文档不能通过白板保存入口保存');
  });
});
