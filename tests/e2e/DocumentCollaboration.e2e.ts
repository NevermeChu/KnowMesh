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
const initialText = 'Stage 5 initial snapshot';
const persistedText = 'Stage 5 persisted update';
const failedText = 'Stage 5 failed persistence';
const recoveredText = 'Stage 5 recovered persistence';
const pool = new Pool({ connectionString: Env.DATABASE_URL });

function initializeFixtureIds() {
  const fixtureId = randomUUID();
  ownerUserId = `e2e_collaboration_owner_${fixtureId}`;
  editorUserId = `e2e_collaboration_editor_${fixtureId}`;
  ownerSessionId = `e2e_collaboration_owner_session_${fixtureId}`;
  editorSessionId = `e2e_collaboration_editor_session_${fixtureId}`;
  ownerSessionToken = `e2e-collaboration-owner-token-${fixtureId}`;
  editorSessionToken = `e2e-collaboration-editor-token-${fixtureId}`;
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

async function readProjectedText() {
  const result = await pool.query<{ text: string }>(`
    SELECT content #>> '{content,0,content,0,text}' AS text
    FROM documents
    WHERE id = '${documentId}'
  `);
  return result.rows[0]?.text;
}

async function readInvalidatedConnections() {
  const response = await fetch(
    `http://${Env.COLLABORATION_ADDRESS}:${Env.COLLABORATION_HEALTH_PORT}/metrics`,
  );
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('invalidatedConnections' in payload) ||
    typeof payload.invalidatedConnections !== 'number'
  ) {
    throw new Error('Collaboration metrics response is invalid');
  }
  return payload.invalidatedConnections;
}

async function expectCollaborationRevoked(page: Page, invalidatedConnections: number) {
  await expect
    .poll(readInvalidatedConnections, { timeout: 30_000 })
    .toBeGreaterThan(invalidatedConnections);
  const editor = page.locator('.ProseMirror[contenteditable="false"]');
  await expect(editor).toContainText(initialText);
  await expect(editor).toHaveAttribute('contenteditable', 'false');
  await expect(page.locator('.ProseMirror[contenteditable="true"]')).toHaveCount(0);
}

