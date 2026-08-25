import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;

const documentId = '30000000-0000-4000-8000-000000000520';
const ownerId = 'document_title_owner';
const projectId = '20000000-0000-4000-8000-000000000520';
const workspaceId = '10000000-0000-4000-8000-000000000520';

describe('document title realtime delivery', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
    await database.exec(`
      INSERT INTO "user" (id, name, email)
      VALUES ('${ownerId}', 'Title Owner', 'title-owner@example.com');
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES ('${workspaceId}', 'team', 'Title Workspace', '${ownerId}');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('${workspaceId}', '${ownerId}', 'owner');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES ('${projectId}', '${workspaceId}', 'Title Project', '${ownerId}');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES ('${projectId}', '${workspaceId}', '${ownerId}', 'owner');
      INSERT INTO documents (id, project_id, title, created_by_id)
      VALUES ('${documentId}', '${projectId}', 'Initial title', '${ownerId}');
    `);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('publishes committed title and version', async () => {
    const signals: string[] = [];
    const unlisten = await database.listen('knowmesh_document_collaboration', (payload) => {
      signals.push(payload);
    });

    await database.query(`
      UPDATE documents
      SET title = 'Shared title', title_version = title_version + 1
      WHERE id = '${documentId}'
    `);

    expect(
      signals.map((signal) => {
        const payload: unknown = JSON.parse(signal);
        return payload;
      }),
    ).toContainEqual({
      documentId,
      kind: 'document_title',
      title: 'Shared title',
      titleVersion: 2,
    });

    await unlisten();
  });
});
