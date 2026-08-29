import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';
import type { Browser, Page, Route } from '@playwright/test';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';

const pool = new Pool({ connectionString: Env.DATABASE_URL });

let userId: string;
let sessionId: string;
let sessionToken: string;
let personalWorkspaceId: string;
let projectId: string;
let paletteRootId: string;
let paletteMidId: string;
let retryChildId: string;
let lateDocId: string;

const projectName = 'Resilience Project';
const paletteRootTitle = '面包屑根文档';
const paletteMidTitle = '面包屑子层文档';
const retryChildTitle = '重试后可见文档';
const lateDocTitle = '孤本词文档';
const sharedSearchTerm = '面包屑';
const exclusiveSearchTerm = '孤本词';

function getSignedSessionCookie(token: string) {
  const signature = createHmac('sha256', Env.BETTER_AUTH_SECRET).update(token).digest('base64');
  return encodeURIComponent(`${token}.${signature}`);
}

const abortNextPostRequest = (abortsLeft: number) => {
  let remaining = abortsLeft;
  return async (route: Route) => {
    if (remaining > 0 && route.request().method() === 'POST') {
      remaining -= 1;
      await route.abort('failed');
      return;
    }
    await route.continue();
  };
};

/**
 * Opens the palette from the sidebar so tests do not race Ctrl+K before hydration.
 *
 * @param page - Authenticated Playwright page already on a workspace route.
 * @returns Locator for the open command palette dialog.
 */
async function openCommandPalette(page: Page) {
  const paletteDialog = page.getByRole('dialog', { exact: true, name: '快捷指令面板' });
  const searchLink = page
    .getByRole('navigation', { exact: true, name: '主要导航' })
    .getByRole('link', { name: /搜索/u });
  await expect(searchLink).toBeVisible();
  await searchLink.click();
  await expect(paletteDialog).toBeVisible();
  return paletteDialog;
}

