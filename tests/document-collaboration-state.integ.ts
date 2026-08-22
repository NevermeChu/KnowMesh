import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;

const workspaceId = '10000000-0000-4000-8000-000000000020';
const projectId = '20000000-0000-4000-8000-000000000020';
const documentId = '30000000-0000-4000-8000-000000000020';
const viewerId = 'collaboration-viewer';

function parseSignals(signals: string[]) {
  return signals.map((signal) => {
    const payload: unknown = JSON.parse(signal);
    return payload;
  });
}

describe('document collaboration state persistence', () => {
  beforeAll(async () => {
    database = new PGlite();
    await executeMigrations(database, migrationFiles);
    await database.exec(`
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES ('${workspaceId}', 'team', 'Team', 'owner');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('${workspaceId}', 'owner', 'owner');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES ('${projectId}', '${workspaceId}', 'Project', 'owner');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES ('${projectId}', '${workspaceId}', 'owner', 'owner');
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES ('${viewerId}', 'Viewer', 'viewer@example.com', true);
      INSERT INTO "session" (id, token, expires_at, user_id)
      VALUES ('collaboration-session', 'collaboration-token', NOW() + INTERVAL '1 day', '${viewerId}');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('${workspaceId}', '${viewerId}', 'viewer');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES ('${projectId}', '${workspaceId}', '${viewerId}', 'viewer');
      INSERT INTO documents (id, project_id, title, created_by_id)
      VALUES ('${documentId}', '${projectId}', 'Document', 'owner');
    `);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('keeps one winner during concurrent initialization', async () => {
    const insert = async (state: string) =>
      await database.query(
        `INSERT INTO document_collaboration_states
           (document_id, state, document_schema_version)
         VALUES ('${documentId}', decode('${state}', 'hex'), 1)
         ON CONFLICT (document_id) DO NOTHING`,
      );

    await Promise.all([insert('0101'), insert('0102')]);

    const result = await database.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM document_collaboration_states
       WHERE document_id = '${documentId}'`,
    );

    expect(result.rows).toStrictEqual([{ count: 1 }]);
  });

  it('deletes collaboration state with its document', async () => {
    const signals: string[] = [];
    const unlisten = await database.listen('knowmesh_document_collaboration', (payload) => {
      signals.push(payload);
    });
    await database.query(`DELETE FROM documents WHERE id = '${documentId}'`);

    const result = await database.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM document_collaboration_states
       WHERE document_id = '${documentId}'`,
    );

    expect(result.rows).toStrictEqual([{ count: 0 }]);
    expect(parseSignals(signals)).toContainEqual({
      documentId,
      kind: 'document',
    });
    await unlisten();
  });

  it('emits member and session invalidation signals', async () => {
    const signals: string[] = [];
    const unlisten = await database.listen('knowmesh_document_collaboration', (payload) => {
      signals.push(payload);
    });

    await database.exec(`
      UPDATE project_members
      SET role = 'editor'
      WHERE project_id = '${projectId}' AND user_id = '${viewerId}';
      DELETE FROM "session" WHERE id = 'collaboration-session';
    `);

    expect(parseSignals(signals)).toEqual(
      expect.arrayContaining([
        { kind: 'project_member', projectId, userId: viewerId },
        { kind: 'session', sessionId: 'collaboration-session', userId: viewerId },
      ]),
    );
    await unlisten();
  });
});
