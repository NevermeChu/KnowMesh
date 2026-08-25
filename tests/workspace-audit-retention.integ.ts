import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;

const ownerId = 'workspace_audit_owner';
const workspaceId = '10000000-0000-4000-8000-000000000510';

describe('workspace audit retention', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('retains workspace history after workspace deletion', async () => {
    await database.transaction(async (transaction) => {
      await transaction.query(`
        INSERT INTO "user" (id, name, email)
        VALUES ('${ownerId}', 'Audit Owner', 'audit-owner@example.com')
      `);
      await transaction.query(`
        INSERT INTO workspaces (id, kind, name, owner_id)
        VALUES ('${workspaceId}', 'team', 'Retained Audit Workspace', '${ownerId}')
      `);
      await transaction.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ('${workspaceId}', '${ownerId}', 'owner')
      `);
      await transaction.query(`
        INSERT INTO audit_logs (workspace_id, actor_user_id, action, target_kind, target_id, metadata)
        VALUES
          ('${workspaceId}', '${ownerId}', 'workspace_renamed', 'workspace', '${workspaceId}', '{"resourceName":"Retained Audit Workspace"}'),
          ('${workspaceId}', '${ownerId}', 'workspace_deleted', 'workspace', '${workspaceId}', '{"resourceName":"Retained Audit Workspace"}')
      `);
      await transaction.query(`DELETE FROM workspaces WHERE id = '${workspaceId}'`);
    });

    const result = await database.query<{ action: string; workspace_id: string }>(`
      SELECT action, workspace_id
      FROM audit_logs
      WHERE workspace_id = '${workspaceId}'
      ORDER BY action
    `);

    expect(result.rows).toStrictEqual([
      { action: 'workspace_deleted', workspace_id: workspaceId },
      { action: 'workspace_renamed', workspace_id: workspaceId },
    ]);
  });
});
