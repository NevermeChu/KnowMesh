import 'dotenv/config';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext } from '@playwright/test';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';

const pool = new Pool({ connectionString: Env.DATABASE_URL });
const initialText = 'Crash recovery initial snapshot';
const recoveredText = 'Recovered by one browser replica';
const twoBrowserRecoveredText = 'Recovered by two browser replicas';
const revokedText = 'Revoked replica must not return';

function getSignedSessionCookie(token: string) {
  const signature = createHmac('sha256', Env.BETTER_AUTH_SECRET).update(token).digest('base64');
  return encodeURIComponent(`${token}.${signature}`);
}

async function waitForCollaborationReady() {
  await expect
    .poll(
      async () => {
        try {
          const response = await fetch(
            `http://${Env.COLLABORATION_ADDRESS}:${Env.COLLABORATION_HEALTH_PORT}/ready`,
          );
          return response.ok;
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    )
    .toBeTruthy();
}

function startCollaborationServer() {
  const child = spawn(
    process.execPath,
    ['--import=tsx', resolve(process.cwd(), 'scripts/collaboration-server.ts')],
    {
      cwd: process.cwd(),
      detached: true,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true,
    },
  );
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
  return child;
}

async function hardKillCollaborationServer(child: ChildProcess) {
  if (!child.pid) {
    throw new Error('Collaboration process has no PID');
  }
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    if (result.status !== 0) {
      throw new Error(`Failed to hard-kill collaboration process ${child.pid}`);
    }
  } else {
    process.kill(-child.pid, 'SIGKILL');
  }
  if (child.exitCode === null && child.signalCode === null) {
    await once(child, 'exit');
  }
}

async function stopCollaborationServer(child: ChildProcess | null) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  if (child.connected) {
    child.send({ type: 'shutdown' });
  }
  await Promise.race([once(child, 'exit'), delay(20_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    await hardKillCollaborationServer(child);
  }
}

async function createAuthenticatedContext(options: {
  baseURL: string;
  browser: Browser;
  sessionToken: string;
  workspaceId: string;
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
      value: options.workspaceId,
    },
  ]);
  return context;
}

