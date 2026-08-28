import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;

const workspaceId = '10000000-0000-4000-8000-000000000033';
const projectId = '20000000-0000-4000-8000-000000000033';
const richTextDocumentId = '30000000-0000-4000-8000-000000000033';
const whiteboardDocumentId = '40000000-0000-4000-8000-000000000033';

describe('document whiteboard state migration', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles.slice(0, -1));
    await database.exec(`
      BEGIN;
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES ('owner', 'Owner', 'owner@example.com', true);
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES ('${workspaceId}', 'personal', 'Personal', 'owner');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('${workspaceId}', 'owner', 'owner');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES ('${projectId}', '${workspaceId}', 'Project', 'owner');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES ('${projectId}', '${workspaceId}', 'owner', 'owner');
      INSERT INTO documents (id, project_id, title, content, created_by_id)
      VALUES (
        '${richTextDocumentId}',
        '${projectId}',
        'Existing document',
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"preserved"}]}]}',
        'owner'
      );
      COMMIT;
    `);
    await executeMigrations(database, migrationFiles.slice(-1));
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('backfills existing documents without changing content', async () => {
    const result = await database.query<{ content: unknown; kind: string }>(`
      SELECT content, kind
      FROM documents
      WHERE id = '${richTextDocumentId}'
    `);

    expect(result.rows).toStrictEqual([
      {
        content: {
          content: [{ content: [{ text: 'preserved', type: 'text' }], type: 'paragraph' }],
          type: 'doc',
        },
        kind: 'rich-text',
      },
    ]);
  });

  it('creates whiteboard document and state atomically', async () => {
    await database.exec(`
      BEGIN;
      INSERT INTO documents (id, kind, project_id, title, created_by_id)
      VALUES ('${whiteboardDocumentId}', 'whiteboard', '${projectId}', 'Board', 'owner');
      INSERT INTO document_whiteboard_states (document_id)
      VALUES ('${whiteboardDocumentId}');
      COMMIT;
    `);

    const result = await database.query<{ revision: number; version: number }>(`
      SELECT revision, scene_schema_version AS version
      FROM document_whiteboard_states
      WHERE document_id = '${whiteboardDocumentId}'
    `);

    expect(result.rows).toStrictEqual([{ revision: 1, version: 1 }]);
  });

  it('rejects payload state for wrong document kind', async () => {
    await expect(
      database.query(`
        INSERT INTO document_whiteboard_states (document_id)
        VALUES ('${richTextDocumentId}')
      `),
    ).rejects.toThrow('Rich-text document cannot have whiteboard state');

    await expect(
      database.query(`
        INSERT INTO document_collaboration_states
          (document_id, state, document_schema_version)
        VALUES ('${whiteboardDocumentId}', decode('0101', 'hex'), 1)
      `),
    ).rejects.toThrow('Whiteboard document cannot have rich-text collaboration state');
  });

  it('rejects incomplete whiteboard document', async () => {
    await expect(
      database.query(`
        INSERT INTO documents (kind, project_id, title, created_by_id)
        VALUES ('whiteboard', '${projectId}', 'Incomplete board', 'owner')
      `),
    ).rejects.toThrow('Whiteboard document must have one whiteboard state');
  });

  it('cascades whiteboard state with document deletion', async () => {
    await database.query(`DELETE FROM documents WHERE id = '${whiteboardDocumentId}'`);

    const result = await database.query<{ count: number }>(`
      SELECT count(*)::integer AS count
      FROM document_whiteboard_states
      WHERE document_id = '${whiteboardDocumentId}'
    `);

    expect(result.rows).toStrictEqual([{ count: 0 }]);
  });
});
