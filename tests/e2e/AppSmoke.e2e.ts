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
let childDocumentId: string;
const seededTitle = 'Smoke 冒烟文档';
const childDocumentTitle = 'Smoke 深层子文档';
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
    childDocumentId = randomUUID();

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
        INSERT INTO documents
          (id, project_id, parent_id, sort_order, title, content, search_text, created_by_id)
        VALUES
          (
            '${documentId}',
            '${projectId}',
            NULL,
            1000,
            '${seededTitle}',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"${seededBodyText}"}]}]}'::jsonb,
            '${seededBodyText}',
            '${userId}'
          ),
          (
            '${childDocumentId}',
            '${projectId}',
            '${documentId}',
            1000,
            '${childDocumentTitle}',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"deep navigation"}]}]}'::jsonb,
            'deep navigation',
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

  test('refreshes the document title node without replacing the sidebar', async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/personal?project=${projectId}&document=${documentId}`);
    const sidebar = page.locator('#app-sidebar');
    await sidebar.evaluate((element) => {
      element.dataset.navigationMarker = 'active';
    });
    const titleInput = page.getByRole('textbox', { name: '文档标题' });
    const personalNavigation = page.getByRole('navigation', { exact: true, name: '个人区域' });
    const renamedTitle = `navigation-title-${Date.now()}`;
    const sidebarTitle = (name: string) =>
      personalNavigation.getByRole('link', { exact: true, name });

    test.setTimeout(60_000);
    await expect(sidebarTitle(seededTitle)).toBeVisible();
    await titleInput.fill(renamedTitle);
    await titleInput.press('Enter');
    await expect(titleInput).toHaveValue(renamedTitle);
    await expect(sidebarTitle(renamedTitle)).toBeVisible({ timeout: 30_000 });
    await expect(sidebar).toHaveAttribute('data-navigation-marker', 'active');

    await titleInput.fill(seededTitle);
    await titleInput.press('Enter');
    await expect(titleInput).toHaveValue(seededTitle);
    await expect(sidebarTitle(seededTitle)).toBeVisible({ timeout: 30_000 });
    await expect(sidebar).toHaveAttribute('data-navigation-marker', 'active');
    await close();
  });

  test('flushes a personal document when navigating before debounce', async ({
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

    const marker = `navigation-flush-${Date.now()}`;
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type(marker);
    await page.getByRole('link', { exact: true, name: '通知' }).click();
    await expect(page.getByRole('heading', { exact: true, name: '通知' })).toBeVisible();

    await expect
      .poll(async () => {
        const projected = await pool.query<{ content: object }>(
          `SELECT content FROM documents WHERE id = '${documentId}'`,
        );
        return JSON.stringify(projected.rows[0]?.content ?? {});
      })
      .toContain(marker);

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

  test('injects and expands only the selected deep navigation path', async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/personal?project=${projectId}&document=${childDocumentId}`);
    const personalNavigation = page.getByRole('navigation', {
      exact: true,
      name: '个人区域',
    });

    await expect(
      personalNavigation.getByRole('button', { name: '收起Smoke Project' }),
    ).toBeVisible();
    await expect(
      personalNavigation.getByRole('link', { exact: true, name: seededTitle }),
    ).toBeVisible();
    await expect(
      personalNavigation.getByRole('link', { exact: true, name: childDocumentTitle }),
    ).toBeVisible();
    await expect(
      personalNavigation.getByRole('button', { name: `收起${seededTitle}` }),
    ).toBeVisible();

    await close();
  });

  test('resizes the desktop sidebar through pointer and keyboard input', async ({
    baseURL,
    browser,
  }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto('/personal');
    const sidebar = page.locator('#app-sidebar');
    const resizeHandle = page.getByRole('button', { name: '调整导航栏宽度' });
    await expect(sidebar).toHaveCSS('width', '190px');
    const handleBounds = await resizeHandle.boundingBox();
    if (!handleBounds) {
      throw new Error('Sidebar resize handle bounds are unavailable');
    }

    await page.mouse.move(
      handleBounds.x + handleBounds.width / 2,
      handleBounds.y + handleBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(280, handleBounds.y + handleBounds.height / 2, { steps: 5 });
    await expect(sidebar).toHaveCSS('width', '280px');
    await page.mouse.up();

    await resizeHandle.press('ArrowRight');
    await expect(sidebar).toHaveCSS('width', '288px');
    await resizeHandle.dblclick();
    await expect(sidebar).toHaveCSS('width', '190px');
    await close();
  });

  test('persists visual preferences without replacing the active editor', async ({
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
    await editor.evaluate((element) => {
      element.dataset.preferenceMarker = 'active';
    });

    await page.getByRole('button', { name: '内容宽度 80%' }).click();
    await page.getByRole('button', { exact: true, name: '60%' }).click();
    await expect(page.getByRole('button', { name: '内容宽度 60%' })).toBeVisible();
    await expect(editor).toHaveAttribute('data-preference-marker', 'active');
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        const cookie = cookies.find((candidate) => candidate.name === 'knowmesh-content-width');
        return cookie?.value;
      })
      .toBe('60');

    await page.getByRole('button', { name: '切换主题' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(editor).toHaveAttribute('data-preference-marker', 'active');
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        const cookie = cookies.find((candidate) => candidate.name === 'knowmesh-theme');
        return cookie?.value;
      })
      .toBe('dark');

    await page.reload();
    await expect(page.getByRole('button', { name: '内容宽度 60%' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await close();
  });

  test('moves a document through sidebar drag targets', async ({ baseURL, browser }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/personal?project=${projectId}&document=${childDocumentId}`);
    const personalNavigation = page.getByRole('navigation', {
      exact: true,
      name: '个人区域',
    });
    const childItem = personalNavigation
      .getByRole('link', { exact: true, name: childDocumentTitle })
      .locator('..');
    const projectItem = personalNavigation
      .getByRole('link', { exact: true, name: 'Smoke Project' })
      .locator('..');
    const parentItem = personalNavigation
      .getByRole('link', { exact: true, name: seededTitle })
      .locator('..');

    await childItem.dragTo(projectItem);
    await expect
      .poll(async () => {
        const result = await pool.query<{ parent_id: string | null }>(
          `SELECT parent_id FROM documents WHERE id = '${childDocumentId}'`,
        );
        return result.rows[0]?.parent_id ?? null;
      })
      .toBeNull();

    await childItem.dragTo(parentItem);
    await expect
      .poll(async () => {
        const result = await pool.query<{ parent_id: string | null }>(
          `SELECT parent_id FROM documents WHERE id = '${childDocumentId}'`,
        );
        return result.rows[0]?.parent_id ?? null;
      })
      .toBe(documentId);

    await close();
  });

  test('deletes a document by refreshing only its parent node', async ({ baseURL, browser }) => {
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/personal?project=${projectId}&document=${documentId}`);
    const sidebar = page.locator('#app-sidebar');
    await sidebar.evaluate((element) => {
      element.dataset.deletionMarker = 'active';
    });
    const personalNavigation = page.getByRole('navigation', {
      exact: true,
      name: '个人区域',
    });
    const childLink = personalNavigation.getByRole('link', {
      exact: true,
      name: childDocumentTitle,
    });
    await personalNavigation.getByRole('button', { name: `展开${seededTitle}` }).click();
    await expect(childLink).toBeVisible();
    await childLink.click({ button: 'right' });
    await page
      .locator('#navigation-context-menu')
      .getByRole('button', { exact: true, name: '管理文件' })
      .click();

    const deleteButtons = page.getByRole('button', { exact: true, name: '删除文件' });
    await expect(deleteButtons).toHaveCount(1);
    await deleteButtons.first().click();
    await expect(deleteButtons).toHaveCount(2);
    await deleteButtons.last().click();

    await expect(childLink).toHaveCount(0);
    await expect(sidebar).toHaveAttribute('data-deletion-marker', 'active');
    await expect
      .poll(async () => {
        const result = await pool.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM documents WHERE id = '${childDocumentId}'`,
        );
        return result.rows[0]?.count;
      })
      .toBe(0);
    await close();
  });

  test('edits, restores, exports, and protects a personal whiteboard conflict', async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(60_000);
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const whiteboardTitle = `Smoke Whiteboard ${randomUUID()}`;
    const { page, close } = await newAuthenticatedPage({ baseURL, browser });
    await page.goto(`/personal?project=${projectId}&document=${documentId}`);
    const personalNavigation = page.getByRole('navigation', {
      exact: true,
      name: '个人区域',
    });
    const projectLink = personalNavigation.getByRole('link', {
      exact: true,
      name: 'Smoke Project',
    });

    await projectLink.click({ button: 'right' });
    await page
      .locator('#navigation-context-menu')
      .getByRole('button', { exact: true, name: '新建文件' })
      .click();
    await page.locator('label').filter({ hasText: '白板' }).click();
    await page.locator('#document-title').fill(whiteboardTitle);
    await page.getByRole('button', { exact: true, name: '创建' }).click();

    await expect(
      page.getByRole('navigation', { exact: true, name: '面包屑' }).getByText(whiteboardTitle, {
        exact: true,
      }),
    ).toBeVisible();
    const whiteboard = page.locator('.excalidraw');
    await expect(whiteboard).toBeVisible();
    await expect(
      personalNavigation.getByRole('link', { exact: true, name: whiteboardTitle }),
    ).toBeVisible();

    const whiteboardId = new URL(page.url()).searchParams.get('document');
    if (!whiteboardId) {
      throw new Error('Created whiteboard ID is unavailable');
    }

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
    await expect(page.getByText('已保存', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        const result = await pool.query<{ element_count: number }>(`
          SELECT jsonb_array_length(scene->'elements')::int AS element_count
          FROM document_whiteboard_states
          WHERE document_id = '${whiteboardId}'
        `);
        return result.rows[0]?.element_count ?? 0;
      })
      .toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator('.excalidraw')).toBeVisible();
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();

    await page.getByRole('button', { exact: true, name: '导出白板' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { exact: true, name: '导出 .excalidraw' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${whiteboardTitle}.excalidraw`);

    await pool.query(`
      UPDATE document_whiteboard_states
      SET revision = revision + 1
      WHERE document_id = '${whiteboardId}'
    `);
    const refreshedBounds = await page.locator('.excalidraw').boundingBox();
    if (!refreshedBounds) {
      throw new Error('Reloaded whiteboard bounds are unavailable');
    }
    await page.locator('.excalidraw').click({
      position: { x: refreshedBounds.width * 0.6, y: refreshedBounds.height * 0.5 },
    });
    await page.keyboard.press('2');
    await page.mouse.move(
      refreshedBounds.x + refreshedBounds.width * 0.62,
      refreshedBounds.y + refreshedBounds.height * 0.32,
    );
    await page.mouse.down();
    await page.mouse.move(
      refreshedBounds.x + refreshedBounds.width * 0.74,
      refreshedBounds.y + refreshedBounds.height * 0.43,
      { steps: 4 },
    );
    await page.mouse.up();
    await expect(page.getByText('其他页面已更新', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/已停止自动覆盖/u)).toBeVisible();

    await close();
  });
});
