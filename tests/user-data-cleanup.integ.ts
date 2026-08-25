import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { deleteUserData as deleteUserDataFunction } from '@/features/users/server/DeleteUserData';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let testDb: ReturnType<typeof drizzle<typeof schema>>;
let deleteUserData: typeof deleteUserDataFunction;

const ownedWorkspaceId = '10000000-0000-4000-8000-000000000400';
const joinedWorkspaceId = '10000000-0000-4000-8000-000000000401';
const teamOwnedWorkspaceId = '10000000-0000-4000-8000-000000000402';
const ownedProjectId = '20000000-0000-4000-8000-000000000400';
const sharedProjectId = '20000000-0000-4000-8000-000000000401';
const otherProjectDocId = '30000000-0000-4000-8000-000000000400';
const victimId = 'user_victim';
const survivorId = 'user_survivor';

async function count(target: PGlite, sql: string) {
  const result = await target.query<{ n: string }>(sql);
  return Number(result.rows[0]?.n ?? 0);
}

describe('user data cleanup', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
    testDb = drizzle(database, { schema });

    vi.doMock('server-only', () => ({}));
    ({ deleteUserData } = await import('@/features/users/server/DeleteUserData'));

    await database.transaction(async (transaction) => {
      await transaction.query(`
        INSERT INTO "user" (id, name, email)
        VALUES
          ('${victimId}', 'Victim', 'victim@example.com'),
          ('${survivorId}', 'Survivor', 'survivor@example.com')
      `);
      await transaction.query(`
        INSERT INTO workspaces (id, kind, name, owner_id)
        VALUES
          ('${ownedWorkspaceId}', 'personal', 'Victim Personal', '${victimId}'),
          ('${joinedWorkspaceId}', 'team', 'Survivor Owned', '${survivorId}'),
          ('${teamOwnedWorkspaceId}', 'team', 'Victim Team', '${victimId}')
      `);
      await transaction.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES
          ('${ownedWorkspaceId}', '${victimId}', 'owner'),
          ('${joinedWorkspaceId}', '${survivorId}', 'owner'),
          ('${joinedWorkspaceId}', '${victimId}', 'editor'),
          ('${teamOwnedWorkspaceId}', '${victimId}', 'owner')
      `);
      await transaction.query(`
        INSERT INTO projects (id, workspace_id, name, owner_id)
        VALUES
          ('${ownedProjectId}', '${ownedWorkspaceId}', 'Victim Project', '${victimId}'),
          ('${sharedProjectId}', '${joinedWorkspaceId}', 'Shared Project', '${survivorId}')
      `);
      await transaction.query(`
        INSERT INTO project_members (project_id, workspace_id, user_id, role)
        VALUES
          ('${ownedProjectId}', '${ownedWorkspaceId}', '${victimId}', 'owner'),
          ('${sharedProjectId}', '${joinedWorkspaceId}', '${survivorId}', 'owner'),
          ('${sharedProjectId}', '${joinedWorkspaceId}', '${victimId}', 'editor')
      `);
      await transaction.query(`
        INSERT INTO documents (id, project_id, title, created_by_id)
        VALUES
          ('40000000-0000-4000-8000-000000000400', '${ownedProjectId}', 'Owned Doc', '${victimId}'),
          ('${otherProjectDocId}', '${sharedProjectId}', 'Shared Doc', '${victimId}')
      `);
      await transaction.query(`
        INSERT INTO starred_documents (user_id, document_id)
        VALUES ('${victimId}', '${otherProjectDocId}')
      `);
      await transaction.query(`
        INSERT INTO notifications (recipient_user_id, actor_user_id, type, title, body, target_kind, target_id)
        VALUES
          ('${victimId}', '${survivorId}', 'project_invited', '给受害者的通知', 'body', 'project', '${sharedProjectId}'),
          ('${survivorId}', '${victimId}', 'workspace_invitation_accepted', '由受害者触发', 'body', 'project', '${sharedProjectId}'),
          ('${survivorId}', null, 'project_invited', '无触发者通知', 'body', null, null)
      `);
      await transaction.query(`
        INSERT INTO workspace_invitations (id, workspace_id, email, token_hash, invited_by_id, expires_at)
        VALUES
          ('50000000-0000-4000-8000-000000000400', '${joinedWorkspaceId}', 'x@example.com', 'hash_victim_invited', '${victimId}', now() + interval '7 days'),
          ('50000000-0000-4000-8000-000000000401', '${joinedWorkspaceId}', 'y@example.com', 'hash_victim_accepted', '${survivorId}', now() + interval '7 days')
      `);
      await transaction.query(`
        UPDATE workspace_invitations SET accepted_by_id = '${victimId}'
        WHERE id = '50000000-0000-4000-8000-000000000401'
      `);
      await transaction.query(`
        INSERT INTO workspace_access_requests (workspace_id, user_id, requested_role)
        VALUES ('${joinedWorkspaceId}', '${victimId}', 'editor')
      `);
      await transaction.query(`
        INSERT INTO audit_logs (workspace_id, actor_user_id, action, metadata)
        VALUES ('${joinedWorkspaceId}', '${victimId}', 'project_created', '{}')
      `);
    });
  }, 30_000);

  afterAll(async () => {
    vi.doUnmock('server-only');
    await database.close();
  });

  it('preserves all data while user owns a team workspace', async () => {
    await expect(
      testDb.transaction(async (transaction) => {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The PGlite transaction satisfies the deletion database contract used in production.
        const deletionDatabase = transaction as unknown as Parameters<typeof deleteUserData>[0];
        await deleteUserData(deletionDatabase, victimId);
      }),
    ).rejects.toThrow('删除账户前必须转让所有团队工作区的所有权');

    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM workspaces WHERE id = '${ownedWorkspaceId}'`,
      ),
    ).toBe(1);
    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM workspace_members WHERE workspace_id = '${joinedWorkspaceId}' AND user_id = '${victimId}'`,
      ),
    ).toBe(1);

    await database.query(`DELETE FROM workspaces WHERE id = '${teamOwnedWorkspaceId}'`);
  });

  it('removes owned resources and exits joined ones atomically', async () => {
    await testDb.transaction(async (transaction) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The PGlite transaction satisfies the deletion database contract used in production.
      const deletionDatabase = transaction as unknown as Parameters<typeof deleteUserData>[0];
      await deleteUserData(deletionDatabase, victimId);
    });

    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM workspaces WHERE id = '${ownedWorkspaceId}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM documents WHERE project_id = '${ownedProjectId}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM workspace_members WHERE workspace_id = '${ownedWorkspaceId}'`,
      ),
    ).toBe(0);

    expect(
      await count(database, `SELECT count(*) AS n FROM projects WHERE id = '${sharedProjectId}'`),
    ).toBe(1);
    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM project_members WHERE user_id = '${victimId}'`,
      ),
    ).toBe(0);

    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM starred_documents WHERE user_id = '${victimId}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM notifications WHERE recipient_user_id = '${victimId}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM workspace_invitations WHERE invited_by_id = '${victimId}' OR accepted_by_id = '${victimId}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM workspace_access_requests WHERE user_id = '${victimId}'`,
      ),
    ).toBe(0);
    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM user_preferences WHERE user_id = '${victimId}'`,
      ),
    ).toBe(0);
  });

  it('preserves attribution history with anonymized references', async () => {
    const doc = await database.query<{ created_by_id: string }>(
      `SELECT created_by_id FROM documents WHERE id = '${otherProjectDocId}'`,
    );
    expect(doc.rows[0]?.created_by_id).toBe('deleted_user');

    const notification = await database.query<{ actor_user_id: string | null }>(
      `SELECT actor_user_id FROM notifications WHERE title = '由受害者触发'`,
    );
    expect(notification.rows[0]?.actor_user_id).toBeNull();

    expect(
      await count(
        database,
        `SELECT count(*) AS n FROM audit_logs WHERE actor_user_id = '${victimId}'`,
      ),
    ).toBe(1);
  });
});
