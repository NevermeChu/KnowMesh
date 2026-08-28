import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { getProjectDocuments as getProjectDocumentsFunction } from '@/features/documents/server/GetProjectDocuments';
import type { Permission } from '@/features/permissions/Permission';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let getProjectDocuments!: typeof getProjectDocumentsFunction;

const userId = 'whiteboard-reader';
const workspaceId = '10000000-0000-4000-8000-000000000034';
const projectId = '20000000-0000-4000-8000-000000000034';
const richTextDocumentId = '30000000-0000-4000-8000-000000000034';
const whiteboardDocumentId = '40000000-0000-4000-8000-000000000034';
let permissions: Permission[] = ['project.structure.read', 'document.read', 'document.update'];

describe('whiteboard document read', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
    await database.exec(`
      BEGIN;
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES ('${userId}', 'Reader', 'reader@example.com', true);
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES ('${workspaceId}', 'personal', 'Personal', '${userId}');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('${workspaceId}', '${userId}', 'owner');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES ('${projectId}', '${workspaceId}', 'Project', '${userId}');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES ('${projectId}', '${workspaceId}', '${userId}', 'owner');
      INSERT INTO documents (id, project_id, title, created_by_id)
      VALUES ('${richTextDocumentId}', '${projectId}', 'Rich text', '${userId}');
      INSERT INTO documents (id, kind, parent_id, project_id, title, created_by_id)
      VALUES (
        '${whiteboardDocumentId}',
        'whiteboard',
        '${richTextDocumentId}',
        '${projectId}',
        'Whiteboard',
        '${userId}'
      );
      INSERT INTO document_whiteboard_states (document_id)
      VALUES ('${whiteboardDocumentId}');
      COMMIT;
    `);

    const testDb = drizzle(database, { schema });
    vi.doMock('server-only', () => ({}));
    vi.doMock('@/libs/DB', () => ({ db: testDb }));
    vi.doMock('@/libs/Env', () => ({ Env: { COLLABORATION_ENABLED: 'false' } }));
    vi.doMock('@/features/auth/server/CurrentUser', () => ({
      // oxlint-disable-next-line eslint/require-await -- Mock follows the asynchronous auth API.
      requireUser: async () => ({ id: userId }),
    }));
    vi.doMock('@/features/permissions/server/ProjectAuthorization', () => ({
      // oxlint-disable-next-line eslint/require-await -- Mock follows the asynchronous authorization API.
      authorizeProject: async () => ({ project: { id: projectId } }),
      // oxlint-disable-next-line eslint/require-await -- Mock follows the asynchronous authorization API.
      getProjectAuthorization: async () => ({
        decision: { permissions },
        project: { id: projectId, workspaceId, workspaceKind: 'personal' },
      }),
    }));

    ({ getProjectDocuments } = await import('@/features/documents/server/GetProjectDocuments'));
  }, 30_000);

  afterAll(async () => {
    vi.doUnmock('@/features/permissions/server/ProjectAuthorization');
    vi.doUnmock('@/features/auth/server/CurrentUser');
    vi.doUnmock('@/libs/Env');
    vi.doUnmock('@/libs/DB');
    vi.doUnmock('server-only');
    await database.close();
  });

  it('loads rich-text payload with unchanged editor mode', async () => {
    const result = await getProjectDocuments({
      documentId: richTextDocumentId,
      projectId,
      workspaceId,
      workspaceKind: 'personal',
    });

    expect(result?.selectedDocument).toMatchObject({
      content: { content: [{ type: 'paragraph' }], type: 'doc' },
      id: richTextDocumentId,
      kind: 'rich-text',
    });
    expect(result?.selectedDocumentEditorMode).toBe('single-user');
  });

  it('loads whiteboard scene without rich-text payload', async () => {
    permissions = ['project.structure.read', 'document.read'];

    const result = await getProjectDocuments({
      documentId: whiteboardDocumentId,
      projectId,
      workspaceId,
      workspaceKind: 'personal',
    });

    expect(result?.selectedDocument).toMatchObject({
      id: whiteboardDocumentId,
      kind: 'whiteboard',
      revision: 1,
      scene: { source: 'knowmesh', type: 'excalidraw', version: 1 },
    });
    expect(result?.selectedDocument).not.toHaveProperty('content');
    expect(result?.selectedDocumentEditorMode).toBeNull();
  });

  it('does not parse scene without document read permission', async () => {
    await database.query(`
      UPDATE document_whiteboard_states
      SET scene = '{"invalid":true}'::jsonb
      WHERE document_id = '${whiteboardDocumentId}'
    `);
    permissions = ['project.structure.read'];

    const result = await getProjectDocuments({
      documentId: whiteboardDocumentId,
      projectId,
      workspaceId,
      workspaceKind: 'personal',
    });

    expect(result?.selectedDocument).toBeNull();
    expect(result?.selectedDocumentTitle).toBe('Whiteboard');
  });
});
