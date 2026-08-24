import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';

const pool = new Pool({ connectionString: Env.DATABASE_URL });

let userId: string;
let sessionId: string;
let sessionToken: string;
let personalWorkspaceId: string;
let outsiderUserId: string;
let outsiderSessionId: string;
let outsiderSessionToken: string;
let outsiderPersonalWorkspaceId: string;
let projectId: string;
let documentId: string;
const seededTitle = 'Smoke 冒烟文档';
const seededBodyText = '冒烟搜索目标词';

function getSignedSessionCookie(token: string) {
  const signature = createHmac('sha256', Env.BETTER_AUTH_SECRET).update(token).digest('base64');
  return encodeURIComponent(`${token}.${signature}`);
}

test.describe('application smoke coverage', () => {
  test.skip(
    Env.COLLABORATION_ENABLED !== 'true',
    'Smoke suite rides the collaboration-enabled stack',
  );

  test.beforeEach(async () => {
    const fixtureId = randomUUID();
    userId = `e2e_smoke_owner_${fixtureId}`;
    sessionId = `e2e_smoke_session_${fixtureId}`;
    sessionToken = `e2e-smoke-token-${fixtureId}`;
    personalWorkspaceId = randomUUID();
    outsiderUserId = `e2e_smoke_outsider_${fixtureId}`;
    outsiderSessionId = `e2e_smoke_outsider_session_${fixtureId}`;
    outsiderSessionToken = `e2e-smoke-outsider-token-${fixtureId}`;
    outsiderPersonalWorkspaceId = randomUUID();
    projectId = randomUUID();
    documentId = randomUUID();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO "user" (id, name, email, email_verified)
        VALUES
          ('${userId}', 'Smoke Owner', '${userId}@example.test', true),
          ('${outsiderUserId}', 'Smoke Outsider', '${outsiderUserId}@example.test', true)
      `);
      await client.query(`
        INSERT INTO "session" (id, expires_at, token, user_id)
        VALUES
          ('${sessionId}', now() + interval '1 day', '${sessionToken}', '${userId}'),
          ('${outsiderSessionId}', now() + interval '1 day', '${outsiderSessionToken}', '${outsiderUserId}')
      `);
      await client.query(`
        INSERT INTO workspaces (id, kind, name, owner_id)
        VALUES
          ('${personalWorkspaceId}', 'personal', 'Smoke Personal', '${userId}'),
          ('${outsiderPersonalWorkspaceId}', 'personal', 'Smoke Outsider Personal', '${outsiderUserId}')
      `);
      await client.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES
          ('${personalWorkspaceId}', '${userId}', 'owner'),
          ('${outsiderPersonalWorkspaceId}', '${outsiderUserId}', 'owner')
      `);
      await client.query(`
        INSERT INTO projects (id, workspace_id, name, owner_id)
        VALUES ('${projectId}', '${personalWorkspaceId}', 'Smoke Project', '${userId}')
      `);
      await client.query(`
        INSERT INTO project_members (project_id, workspace_id, user_id, role)
        VALUES ('${projectId}', '${personalWorkspaceId}', '${userId}', 'owner')
      `);
      await client.query(`
        INSERT INTO documents (id, project_id, title, content, search_text, created_by_id)
        VALUES (
          '${documentId}',
          '${projectId}',
          '${seededTitle}',
          '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"${seededBodyText}"}]}]}'::jsonb,
          '${seededBodyText}',
          '${userId}'
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
    await pool.query(
      `DELETE FROM workspaces WHERE id IN ('${personalWorkspaceId}', '${outsiderPersonalWorkspaceId}')`,
    );
    await pool.query(`DELETE FROM "user" WHERE id IN ('${userId}', '${outsiderUserId}')`);
  });

  async function newAuthenticatedPage(options: {
    baseURL: string;
    browser: Browser;
    sessionToken?: string;
    workspaceId?: string;
  }) {
    const browserContext = await options.browser.newContext();
    await browserContext.addCookies([
      {
        domain: new URL(options.baseURL).hostname,
        httpOnly: true,
        name: 'better-auth.session_token',
        path: '/',
        sameSite: 'Lax',
        value: getSignedSessionCookie(options.sessionToken ?? sessionToken),
      },
      {
        domain: new URL(options.baseURL).hostname,
        httpOnly: true,
        name: 'knowmesh-active-workspace',
        path: '/',
        sameSite: 'Lax',
        value: options.workspaceId ?? personalWorkspaceId,
      },
    ]);
    const page = await browserContext.newPage();
    return {
      page,
      close: async () => {
        await browserContext.close();
      },
    };
  }

  test('edits a personal document and survives a reload through autosave', async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/personal?project=${projectId}&document=${documentId}`);
    const editor = page.locator('.ProseMirror[contenteditable="true"]');
    await expect(editor).toBeVisible();
    await expect(editor).toContainText(seededBodyText);

    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type('自动保存增量A');
    await expect(page.getByText('已保存', { exact: false })).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator('.ProseMirror[contenteditable="true"]')).toContainText(
      '自动保存增量A',
    );

    const projected = await pool.query<{ title: string; text: string }>(`
      SELECT title,
             content #>> '{content,0,content,-1,text}' AS text
      FROM documents
      WHERE id = '${documentId}'
    `);
    expect(projected.rows[0]?.text ?? '').toContain('自动保存增量A');
    await close();
  });

  test("returns not found for another user's personal project and document", async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({
      baseURL,
      browser,
      sessionToken: outsiderSessionToken,
      workspaceId: outsiderPersonalWorkspaceId,
    });

    for (const path of [
      `/personal?project=${projectId}`,
      `/personal?project=${projectId}&document=${documentId}`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { exact: true, name: '404' })).toBeVisible();
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        'content',
        'noindex',
      );
      await expect(page.locator('body')).not.toContainText('Application error');
    }

    await close();
  });

  test('finds seeded documents through the search page', async ({ baseURL, browser }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/search?q=${encodeURIComponent('冒烟搜索目标')}`);
    await expect(page.locator('body')).toContainText(seededTitle);
    await close();
  });

  test('renders authenticated destination pages', async ({ baseURL, browser }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    for (const destination of [
      { heading: '已收藏文档', path: '/starred' },
      { heading: '通知', path: '/notifications' },
      { heading: '邀请链接无效', path: '/invitations/accept' },
      { heading: '系统偏好设置', path: '/settings/preferences' },
      { heading: '账号设置', path: '/settings/user-profile' },
    ]) {
      const response = await page.goto(destination.path);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole('heading', { exact: true, name: destination.heading }),
      ).toBeVisible();
    }
    await close();
  });
});
