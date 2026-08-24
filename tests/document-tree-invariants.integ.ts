import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;

const projectId = '20000000-0000-4000-8000-000000000001';
const rootDocumentId = '30000000-0000-4000-8000-000000000001';

describe('document tree database invariants', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
    await database.exec(`
      INSERT INTO "user" (id, name, email)
      VALUES ('user_tree_owner', 'Tree Owner', 'tree_owner@example.com');

      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES ('10000000-0000-4000-8000-000000000001', 'personal', 'Personal Space', 'user_tree_owner');

      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('10000000-0000-4000-8000-000000000001', 'user_tree_owner', 'owner');

      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES ('${projectId}', '10000000-0000-4000-8000-000000000001', 'Tree Project', 'user_tree_owner');

      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES ('${projectId}', '10000000-0000-4000-8000-000000000001', 'user_tree_owner', 'owner');
    `);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('rejects a missing parent document', async () => {
    await expect(
      database.exec(`
        INSERT INTO documents (id, project_id, parent_id, title, created_by_id)
        VALUES (
          '30000000-0000-4000-8000-000000000099',
          '${projectId}',
          '30000000-0000-4000-8000-000000000098',
          'Orphan',
          'user_tree_owner'
        );
      `),
    ).rejects.toThrow(/foreign key|violates/u);
  });

  it('cascades subtree deletion and removes starred entries', async () => {
    await database.exec(`
      INSERT INTO documents (id, project_id, parent_id, title, sort_order, created_by_id)
      VALUES
        ('${rootDocumentId}', '${projectId}', NULL, 'Root', 1000, 'user_tree_owner'),
        (
          '30000000-0000-4000-8000-000000000002',
          '${projectId}',
          '${rootDocumentId}',
          'Child',
          1000,
          'user_tree_owner'
        ),
        (
          '30000000-0000-4000-8000-000000000003',
          '${projectId}',
          '30000000-0000-4000-8000-000000000002',
          'Grandchild',
          1000,
          'user_tree_owner'
        );

      INSERT INTO starred_documents (user_id, document_id)
      VALUES ('user_tree_owner', '30000000-0000-4000-8000-000000000003');

      DELETE FROM documents WHERE id = '${rootDocumentId}';
    `);

    const documents = await database.query<{ id: string }>(`
      SELECT id FROM documents WHERE project_id = '${projectId}';
    `);
    const starred = await database.query<{ document_id: string }>(`
      SELECT document_id FROM starred_documents WHERE user_id = 'user_tree_owner';
    `);

    expect(documents.rows).toHaveLength(0);
    expect(starred.rows).toHaveLength(0);
  });
});