test.describe('team document collaboration', () => {
  test.skip(Env.COLLABORATION_ENABLED !== 'true', 'Collaboration acceptance requires the service');

  test.beforeEach(async () => {
    initializeFixtureIds();
    await pool.query(`
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES
        ('${ownerUserId}', 'Collaboration Owner', '${ownerUserId}@example.test', true),
        ('${editorUserId}', 'Collaboration Editor', '${editorUserId}@example.test', true)
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
          ('${workspaceId}', 'team', 'Collaboration Acceptance Team', '${ownerUserId}')
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
        VALUES ('${projectId}', '${workspaceId}', 'Collaboration Acceptance Project', '${ownerUserId}')
      `);
      await client.query(`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES
          ('${projectId}', '${ownerUserId}', 'owner'),
          ('${projectId}', '${editorUserId}', 'editor')
      `);
      await client.query(`
        INSERT INTO documents (id, project_id, title, content, created_by_id)
        VALUES (
          '${documentId}',
          '${projectId}',
          'Collaboration Acceptance Document',
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"${initialText}"}]}]}'::jsonb,
          '${ownerUserId}'
        )
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

  test('synchronizes two sessions and reports persistence failure recovery', async ({
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
      const ownerEditor = ownerPage.locator('.ProseMirror[contenteditable="true"]');
      const editorEditor = editorPage.locator('.ProseMirror[contenteditable="true"]');
      await expect(ownerPage.getByText('已同步', { exact: true })).toBeVisible();
      await expect(editorPage.getByText('已同步', { exact: true })).toBeVisible();

      await ownerEditor.fill(persistedText);
      await expect(editorEditor).toContainText(persistedText);
      await expect(ownerPage.getByText('已同步', { exact: true })).toBeVisible();
      await expect.poll(readProjectedText).toBe(persistedText);

      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 999
        WHERE document_id = '${documentId}'
      `);
      await ownerEditor.fill(failedText);
      await expect(editorEditor).toContainText(failedText);
      await expect(ownerPage.getByText('保存失败', { exact: true })).toBeVisible();
      await expect(editorPage.getByText('保存失败', { exact: true })).toBeVisible();
      expect(await readProjectedText()).toBe(persistedText);

      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 1
        WHERE document_id = '${documentId}'
      `);
      await ownerEditor.fill(recoveredText);
      await expect(editorEditor).toContainText(recoveredText);
      await expect(ownerPage.getByText('已同步', { exact: true })).toBeVisible();
      await expect.poll(readProjectedText).toBe(recoveredText);
    } finally {
      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 1
        WHERE document_id = '${documentId}'
      `);
      await closeContexts(contexts);
    }
  });

  test('shows a read-only snapshot while the service reconnects', async ({ baseURL, browser }) => {
    test.setTimeout(60_000);
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const context = await createAuthenticatedContext({
      baseURL,
      browser,
      sessionToken: ownerSessionToken,
    });
    let collaborationUnavailable = true;

    try {
      const page = await context.newPage();
      await page.routeWebSocket('ws://localhost:1234', async (webSocket) => {
        if (collaborationUnavailable) {
          await webSocket.close({ code: 1013, reason: 'Acceptance service outage' });
          return;
        }
        webSocket.connectToServer();
      });
      await page.goto(`/collaboration?project=${projectId}&document=${documentId}`);

      await expect(page.getByText('已离线，等待重连', { exact: true })).toBeVisible();
      const snapshot = page.locator('.ProseMirror[contenteditable="false"]');
      await expect(snapshot).toContainText(initialText);
      expect(await snapshot.getAttribute('contenteditable')).toBe('false');

      collaborationUnavailable = false;
      await expect(page.getByText('已同步', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.ProseMirror[contenteditable="true"]')).toContainText(initialText);
    } finally {
      await context.close();
    }
  });

  test('retries failed persistence after the last client disconnects', async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(60_000);
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    let context: BrowserContext | null = await createAuthenticatedContext({
      baseURL,
      browser,
      sessionToken: ownerSessionToken,
    });

    try {
      const page = await context.newPage();
      await page.goto(`/collaboration?project=${projectId}&document=${documentId}`);
      const editor = page.locator('.ProseMirror[contenteditable="true"]');
      await expect(editor).toBeVisible();
      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 999
        WHERE document_id = '${documentId}'
      `);
      await editor.fill(failedText);
      await expect(page.getByText('保存失败', { exact: true })).toBeVisible();
      expect(await readProjectedText()).toBe(initialText);

      await context.close();
      context = null;
      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 1
        WHERE document_id = '${documentId}'
      `);
      await expect.poll(readProjectedText, { timeout: 30_000 }).toBe(failedText);

      context = await createAuthenticatedContext({
        baseURL,
        browser,
        sessionToken: ownerSessionToken,
      });
      const recoveredPage = await context.newPage();
      await recoveredPage.goto(`/collaboration?project=${projectId}&document=${documentId}`);
      await expect(recoveredPage.locator('.ProseMirror[contenteditable="true"]')).toContainText(
        failedText,
      );
    } finally {
      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 1
        WHERE document_id = '${documentId}'
      `);
      await context?.close();
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
      await expect(page.locator('.ProseMirror[contenteditable="false"]')).toContainText(
        initialText,
      );
      await expect(page.locator('.ProseMirror[contenteditable="true"]')).toHaveCount(0);
      await expect(page.getByText('只读模式', { exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  const revocationScenarios = [
    {
      name: 'project role downgrade',
      revokeSql: `
        UPDATE project_members
        SET role = 'viewer'
        WHERE project_id = '${projectId}' AND user_id = '${editorUserId}'
      `,
      restoreSqls: [
        `
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ('${projectId}', '${editorUserId}', 'editor')
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `,
      ],
    },
    {
      name: 'workspace membership removal',
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
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ('${projectId}', '${editorUserId}', 'editor')
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
      `,
      ],
    },
    {
      name: 'session revocation',
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
    },
  ];

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

      try {
        const page = await context.newPage();
        await page.goto(`/collaboration?project=${projectId}&document=${documentId}`);
        await expect(page.getByText('已同步', { exact: true })).toBeVisible();
        await expect(page.locator('.ProseMirror[contenteditable="true"]')).toBeVisible();
        const invalidatedConnections = await readInvalidatedConnections();

        await pool.query(scenario.revokeSql);

        await expectCollaborationRevoked(page, invalidatedConnections);
      } finally {
        for (const restoreSql of scenario.restoreSqls) {
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
