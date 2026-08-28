import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';

let ownerUserId: string;
let editorUserId: string;
let ownerSessionId: string;
let editorSessionId: string;
let ownerSessionToken: string;
let editorSessionToken: string;
let workspaceId: string;
let ownerPersonalWorkspaceId: string;
let editorPersonalWorkspaceId: string;
let projectId: string;
let documentId: string;
const pool = new Pool({ connectionString: Env.DATABASE_URL });

function initializeFixtureIds() {
  const fixtureId = randomUUID();
  ownerUserId = `e2e_whiteboard_owner_${fixtureId}`;
  editorUserId = `e2e_whiteboard_editor_${fixtureId}`;
  ownerSessionId = `e2e_whiteboard_owner_session_${fixtureId}`;
  editorSessionId = `e2e_whiteboard_editor_session_${fixtureId}`;
  ownerSessionToken = `e2e-whiteboard-owner-token-${fixtureId}`;
  editorSessionToken = `e2e-whiteboard-editor-token-${fixtureId}`;
  workspaceId = randomUUID();
  ownerPersonalWorkspaceId = randomUUID();
  editorPersonalWorkspaceId = randomUUID();
  projectId = randomUUID();
  documentId = randomUUID();
}

function getSignedSessionCookie(token: string) {
  const signature = createHmac('sha256', Env.BETTER_AUTH_SECRET).update(token).digest('base64');
  return encodeURIComponent(`${token}.${signature}`);
}

async function createAuthenticatedContext(options: {
  baseURL: string;
  browser: Browser;
  sessionToken: string;
}) {
  const context = await options.browser.newContext();
  await context.addCookies([
    {
      domain: new URL(options.baseURL).hostname,
      httpOnly: true,
      name: 'better-auth.session_token',
      path: '/',
      sameSite: 'Lax',
      value: getSignedSessionCookie(options.sessionToken),
    },
    {
      domain: new URL(options.baseURL).hostname,
      httpOnly: true,
      name: 'knowmesh-active-workspace',
      path: '/',
      sameSite: 'Lax',
      value: workspaceId,
    },
  ]);
  return context;
}

async function closeContexts(contexts: BrowserContext[]) {
  for (const context of contexts) {
    await context.close();
  }
}

async function readSceneElementCount() {
  const result = await pool.query<{ element_count: number }>(`
    SELECT jsonb_array_length(scene->'elements')::int AS element_count
    FROM document_whiteboard_states
    WHERE document_id = '${documentId}'
  `);
  return result.rows[0]?.element_count ?? 0;
}

function whiteboardHealthOrigin() {
  const address = Env.WHITEBOARD_COLLABORATION_ADDRESS;
  if (address === '::' || address === '0.0.0.0') {
    return `http://127.0.0.1:${Env.WHITEBOARD_COLLABORATION_HEALTH_PORT}`;
  }
  const host = address.includes(':') && !address.startsWith('[') ? `[${address}]` : address;
  return `http://${host}:${Env.WHITEBOARD_COLLABORATION_HEALTH_PORT}`;
}

async function readInvalidatedConnections() {
  const response = await fetch(`${whiteboardHealthOrigin()}/metrics`);
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('invalidatedConnections' in payload) ||
    typeof payload.invalidatedConnections !== 'number'
  ) {
    throw new Error('Whiteboard collaboration metrics response is invalid');
  }
  return payload.invalidatedConnections;
}

async function drawRectangle(page: Page) {
  const whiteboard = page.locator('.excalidraw');
  await expect(whiteboard).toBeVisible();
  const bounds = await whiteboard.boundingBox();
  if (!bounds) {
    throw new Error('Whiteboard bounds are unavailable');
  }
  await whiteboard.click({
    position: { x: bounds.width * 0.6, y: bounds.height * 0.5 },
  });
  await page.keyboard.press('2');
  await page.mouse.move(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.42);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.58, {
    steps: 6,
  });
  await page.mouse.up();
}

