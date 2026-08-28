import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  loadTeamWhiteboardCanonicalScene as loadFunction,
  saveTeamWhiteboardCandidate as saveFunction,
} from '@/features/whiteboards/collaboration/WhiteboardCollaborationPersistence';
import { EMPTY_WHITEBOARD_SCENE } from '@/features/whiteboards/WhiteboardScene';
import type { WhiteboardScene } from '@/features/whiteboards/WhiteboardScene';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let loadTeamWhiteboardCanonicalScene: typeof loadFunction;
let saveTeamWhiteboardCandidate: typeof saveFunction;

const userId = 'team-whiteboard-owner';
const teamWorkspaceId = '10000000-0000-4000-8000-000000000046';
const personalWorkspaceId = '10000000-0000-4000-8000-000000000047';
const teamProjectId = '20000000-0000-4000-8000-000000000046';
const personalProjectId = '20000000-0000-4000-8000-000000000047';
const teamWhiteboardId = '30000000-0000-4000-8000-000000000046';
const personalWhiteboardId = '30000000-0000-4000-8000-000000000047';

const createScene = (id: string): WhiteboardScene => ({
  ...EMPTY_WHITEBOARD_SCENE,
  elements: [
    {
      height: 80,
      id,
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

describe('team whiteboard persistence', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);
    await database.exec(`
      BEGIN;
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES ('${userId}', 'Owner', 'team-whiteboard@example.com', true);
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES
        ('${teamWorkspaceId}', 'team', 'Team', '${userId}'),
        ('${personalWorkspaceId}', 'personal', 'Personal', '${userId}');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES
        ('${teamWorkspaceId}', '${userId}', 'owner'),
        ('${personalWorkspaceId}', '${userId}', 'owner');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES
        ('${teamProjectId}', '${teamWorkspaceId}', 'Team project', '${userId}'),
        ('${personalProjectId}', '${personalWorkspaceId}', 'Personal project', '${userId}');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES
        ('${teamProjectId}', '${teamWorkspaceId}', '${userId}', 'owner'),
        ('${personalProjectId}', '${personalWorkspaceId}', '${userId}', 'owner');
      INSERT INTO documents (id, kind, project_id, title, created_by_id)
      VALUES
        ('${teamWhiteboardId}', 'whiteboard', '${teamProjectId}', 'Team board', '${userId}'),
        ('${personalWhiteboardId}', 'whiteboard', '${personalProjectId}', 'Personal board', '${userId}');
      INSERT INTO document_whiteboard_states (document_id)
      VALUES ('${teamWhiteboardId}'), ('${personalWhiteboardId}');
      COMMIT;
    `);
    vi.doMock('@/libs/DB', () => ({ db: drizzle(database, { schema }) }));
    ({ loadTeamWhiteboardCanonicalScene, saveTeamWhiteboardCandidate } =
      await import('@/features/whiteboards/collaboration/WhiteboardCollaborationPersistence'));
  }, 30_000);

  afterAll(async () => {
    vi.doUnmock('@/libs/DB');
    await database.close();
  });

  it('commits candidate before returning a monotonic canonical revision', async () => {
    const scene = createScene('committed');
    const result = await saveTeamWhiteboardCandidate({
      documentId: teamWhiteboardId,
      expectedRevision: 1,
      scene,
    });

    expect(result).toMatchObject({ revision: 2, scene, status: 'saved' });
    await expect(loadTeamWhiteboardCanonicalScene(teamWhiteboardId)).resolves.toMatchObject({
      revision: 2,
      scene,
    });
  });

  it('returns the latest canonical scene for a stale candidate', async () => {
    const result = await saveTeamWhiteboardCandidate({
      documentId: teamWhiteboardId,
      expectedRevision: 1,
      scene: createScene('stale'),
    });

    expect(result).toMatchObject({
      revision: 2,
      scene: { elements: [expect.objectContaining({ id: 'committed' })] },
      status: 'conflict',
    });
  });

  it('rejects personal whiteboards from the team protocol', async () => {
    await expect(loadTeamWhiteboardCanonicalScene(personalWhiteboardId)).rejects.toThrow(
      'permission-denied',
    );
    await expect(
      saveTeamWhiteboardCandidate({
        documentId: personalWhiteboardId,
        expectedRevision: 1,
        scene: createScene('forged'),
      }),
    ).rejects.toThrow('permission-denied');
  });
});
