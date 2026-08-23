import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';

const fixtureId = randomUUID();
const ownerUserId = `e2e_permission_owner_${fixtureId}`;
const targetUserId = `e2e_permission_target_${fixtureId}`;
const ownerSessionId = `e2e_permission_owner_session_${fixtureId}`;
const targetSessionId = `e2e_permission_target_session_${fixtureId}`;
const ownerSessionToken = `e2e-permission-owner-session-token-${fixtureId}`;
const targetSessionToken = `e2e-permission-target-session-token-${fixtureId}`;
const workspaceId = randomUUID();
const ownerPersonalWorkspaceId = randomUUID();
const targetPersonalWorkspaceId = randomUUID();
const projectId = randomUUID();
const documentId = randomUUID();
const pool = new Pool({ connectionString: Env.DATABASE_URL });

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

async function readSseCountSync(page: Page) {
  return await page.evaluate(async () => {
    const { promise, reject, resolve } = Promise.withResolvers<number>();
    const source = new EventSource('/api/realtime/notifications');
    const timeout = window.setTimeout(() => {
      source.close();
      reject(new Error('SSE count sync timed out'));
    }, 10_000);

    source.addEventListener('notification:count_sync', (event) => {
      window.clearTimeout(timeout);
      source.close();
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
        reject(new Error('SSE count sync event is invalid'));
        return;
      }
      const payload: unknown = JSON.parse(event.data);

      if (
        typeof payload === 'object' &&
        payload !== null &&
        'unreadCount' in payload &&
        typeof payload.unreadCount === 'number'
      ) {
        resolve(payload.unreadCount);
      } else {
        reject(new Error('SSE count sync payload is invalid'));
      }
    });
    source.addEventListener('error', () => {
      window.clearTimeout(timeout);
      source.close();
      reject(new Error('SSE connection failed'));
    });

    return await promise;
  });
}

test.describe('permission changes with realtime sessions', () => {
  test.skip(
    Env.E2E_REAL_POSTGRES !== 'true',
    'Cross-connection LISTEN/NOTIFY requires a real PostgreSQL test server',
  );

  test.beforeAll(async () => {
    await pool.query(`
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES
        ('${ownerUserId}', 'Permission Owner', '${ownerUserId}@example.test', true),
        ('${targetUserId}', 'Permission Target', '${targetUserId}@example.test', true)
    `);
    await pool.query(`
      INSERT INTO "session" (id, expires_at, token, user_id)
      VALUES
        ('${ownerSessionId}', now() + interval '1 day', '${ownerSessionToken}', '${ownerUserId}'),
        ('${targetSessionId}', now() + interval '1 day', '${targetSessionToken}', '${targetUserId}')
    `);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO workspaces (id, kind, name, owner_id)
        VALUES
          ('${ownerPersonalWorkspaceId}', 'personal', 'Owner Personal', '${ownerUserId}'),
          ('${targetPersonalWorkspaceId}', 'personal', 'Target Personal', '${targetUserId}'),
          ('${workspaceId}', 'team', 'Permission Realtime Team', '${ownerUserId}')
      `);
      await client.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES
          ('${ownerPersonalWorkspaceId}', '${ownerUserId}', 'owner'),
          ('${targetPersonalWorkspaceId}', '${targetUserId}', 'owner'),
          ('${workspaceId}', '${ownerUserId}', 'owner'),
          ('${workspaceId}', '${targetUserId}', 'editor')
      `);
      await client.query(`
        INSERT INTO projects (id, workspace_id, name, owner_id)
        VALUES ('${projectId}', '${workspaceId}', 'Permission Realtime Project', '${ownerUserId}')
      `);
      await client.query(`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES
          ('${projectId}', '${ownerUserId}', 'owner'),
          ('${projectId}', '${targetUserId}', 'editor')
      `);
      await client.query(`
        INSERT INTO documents (id, project_id, title, created_by_id)
        VALUES ('${documentId}', '${projectId}', 'Permission Realtime Document', '${ownerUserId}')
      `);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  test.afterAll(async () => {
    await pool.end();
  });

  test('transfers ownership, downgrades a member and resynchronizes SSE after reconnect', async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const [ownerContext, targetContext] = await Promise.all([
      createAuthenticatedContext({ baseURL, browser, sessionToken: ownerSessionToken }),
      createAuthenticatedContext({ baseURL, browser, sessionToken: targetSessionToken }),
    ]);

    try {
      const ownerPage = await ownerContext.newPage();
      const targetPage = await targetContext.newPage();
      const route = `/collaboration?project=${projectId}&document=${documentId}`;
      await Promise.all([ownerPage.goto(route), targetPage.goto(route)]);
      await expect(ownerPage).toHaveURL(new RegExp(`/collaboration\\?project=${projectId}`, 'u'));
      await expect(targetPage).toHaveURL(new RegExp(`/collaboration\\?project=${projectId}`, 'u'));

      expect(await readSseCountSync(ownerPage)).toBe(0);
      expect(await readSseCountSync(targetPage)).toBe(0);

      await ownerPage.getByRole('button', { name: '设置' }).click();
      await ownerPage.getByRole('button', { name: '工作区管理' }).click();
      await ownerPage.getByLabel('Permission Target的角色').selectOption('__transfer__');
      await ownerPage.getByRole('button', { name: '确认转让' }).click();

      await expect(
        targetPage.locator('[aria-live="polite"]').getByText(/工作区所有权转让/u),
      ).toBeVisible();
      await expect
        .poll(async () => {
          const result = await pool.query<{ owner_id: string }>(
            `SELECT owner_id FROM workspaces WHERE id = '${workspaceId}'`,
          );
          return result.rows[0]?.owner_id;
        })
        .toBe(targetUserId);

      await targetPage.reload();
      await targetPage.getByRole('button', { name: '设置' }).click();
      await targetPage.getByRole('button', { name: '工作区管理' }).click();
      await targetPage.getByLabel('Permission Owner的角色').selectOption('viewer');

      await expect(
        ownerPage.locator('[aria-live="polite"]').getByText(/工作区角色变更/u),
      ).toBeVisible();
      await expect
        .poll(async () => {
          const result = await pool.query<{ role: string }>(
            `SELECT role FROM workspace_members WHERE workspace_id = '${workspaceId}' AND user_id = '${ownerUserId}'`,
          );
          return result.rows[0]?.role;
        })
        .toBe('viewer');

      const countBeforeReconnect = await readSseCountSync(targetPage);
      await pool.query(`
        INSERT INTO notifications (recipient_user_id, type, title, body)
        VALUES ('${targetUserId}', 'workspace_access_approved', 'Reconnect Probe', 'Created between SSE connections')
      `);
      expect(await readSseCountSync(targetPage)).toBe(countBeforeReconnect + 1);

      const auditResult = await pool.query<{ action: string }>(`
        SELECT action
        FROM audit_logs
        WHERE workspace_id = '${workspaceId}'
          AND action IN ('workspace_ownership_transferred', 'workspace_member_role_updated')
        ORDER BY created_at
      `);
      expect(auditResult.rows).toStrictEqual([
        { action: 'workspace_ownership_transferred' },
        { action: 'workspace_member_role_updated' },
      ]);
    } finally {
      await Promise.all([ownerContext.close(), targetContext.close()]);
    }
  });
});
