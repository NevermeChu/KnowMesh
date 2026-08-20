import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { auditLogsSchema } from '@/models/Schema';
import { getWorkspaceAuditLogs } from './GetWorkspaceAuditLogs';
import type { AuditDatabase } from './RecordAuditLog';
import { recordAuditLog } from './RecordAuditLog';

const state = vi.hoisted(() => {
  const currentUser = { email: 'owner@example.com', id: 'user_owner', name: 'Owner' };
  const requireUser = vi.fn<() => Promise<typeof currentUser>>();

  const insertValues = vi.fn<(values: unknown) => Promise<unknown[]>>();
  const insert = vi.fn<(table: unknown) => { values: typeof insertValues }>(() => ({
    values: insertValues,
  }));

  const selectOffset = vi.fn<(offset: number) => Promise<unknown[]>>();
  const selectLimit = vi.fn<(limit: number) => { offset: typeof selectOffset }>(() => ({
    offset: selectOffset,
  }));
  const selectOrderBy = vi.fn<(order: unknown) => { limit: typeof selectLimit }>(() => ({
    limit: selectLimit,
  }));
  const selectWhere = vi.fn<(condition: unknown) => { orderBy: typeof selectOrderBy }>(() => ({
    orderBy: selectOrderBy,
  }));
  const selectFrom = vi.fn<(table: unknown) => { where: typeof selectWhere }>(() => ({
    where: selectWhere,
  }));
  const select = vi.fn<(fields?: unknown) => { from: typeof selectFrom }>(() => ({
    from: selectFrom,
  }));

  const authorizeWorkspace = vi.fn<() => Promise<unknown>>();
  const getUserProfiles = vi.fn<() => Promise<Map<string, unknown>>>();
  const headers = vi.fn<() => Promise<Headers>>();

  return {
    authorizeWorkspace,
    currentUser,
    getUserProfiles,
    headers,
    insert,
    insertValues,
    requireUser,
    select,
    selectFrom,
    selectLimit,
    selectOffset,
    selectOrderBy,
    selectWhere,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial headers mock isolates IP extraction.
vi.mock('next/headers', () => ({ headers: state.headers }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({ requireUser: state.requireUser }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates workspace capability check.
vi.mock('@/features/permissions/server/WorkspaceAuthorization', () => ({
  authorizeWorkspace: state.authorizeWorkspace,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial user profiles mock isolates name and avatar resolution.
vi.mock('@/features/users/server/GetUserProfiles', () => ({
  getUserProfiles: state.getUserProfiles,
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Fluent database mock isolates audit log querying.
vi.mock('@/libs/DB', () => ({
  db: {
    insert: state.insert,
    select: state.select,
  },
}));

describe('audit logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireUser.mockResolvedValue(state.currentUser);
    state.headers.mockResolvedValue(new Headers());
    state.insertValues.mockResolvedValue([]);
    state.selectOffset.mockResolvedValue([]);
    state.getUserProfiles.mockResolvedValue(new Map());
  });

  describe(recordAuditLog, () => {
    it('records an audit log with extracted headers and metadata', async () => {
      const requestHeaders = new Headers({
        'user-agent': 'Mozilla/5.0 TestBrowser',
        'x-forwarded-for': '203.0.113.195, 10.0.0.1',
      });
      state.headers.mockResolvedValueOnce(requestHeaders);

      const dbMock: AuditDatabase = {
        insert: (table: typeof auditLogsSchema) => state.insert(table),
      };
      await recordAuditLog(dbMock, {
        action: 'workspace_ownership_transferred',
        actorUserId: 'user_owner',
        metadata: {
          resourceName: 'Team Workspace',
          targetUserId: 'user_target',
        },
        targetId: 'user_target',
        targetKind: 'member',
        workspaceId: '11111111-1111-4111-8111-111111111111',
      });

      expect(state.insertValues).toHaveBeenCalledWith({
        action: 'workspace_ownership_transferred',
        actorUserId: 'user_owner',
        ipAddress: '203.0.113.195',
        metadata: {
          resourceName: 'Team Workspace',
          targetUserId: 'user_target',
        },
        targetId: 'user_target',
        targetKind: 'member',
        userAgent: 'Mozilla/5.0 TestBrowser',
        workspaceId: '11111111-1111-4111-8111-111111111111',
      });
    });
  });

  describe(getWorkspaceAuditLogs, () => {
    it('rejects query when caller is not the workspace owner', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'team',
          ownerId: 'user_other',
        },
      });

      await expect(
        getWorkspaceAuditLogs({
          workspaceId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow('只有工作区所有者可以查看审计日志');
    });

    it('rejects query for personal workspace', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'personal',
          ownerId: 'user_owner',
        },
      });

      await expect(
        getWorkspaceAuditLogs({
          workspaceId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow('只有工作区所有者可以查看审计日志');
    });

    it('returns formatted audit logs with resolved user profiles for team owner', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'team',
          name: 'Engineering',
          ownerId: 'user_owner',
        },
      });

      const createdAt = new Date('2026-08-19T10:00:00Z');
      state.selectOffset.mockResolvedValueOnce([
        {
          action: 'project_created',
          actorUserId: 'user_owner',
          createdAt,
          id: 'log_1',
          ipAddress: '127.0.0.1',
          metadata: { resourceName: 'KnowMesh App' },
          targetId: 'project_1',
          targetKind: 'project',
          userAgent: 'Chrome',
          workspaceId: '11111111-1111-4111-8111-111111111111',
        },
      ]);

      state.getUserProfiles.mockResolvedValueOnce(
        new Map([
          [
            'user_owner',
            { displayName: 'Alice Owner', email: 'owner@example.com', imageUrl: null },
          ],
        ]),
      );

      const items = await getWorkspaceAuditLogs({
        workspaceId: '11111111-1111-4111-8111-111111111111',
      });

      expect(items).toHaveLength(1);
      expect(items[0]).toStrictEqual({
        action: 'project_created',
        actor: {
          displayName: 'Alice Owner',
          email: 'owner@example.com',
          imageUrl: null,
          userId: 'user_owner',
        },
        createdAt,
        id: 'log_1',
        ipAddress: '127.0.0.1',
        metadata: {
          resourceName: 'KnowMesh App',
          targetUserEmail: null,
          targetUserName: undefined,
        },
        targetId: 'project_1',
        targetKind: 'project',
        userAgent: 'Chrome',
        workspaceId: '11111111-1111-4111-8111-111111111111',
      });
    });

    it('applies requested category page limit and offset on server', async () => {
      state.authorizeWorkspace.mockResolvedValueOnce({
        workspace: {
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'team',
          name: 'Engineering',
          ownerId: 'user_owner',
        },
      });

      await getWorkspaceAuditLogs({
        category: 'resources',
        limit: 51,
        offset: 50,
        workspaceId: '11111111-1111-4111-8111-111111111111',
      });

      expect(state.selectLimit).toHaveBeenCalledWith(51);
      expect(state.selectOffset).toHaveBeenCalledWith(50);
    });
  });
});