test.describe('sidebar navigation and command palette resilience', () => {
  test.skip(
    Env.COLLABORATION_ENABLED !== 'true',
    'Resilience suite rides the collaboration-enabled stack',
  );

  test.beforeEach(async () => {
    const fixtureId = randomUUID();
    userId = `e2e_resilience_owner_${fixtureId}`;
    sessionId = `e2e_resilience_session_${fixtureId}`;
    sessionToken = `e2e-resilience-token-${fixtureId}`;
    personalWorkspaceId = randomUUID();
    projectId = randomUUID();
    paletteRootId = randomUUID();
    paletteMidId = randomUUID();
    retryChildId = randomUUID();
    lateDocId = randomUUID();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO "user" (id, name, email, email_verified)
        VALUES ('${userId}', 'Resilience Owner', '${userId}@example.test', true)
      `);
      await client.query(`
        INSERT INTO "session" (id, expires_at, token, user_id)
        VALUES ('${sessionId}', now() + interval '1 day', '${sessionToken}', '${userId}')
      `);
      await client.query(`
        INSERT INTO workspaces (id, kind, name, owner_id)
        VALUES ('${personalWorkspaceId}', 'personal', 'Resilience Personal', '${userId}')
      `);
      await client.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES ('${personalWorkspaceId}', '${userId}', 'owner')
      `);
      await client.query(`
        INSERT INTO projects (id, workspace_id, name, owner_id)
        VALUES ('${projectId}', '${personalWorkspaceId}', '${projectName}', '${userId}')
      `);
      await client.query(`
        INSERT INTO project_members (project_id, workspace_id, user_id, role)
        VALUES ('${projectId}', '${personalWorkspaceId}', '${userId}', 'owner')
      `);
      await client.query(`
        INSERT INTO documents
          (id, project_id, parent_id, sort_order, title, content, search_text, created_by_id)
        VALUES
          (
            '${paletteRootId}',
            '${projectId}',
            NULL,
            1000,
            '${paletteRootTitle}',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"palette 共享检索词"}]}]}'::jsonb,
            'palette 共享检索词',
            '${userId}'
          ),
          (
            '${paletteMidId}',
            '${projectId}',
            '${paletteRootId}',
            2000,
            '${paletteMidTitle}',
            '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
            'palette 共享检索词',
            '${userId}'
          ) ,
          (
            '${retryChildId}',
            '${projectId}',
            '${paletteRootId}',
            3000,
            '${retryChildTitle}',
            '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
            'retry child body',
            '${userId}'
          ),
          (
            '${lateDocId}',
            '${projectId}',
            NULL,
            4000,
            '${lateDocTitle}',
            '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
            '${exclusiveSearchTerm}',
            '${userId}'
          )
      `);
      // Deterministic relevance tie-break for the two shared-term documents.
      await client.query(`
        UPDATE documents
        SET updated_at = timestamptz '2026-01-01 00:00:00+00'
        WHERE id IN ('${paletteRootId}', '${paletteMidId}')
      `);
      await client.query(`
        UPDATE documents
        SET updated_at = timestamptz '2026-01-01 01:00:00+00'
        WHERE id = '${paletteMidId}'
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
    await pool.query(`DELETE FROM workspaces WHERE id = '${personalWorkspaceId}'`);
    await pool.query(`DELETE FROM "user" WHERE id = '${userId}'`);
  });

  async function newAuthenticatedPage(options: { baseURL: string; browser: Browser }) {
    const browserContext = await options.browser.newContext();
    await browserContext.addCookies([
      {
        domain: new URL(options.baseURL).hostname,
        httpOnly: true,
        name: 'better-auth.session_token',
        path: '/',
        sameSite: 'Lax',
        value: getSignedSessionCookie(sessionToken),
      },
      {
        domain: new URL(options.baseURL).hostname,
        httpOnly: true,
        name: 'knowmesh-active-workspace',
        path: '/',
        sameSite: 'Lax',
        value: personalWorkspaceId,
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

  test('recovers sidebar pagination through the retry control after a failed request', async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    // The first POST is the project root page request fired by expanding the project.
    await page.route('**/personal**', abortNextPostRequest(1));
    await page.goto('/personal');

    const personalNavigation = page.getByRole('navigation', {
      exact: true,
      name: '个人区域',
    });
    const expandSectionButton = personalNavigation.getByRole('button', {
      exact: true,
      name: '展开个人区域',
    });
    await expect(expandSectionButton).toBeVisible();
    await expandSectionButton.click();

    const expandProjectButton = personalNavigation.getByRole('button', {
      exact: true,
      name: `展开${projectName}`,
    });
    await expect(expandProjectButton).toBeVisible();
    await expandProjectButton.click();

    const retryButton = personalNavigation.getByRole('button', {
      exact: true,
      name: '加载失败，点击重试',
    });
    await expect(retryButton).toBeVisible();

    await retryButton.click();
    await expect(
      personalNavigation.getByRole('link', { exact: true, name: paletteRootTitle }),
    ).toBeVisible();

    await close();
  });

  test('navigates to the highlighted search result with palette keyboard controls', async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/personal?project=${projectId}`);
    const paletteDialog = await openCommandPalette(page);

    await page.keyboard.type(sharedSearchTerm);
    const midResult = paletteDialog.getByRole('button', {
      exact: true,
      name: `打开文档 ${paletteMidTitle}`,
    });
    const rootResult = paletteDialog.getByRole('button', {
      exact: true,
      name: `打开文档 ${paletteRootTitle}`,
    });
    await expect(midResult).toBeVisible();
    await expect(rootResult).toBeVisible();

    // Newest-first ordering puts the mid document first; ArrowDown highlights the root document.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(new RegExp(`document=${paletteRootId}`, 'u'));
    await expect(page.locator('.ProseMirror[contenteditable="true"]')).toContainText(
      'palette 共享检索词',
    );
    await expect(paletteDialog).toBeHidden();

    await close();
  });

  test('keeps newer palette results when an older search resolves late', async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/personal?project=${projectId}`);
    const paletteDialog = await openCommandPalette(page);

    const requestIncludesSharedTerm = (method: string, postData: string | null) =>
      method === 'POST' && (postData ?? '').includes(`"query":"${sharedSearchTerm}"`);

    await page.route('**/personal**', async (route) => {
      const request = route.request();
      if (requestIncludesSharedTerm(request.method(), request.postData())) {
        await delay(2500);
      }
      await route.continue();
    });

    // Put the shared-term request in flight, then replace it before it resolves.
    const inFlightSharedRequest = page.waitForRequest((request) =>
      requestIncludesSharedTerm(request.method(), request.postData()),
    );
    const lateSharedResponse = page.waitForResponse((response) =>
      requestIncludesSharedTerm(response.request().method(), response.request().postData()),
    );
    await page.keyboard.type(sharedSearchTerm);
    await inFlightSharedRequest;

    for (const _keystroke of Array.from({ length: sharedSearchTerm.length })) {
      await page.keyboard.press('Backspace');
    }
    await page.keyboard.type(exclusiveSearchTerm);

    const lateResult = paletteDialog.getByRole('button', {
      exact: true,
      name: `打开文档 ${lateDocTitle}`,
    });
    await expect(lateResult).toBeVisible();

    // The stale response lands after the newer query already owns the palette.
    await lateSharedResponse;
    await expect(lateResult).toBeVisible();
    await expect(
      paletteDialog.getByRole('button', { exact: true, name: `打开文档 ${paletteRootTitle}` }),
    ).toBeHidden();
    await expect(
      paletteDialog.getByRole('button', { exact: true, name: `打开文档 ${paletteMidTitle}` }),
    ).toBeHidden();

    await close();
  });
});
