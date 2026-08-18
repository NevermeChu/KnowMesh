import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const statementBreakpoint = '--> statement-breakpoint';
let database: PGlite;

async function executeMigration(fileName: string) {
  const sql = await readFile(resolve('migrations', fileName), 'utf-8');

  for (const statement of sql.split(statementBreakpoint)) {
    if (statement.trim()) {
      await database.exec(statement);
    }
  }
}

describe('database membership and owner invariants', () => {
  beforeAll(async () => {
    database = new PGlite();

    for (const fileName of [
      '0000_deep_the_anarchist.sql',
      '0001_add-project-members.sql',
      '0002_add-documents.sql',
      '0003_add-workspaces.sql',
      '0004_tricky_scarlet_spider.sql',
      '0005_add-workspace-kind.sql',
      '0006_remove-project-kind.sql',
      '0007_remove-redundant-indexes.sql',
      '0008_dashing_vivisector.sql',
      '0009_cheerful_mockingbird.sql',
    ]) {
      await executeMigration(fileName);
    }

    await database.exec(`
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES ('10000000-0000-4000-8000-000000000010', 'team', 'Legacy', 'legacy_owner');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('10000000-0000-4000-8000-000000000010', 'legacy_owner', 'owner');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES (
        '20000000-0000-4000-8000-000000000010',
        '10000000-0000-4000-8000-000000000010',
        'Legacy Project',
        'legacy_owner'
      );
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ('20000000-0000-4000-8000-000000000010', 'legacy_owner', 'owner');
    `);

    await executeMigration('0010_silly_nomad.sql');
    await executeMigration('0011_add-notifications.sql');
    await executeMigration('0012_add-user-preferences.sql');
    await executeMigration('0013_add-content-width-preference.sql');
    await executeMigration('0014_flawless_lilandra.sql');
    await executeMigration('0015_neat_earthquake.sql');
    await executeMigration('0016_perpetual_korath.sql');
    await executeMigration('0017_late_dakota_north.sql');
    await executeMigration('0018_cloudy_the_spike.sql');
    await executeMigration('0019_add-better-auth.sql');
  });

  afterAll(async () => {
    await database.close();
  });

  it('backfills workspace key for existing project members', async () => {
    const result = await database.query<{ workspace_id: string }>(
      `SELECT workspace_id
       FROM project_members
       WHERE project_id = '20000000-0000-4000-8000-000000000010'
         AND user_id = 'legacy_owner'`,
    );

    expect(result.rows).toStrictEqual([{ workspace_id: '10000000-0000-4000-8000-000000000010' }]);
  });

  it('accepts resource and owner member creation in one transaction', async () => {
    await expect(
      database.transaction(async (transaction) => {
        await transaction.query(
          `INSERT INTO workspaces (id, kind, name, owner_id)
           VALUES ('10000000-0000-4000-8000-000000000001', 'team', 'Team', 'user_owner')`,
        );
        await transaction.query(
          `INSERT INTO workspace_members (workspace_id, user_id, role)
           VALUES ('10000000-0000-4000-8000-000000000001', 'user_owner', 'owner')`,
        );
        await transaction.query(
          `INSERT INTO projects (id, workspace_id, name, owner_id)
           VALUES (
             '20000000-0000-4000-8000-000000000001',
             '10000000-0000-4000-8000-000000000001',
             'Project',
             'user_owner'
           )`,
        );
        await transaction.query(
          `INSERT INTO project_members (project_id, user_id, role)
           VALUES ('20000000-0000-4000-8000-000000000001', 'user_owner', 'owner')`,
        );
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects project member outside project workspace', async () => {
    await database.transaction(async (transaction) => {
      await transaction.query(
        `INSERT INTO workspaces (id, kind, name, owner_id)
         VALUES ('10000000-0000-4000-8000-000000000002', 'team', 'Other', 'other_owner')`,
      );
      await transaction.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES
           ('10000000-0000-4000-8000-000000000002', 'other_owner', 'owner'),
           ('10000000-0000-4000-8000-000000000002', 'outside_user', 'viewer')`,
      );
    });

    await expect(
      database.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ('20000000-0000-4000-8000-000000000001', 'outside_user', 'viewer')`,
      ),
    ).rejects.toThrow();
  });

  it('rejects project owner role downgrade at commit', async () => {
    await expect(
      database.transaction(async (transaction) => {
        await transaction.query(
          `UPDATE project_members
           SET role = 'viewer'
           WHERE project_id = '20000000-0000-4000-8000-000000000001'
             AND user_id = 'user_owner'`,
        );
      }),
    ).rejects.toThrow('Project owner must be its unique owner member');
  });
});
