import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { authorizeDocument as authorizeDocumentFunction } from '@/features/permissions/server/DocumentAuthorization';
import type { authorizeProject as authorizeProjectFunction } from '@/features/permissions/server/ProjectAuthorization';
import type { authorizeWorkspace as authorizeWorkspaceFunction } from '@/features/permissions/server/WorkspaceAuthorization';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

let database: PGlite;
let authorizeDocument: typeof authorizeDocumentFunction;
let authorizeProject: typeof authorizeProjectFunction;
let authorizeWorkspace: typeof authorizeWorkspaceFunction;

describe('authorization queries', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);

    await database.transaction(async (transaction) => {
      await transaction.query(`
        INSERT INTO "user" (id, name, email)
        VALUES
          ('user_owner', 'Owner', 'owner@example.com'),
          ('user_editor', 'Editor', 'editor@example.com'),
          ('user_viewer', 'Viewer', 'viewer@example.com'),
          ('user_workspace_only', 'Workspace Only', 'workspace_only@example.com')
      `);
      await transaction.query(`
        INSERT INTO workspaces (id, kind, name, owner_id)
        VALUES ('10000000-0000-4000-8000-000000000100', 'team', 'Authorization Team', 'user_owner')
      `);
      await transaction.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES
          ('10000000-0000-4000-8000-000000000100', 'user_owner', 'owner'),
          ('10000000-0000-4000-8000-000000000100', 'user_editor', 'editor'),
          ('10000000-0000-4000-8000-000000000100', 'user_viewer', 'viewer'),
          ('10000000-0000-4000-8000-000000000100', 'user_workspace_only', 'viewer')
      `);
      await transaction.query(`
        INSERT INTO projects (id, workspace_id, name, owner_id)
        VALUES (
          '20000000-0000-4000-8000-000000000100',
          '10000000-0000-4000-8000-000000000100',
          'Authorization Project',
          'user_owner'
        )
      `);
      await transaction.query(`
        INSERT INTO project_members (project_id, user_id, role)
        VALUES
          ('20000000-0000-4000-8000-000000000100', 'user_owner', 'owner'),
          ('20000000-0000-4000-8000-000000000100', 'user_editor', 'editor'),
          ('20000000-0000-4000-8000-000000000100', 'user_viewer', 'viewer')
      `);
      await transaction.query(`
        INSERT INTO documents (id, project_id, title, created_by_id)
        VALUES (
          '30000000-0000-4000-8000-000000000100',
          '20000000-0000-4000-8000-000000000100',
          'Authorization Document',
          'user_owner'
        )
      `);
    });

    const testDb = drizzle(database, { schema });
    vi.doMock('server-only', () => ({}));
    vi.doMock('@/libs/DB', () => ({ db: testDb }));

    ({ authorizeWorkspace } = await import('@/features/permissions/server/WorkspaceAuthorization'));
    ({ authorizeProject } = await import('@/features/permissions/server/ProjectAuthorization'));
    ({ authorizeDocument } = await import('@/features/permissions/server/DocumentAuthorization'));
  }, 30_000);

  afterAll(async () => {
    vi.doUnmock('@/libs/DB');
    vi.doUnmock('server-only');
    await database.close();
  });

  describe('workspace authorization', () => {
    it('grants owner management capability from stored membership', async () => {
      const authorization = await authorizeWorkspace({
        permission: 'workspace.members.manage',
        userId: 'user_owner',
        workspaceId: '10000000-0000-4000-8000-000000000100',
      });

      expect(authorization.decision.isResourceOwner).toBe(true);
      expect(authorization.decision.permissions).toContain('workspace.members.manage');
    });

    it('rejects editor management capability', async () => {
      await expect(
        authorizeWorkspace({
          permission: 'workspace.members.manage',
          userId: 'user_editor',
          workspaceId: '10000000-0000-4000-8000-000000000100',
        }),
      ).rejects.toThrow('没有权限执行该操作');
    });

    it('rejects user outside workspace', async () => {
      await expect(
        authorizeWorkspace({
          permission: 'workspace.read',
          userId: 'user_outside',
          workspaceId: '10000000-0000-4000-8000-000000000100',
        }),
      ).rejects.toThrow('没有权限执行该操作');
    });
  });

  describe('project authorization', () => {
    it('grants direct editor content capability', async () => {
      const authorization = await authorizeProject({
        permission: 'document.update',
        projectId: '20000000-0000-4000-8000-000000000100',
        userId: 'user_editor',
      });

      expect(authorization.decision.permissions).toContain('document.update');
      expect(authorization.project.projectRole).toBe('editor');
    });

    it('limits workspace-only member to project structure', async () => {
      await expect(
        authorizeProject({
          permission: 'project.structure.read',
          projectId: '20000000-0000-4000-8000-000000000100',
          userId: 'user_workspace_only',
        }),
      ).resolves.toMatchObject({ project: { projectRole: null } });

      await expect(
        authorizeProject({
          permission: 'project.read',
          projectId: '20000000-0000-4000-8000-000000000100',
          userId: 'user_workspace_only',
        }),
      ).rejects.toThrow('没有权限执行该操作');
    });

    it('rejects user outside project workspace', async () => {
      await expect(
        authorizeProject({
          permission: 'project.structure.read',
          projectId: '20000000-0000-4000-8000-000000000100',
          userId: 'user_outside',
        }),
      ).rejects.toThrow('没有权限执行该操作');
    });
  });

  describe('document authorization', () => {
    it('grants viewer read capability through project membership', async () => {
      const authorization = await authorizeDocument({
        documentId: '30000000-0000-4000-8000-000000000100',
        permission: 'document.read',
        userId: 'user_viewer',
      });

      expect(authorization.document.title).toBe('Authorization Document');
      expect(authorization.decision.permissions).toContain('document.read');
    });

    it('rejects viewer update capability', async () => {
      await expect(
        authorizeDocument({
          documentId: '30000000-0000-4000-8000-000000000100',
          permission: 'document.update',
          userId: 'user_viewer',
        }),
      ).rejects.toThrow('没有权限执行该操作');
    });

    it('rejects workspace-only member from document content', async () => {
      await expect(
        authorizeDocument({
          documentId: '30000000-0000-4000-8000-000000000100',
          permission: 'document.read',
          userId: 'user_workspace_only',
        }),
      ).rejects.toThrow('没有权限执行该操作');
    });
  });
});