test.describe('team document hard-crash recovery', () => {
  test.skip(
    process.env.E2E_COLLABORATION_CRASH_RECOVERY !== 'true',
    'Hard-crash recovery requires an externally managed Next.js process',
  );

  test.afterAll(async () => {
    await pool.end();
  });

  test('recovers two browser replicas and rejects a revoked cached update', async ({
    baseURL,
    browser,
  }) => {
    test.setTimeout(120_000);
    if (!baseURL) {
      throw new Error('Playwright base URL is unavailable');
    }

    const fixtureId = randomUUID();
    const ownerUserId = `e2e_crash_owner_${fixtureId}`;
    const editorUserId = `e2e_crash_editor_${fixtureId}`;
    const ownerSessionToken = `e2e-crash-owner-token-${fixtureId}`;
    const editorSessionToken = `e2e-crash-editor-token-${fixtureId}`;
    const ownerPersonalWorkspaceId = randomUUID();
    const editorPersonalWorkspaceId = randomUUID();
    const workspaceId = randomUUID();
    const projectId = randomUUID();
    const documentId = randomUUID();
    const contexts: BrowserContext[] = [];
    let collaborationProcess: ChildProcess | null = null;

    await pool.query(`
      INSERT INTO "user" (id, name, email, email_verified)
      VALUES
        ('${ownerUserId}', 'Crash Owner', '${ownerUserId}@example.test', true),
        ('${editorUserId}', 'Crash Editor', '${editorUserId}@example.test', true);
      INSERT INTO "session" (id, expires_at, token, user_id)
      VALUES
        ('${randomUUID()}', now() + interval '1 day', '${ownerSessionToken}', '${ownerUserId}'),
        ('${randomUUID()}', now() + interval '1 day', '${editorSessionToken}', '${editorUserId}');
      INSERT INTO workspaces (id, kind, name, owner_id)
      VALUES
        ('${ownerPersonalWorkspaceId}', 'personal', 'Crash Owner Personal', '${ownerUserId}'),
        ('${editorPersonalWorkspaceId}', 'personal', 'Crash Editor Personal', '${editorUserId}'),
        ('${workspaceId}', 'team', 'Crash Recovery Team', '${ownerUserId}');
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES
        ('${ownerPersonalWorkspaceId}', '${ownerUserId}', 'owner'),
        ('${editorPersonalWorkspaceId}', '${editorUserId}', 'owner'),
        ('${workspaceId}', '${ownerUserId}', 'owner'),
        ('${workspaceId}', '${editorUserId}', 'editor');
      INSERT INTO projects (id, workspace_id, name, owner_id)
      VALUES ('${projectId}', '${workspaceId}', 'Crash Recovery Project', '${ownerUserId}');
      INSERT INTO project_members (project_id, workspace_id, user_id, role)
      VALUES
        ('${projectId}', '${workspaceId}', '${ownerUserId}', 'owner'),
        ('${projectId}', '${workspaceId}', '${editorUserId}', 'editor');
      INSERT INTO documents (id, project_id, title, content, created_by_id)
      VALUES (
        '${documentId}',
        '${projectId}',
        'Crash Recovery Document',
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"${initialText}"}]}]}'::jsonb,
        '${ownerUserId}'
      );
    `);

    try {
      collaborationProcess = startCollaborationServer();
      await waitForCollaborationReady();
      const ownerContext = await createAuthenticatedContext({
        baseURL,
        browser,
        sessionToken: ownerSessionToken,
        workspaceId,
      });
      const editorContext = await createAuthenticatedContext({
        baseURL,
        browser,
        sessionToken: editorSessionToken,
        workspaceId,
      });
      contexts.push(ownerContext, editorContext);
      const route = `/collaboration?project=${projectId}&document=${documentId}`;
      let ownerPage = await ownerContext.newPage();
      let editorPage = await editorContext.newPage();
      await Promise.all([ownerPage.goto(route), editorPage.goto(route)]);
      await expect(ownerPage.getByText('已同步', { exact: true })).toBeVisible();
      await expect(editorPage.getByText('已同步', { exact: true })).toBeVisible();

      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 999
        WHERE document_id = '${documentId}'
      `);
      await ownerPage.locator('.ProseMirror[contenteditable="true"]').fill(recoveredText);
      await expect(editorPage.locator('.ProseMirror')).toContainText(recoveredText);
      await expect(ownerPage.getByText('保存失败', { exact: true })).toBeVisible();
      await hardKillCollaborationServer(collaborationProcess);
      collaborationProcess = null;
      await Promise.all([ownerPage.close(), editorPage.close()]);
      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 1
        WHERE document_id = '${documentId}'
      `);

      collaborationProcess = startCollaborationServer();
      await waitForCollaborationReady();
      ownerPage = await ownerContext.newPage();
      await ownerPage.goto(route);
      await expect(ownerPage.locator('.ProseMirror[contenteditable="true"]')).toContainText(
        recoveredText,
      );
      await expect
        .poll(async () => {
          const result = await pool.query<{ text: string }>(`
            SELECT content #>> '{content,0,content,0,text}' AS text
            FROM documents WHERE id = '${documentId}'
          `);
          return result.rows[0]?.text;
        })
        .toBe(recoveredText);

      editorPage = await editorContext.newPage();
      await editorPage.goto(route);
      await expect(editorPage.locator('.ProseMirror[contenteditable="true"]')).toContainText(
        recoveredText,
      );

      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 999
        WHERE document_id = '${documentId}'
      `);
      await editorPage
        .locator('.ProseMirror[contenteditable="true"]')
        .fill(twoBrowserRecoveredText);
      await expect(ownerPage.locator('.ProseMirror')).toContainText(twoBrowserRecoveredText);
      await expect(editorPage.getByText('保存失败', { exact: true })).toBeVisible();
      await hardKillCollaborationServer(collaborationProcess);
      collaborationProcess = null;
      await Promise.all([ownerPage.close(), editorPage.close()]);
      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 1
        WHERE document_id = '${documentId}'
      `);

      collaborationProcess = startCollaborationServer();
      await waitForCollaborationReady();
      ownerPage = await ownerContext.newPage();
      editorPage = await editorContext.newPage();
      await Promise.all([ownerPage.goto(route), editorPage.goto(route)]);
      await expect(ownerPage.locator('.ProseMirror[contenteditable="true"]')).toContainText(
        twoBrowserRecoveredText,
      );
      await expect(editorPage.locator('.ProseMirror[contenteditable="true"]')).toContainText(
        twoBrowserRecoveredText,
      );
      await expect
        .poll(async () => {
          const result = await pool.query<{ text: string }>(`
            SELECT content #>> '{content,0,content,0,text}' AS text
            FROM documents WHERE id = '${documentId}'
          `);
          return result.rows[0]?.text;
        })
        .toBe(twoBrowserRecoveredText);

      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 999
        WHERE document_id = '${documentId}'
      `);
      await editorPage.locator('.ProseMirror[contenteditable="true"]').fill(revokedText);
      await expect(ownerPage.locator('.ProseMirror')).toContainText(revokedText);
      await expect(editorPage.getByText('保存失败', { exact: true })).toBeVisible();
      await hardKillCollaborationServer(collaborationProcess);
      collaborationProcess = null;
      await Promise.all([ownerPage.close(), editorPage.close()]);
      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 1
        WHERE document_id = '${documentId}';
        UPDATE project_members
        SET role = 'viewer'
        WHERE project_id = '${projectId}' AND user_id = '${editorUserId}';
      `);

      collaborationProcess = startCollaborationServer();
      await waitForCollaborationReady();
      editorPage = await editorContext.newPage();
      await editorPage.goto(route);
      await expect(editorPage.locator('.ProseMirror[contenteditable="false"]')).toContainText(
        twoBrowserRecoveredText,
      );
      await expect(editorPage.locator('.ProseMirror')).not.toContainText(revokedText);
      await expect(editorPage.getByText('只读模式', { exact: true })).toBeVisible();
      await expect
        .poll(async () => {
          const result = await pool.query<{ text: string }>(`
            SELECT content #>> '{content,0,content,0,text}' AS text
            FROM documents WHERE id = '${documentId}'
          `);
          return result.rows[0]?.text;
        })
        .toBe(twoBrowserRecoveredText);
    } finally {
      await pool.query(`
        UPDATE document_collaboration_states
        SET document_schema_version = 1
        WHERE document_id = '${documentId}'
      `);
      for (const context of contexts) {
        await context.close();
      }
      await stopCollaborationServer(collaborationProcess);
      await pool.query(`
        DELETE FROM workspaces
        WHERE id IN ('${workspaceId}', '${ownerPersonalWorkspaceId}', '${editorPersonalWorkspaceId}');
        DELETE FROM "user" WHERE id IN ('${ownerUserId}', '${editorUserId}');
      `);
    }
  });
});