test.describe('team whiteboard collaboration', () => {
  test.skip(
    Env.WHITEBOARD_COLLABORATION_ENABLED !== 'true' ||
      Env.NEXT_PUBLIC_WHITEBOARD_COLLABORATION_ENABLED !== 'true',
    'Whiteboard collaboration acceptance requires the service',
  );

  test.beforeEach(async () => {
    initializeFixtureIds();
    await pool.query(`
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES
        ('${ownerUserId}', 'Whiteboard Owner', '${ownerUserId}@example.test', true),
        ('${editorUserId}', 'Whiteboard Editor', '${editorUserId}@example.test', true)
    `);
    await pool.query(`
      INSERT INTO "session" (id, expires_at, token, user_id)
      VALUES
        ('${ownerSessionId}', now() + interval '1 day', '${ownerSessionToken}', '${ownerUserId}'),
        ('${editorSessionId}', now() + interval '1 day', '${editorSessionToken}', '${editorUserId}')
    `);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO workspaces (id, kind, name, owner_id)
        VALUES
          ('${ownerPersonalWorkspaceId}', 'personal', 'Owner Personal', '${ownerUserId}'),
          ('${editorPersonalWorkspaceId}', 'personal', 'Editor Personal', '${editorUserId}'),
          ('${workspaceId}', 'team', 'Whiteboard Acceptance Team', '${ownerUserId}')
      `);
      await client.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES
          ('${ownerPersonalWorkspaceId}', '${ownerUserId}', 'owner'),
          ('${editorPersonalWorkspaceId}', '${editorUserId}', 'owner'),
          ('${workspaceId}', '${ownerUserId}', 'owner'),
          ('${workspaceId}', '${editorUserId}', 'editor')
      `);
      await client.query(`
        INSERT INTO projects (id, workspace_id, name, owner_id)
        VALUES ('${projectId}', '${workspaceId}', 'Whiteboard Acceptance Project', '${ownerUserId}')
      `);
      await client.query(`
        INSERT INTO project_members (project_id, workspace_id, user_id, role)
        VALUES
          ('${projectId}', '${workspaceId}', '${ownerUserId}', 'owner'),
          ('${projectId}', '${workspaceId}', '${editorUserId}', 'editor')
      `);
      await client.query(`
        INSERT INTO documents (id, kind, project_id, title, created_by_id)
        VALUES (
          '${documentId}',
          'whiteboard',
          '${projectId}',
          'Whiteboard Acceptance Board',
          '${ownerUserId}'
        )
      `);
      await client.query(`
        INSERT INTO document_whiteboard_states (document_id)
        VALUES ('${documentId}')
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  test.afterEach(async () => {
    await pool.query(`
      DELETE FROM workspaces
      WHERE id IN ('${workspaceId}', '${ownerPersonalWorkspaceId}', '${editorPersonalWorkspaceId}')
    `);
    await pool.query(`DELETE FROM "user" WHERE id IN ('${ownerUserId}', '${editorUserId}')`);
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test('synchronizes two sessions over persisted canonical scenes', async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(60_000);
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const ownerContext = await createAuthenticatedContext({
      baseURL,
      browser,
      sessionToken: ownerSessionToken,
    });
    const editorContext = await createAuthenticatedContext({
      baseURL,
      browser,
      sessionToken: editorSessionToken,
    });
    const contexts = [ownerContext, editorContext];

    try {
      const ownerPage = await ownerContext.newPage();
      const editorPage = await editorContext.newPage();
      const route = `/collaboration?project=${projectId}&document=${documentId}`;
      await Promise.all([ownerPage.goto(route), editorPage.goto(route)]);
      await expect(ownerPage.getByText('团队白板', { exact: true })).toBeVisible();
      await expect(editorPage.getByText('团队白板', { exact: true })).toBeVisible();
      await expect(ownerPage.getByText('已同步', { exact: true })).toBeVisible();
      await expect(editorPage.getByText('已同步', { exact: true })).toBeVisible();

      await drawRectangle(ownerPage);
      await expect(ownerPage.getByText('已同步', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect.poll(readSceneElementCount).toBeGreaterThan(0);
      await expect(editorPage.getByText('已同步', { exact: true })).toBeVisible();
    } finally {
      await closeContexts(contexts);
    }
  });

  test('renders project viewers as read-only collaborators', async ({ baseURL, browser }) => {
    test.setTimeout(60_000);
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    await pool.query(`
      UPDATE project_members
      SET role = 'viewer'
      WHERE project_id = '${projectId}' AND user_id = '${editorUserId}'
    `);
    const context = await createAuthenticatedContext({
      baseURL,
      browser,
      sessionToken: editorSessionToken,
    });

    try {
      const page = await context.newPage();
      await page.goto(`/collaboration?project=${projectId}&document=${documentId}`);
      await expect(page.getByText('团队白板', { exact: true })).toBeVisible();
      await expect(page.getByText('只读模式', { exact: true })).toBeVisible();
      await expect.poll(readSceneElementCount).toBe(0);
    } finally {
      await context.close();
    }
  });

  const revocationScenarios = [
    { name: 'project role downgrade' },
    { name: 'workspace membership removal' },
    { name: 'session revocation' },
  ] as const;

  function buildScenarioQueries(scenarioName: string) {
    if (scenarioName === 'project role downgrade') {
      return {
        revokeSql: `
          UPDATE project_members
          SET role = 'viewer'
          WHERE project_id = '${projectId}' AND user_id = '${editorUserId}'
        `,
        restoreSqls: [
          `
          INSERT INTO project_members (project_id, workspace_id, user_id, role)
          VALUES ('${projectId}', '${workspaceId}', '${editorUserId}', 'editor')
          ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
        `,
        ],
      };
    }

    if (scenarioName === 'workspace membership removal') {
      return {
        revokeSql: `
          DELETE FROM workspace_members
          WHERE workspace_id = '${workspaceId}' AND user_id = '${editorUserId}'
        `,
        restoreSqls: [
          `
          INSERT INTO workspace_members (workspace_id, user_id, role)
          VALUES ('${workspaceId}', '${editorUserId}', 'editor')
          ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
        `,
          `
          INSERT INTO project_members (project_id, workspace_id, user_id, role)
          VALUES ('${projectId}', '${workspaceId}', '${editorUserId}', 'editor')
          ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
        `,
        ],
      };
    }

    return {
      revokeSql: `DELETE FROM "session" WHERE id = '${editorSessionId}'`,
      restoreSqls: [
        `
        INSERT INTO "session" (id, expires_at, token, user_id)
        VALUES (
          '${editorSessionId}',
          now() + interval '1 day',
          '${editorSessionToken}',
          '${editorUserId}'
        )
        ON CONFLICT (id) DO UPDATE SET
          expires_at = EXCLUDED.expires_at,
          token = EXCLUDED.token,
          user_id = EXCLUDED.user_id
      `,
      ],
    };
  }

  const registerRevocationScenario = (scenario: (typeof revocationScenarios)[number]) => {
    test(`disconnects an active editor after ${scenario.name}`, async ({ baseURL, browser }) => {
      test.setTimeout(60_000);
      if (!baseURL) {
        throw new Error('Playwright base URL is unavailable');
      }

      const context = await createAuthenticatedContext({
        baseURL,
        browser,
        sessionToken: editorSessionToken,
      });
      const { revokeSql, restoreSqls } = buildScenarioQueries(scenario.name);

      try {
        const page = await context.newPage();
        await page.goto(`/collaboration?project=${projectId}&document=${documentId}`);
        await expect(page.getByText('已同步', { exact: true })).toBeVisible();
        const invalidatedConnections = await readInvalidatedConnections();
        await pool.query(revokeSql);
        await expect
          .poll(readInvalidatedConnections, { timeout: 30_000 })
          .toBeGreaterThan(invalidatedConnections);
        await expect(page.getByText('同步失败，需要重试', { exact: true })).toBeVisible();
      } finally {
        for (const restoreSql of restoreSqls) {
          await pool.query(restoreSql);
        }
        await context.close();
      }
    });
  };

  for (const scenario of revocationScenarios) {
    registerRevocationScenario(scenario);
  }
});
