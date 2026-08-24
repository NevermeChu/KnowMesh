import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { getPendingApprovals as getPendingApprovalsType } from '@/features/permissions/server/GetPendingApprovals';
import type {
  acceptProjectInvitation as acceptProjectInvitationType,
  approveProjectAccessRequest as approveProjectAccessRequestType,
  rejectProjectAccessRequest as rejectProjectAccessRequestType,
  rejectProjectInvitation as rejectProjectInvitationType,
} from '@/features/permissions/server/ProjectMembers';
import type {
  acceptWorkspaceInvitationInApp as acceptWorkspaceInvitationInAppType,
  approveWorkspaceAccessRequest as approveWorkspaceAccessRequestType,
  declineWorkspaceInvitationInApp as declineWorkspaceInvitationInAppType,
  rejectWorkspaceAccessRequest as rejectWorkspaceAccessRequestType,
} from '@/features/permissions/server/WorkspaceMembers';
import type { getPendingInvitations as getPendingInvitationsType } from '@/features/workspaces/server/GetPendingInvitations';
import type { getWorkspaceInvitation as getWorkspaceInvitationType } from '@/features/workspaces/server/GetWorkspaceInvitation';
import * as schema from '@/models/Schema';
import { createTestPGlite, executeMigrations, migrationFiles } from './helpers/PGliteMigrations';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => await Promise.resolve(new Headers()),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

let database: PGlite;
let acceptWorkspaceInvitationInApp: typeof acceptWorkspaceInvitationInAppType;
let declineWorkspaceInvitationInApp: typeof declineWorkspaceInvitationInAppType;
let approveWorkspaceAccessRequest: typeof approveWorkspaceAccessRequestType;
let rejectWorkspaceAccessRequest: typeof rejectWorkspaceAccessRequestType;
let acceptProjectInvitation: typeof acceptProjectInvitationType;
let rejectProjectInvitation: typeof rejectProjectInvitationType;
let approveProjectAccessRequest: typeof approveProjectAccessRequestType;
let rejectProjectAccessRequest: typeof rejectProjectAccessRequestType;
let getPendingApprovals: typeof getPendingApprovalsType;
let getPendingInvitations: typeof getPendingInvitationsType;
let getWorkspaceInvitation: typeof getWorkspaceInvitationType;

let currentUser = {
  email: 'invitee@knowmesh.test',
  id: 'user_invitee',
  name: 'Invitee User',
};

describe('in-app invitations and direct actions', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await executeMigrations(database, migrationFiles);

    const testDb = drizzle(database, { schema });

    vi.doMock('@/libs/DB', () => ({
      db: testDb,
    }));

    vi.doMock('@/features/auth/server/CurrentUser', () => ({
      requireUser: async () => await Promise.resolve(currentUser),
    }));

    const workspaceMembersModule = await import('@/features/permissions/server/WorkspaceMembers');
    ({
      acceptWorkspaceInvitationInApp,
      approveWorkspaceAccessRequest,
      declineWorkspaceInvitationInApp,
      rejectWorkspaceAccessRequest,
    } = workspaceMembersModule);

    const projectMembersModule = await import('@/features/permissions/server/ProjectMembers');
    ({
      acceptProjectInvitation,
      approveProjectAccessRequest,
      rejectProjectAccessRequest,
      rejectProjectInvitation,
    } = projectMembersModule);

    const pendingApprovalsModule =
      await import('@/features/permissions/server/GetPendingApprovals');
    ({ getPendingApprovals } = pendingApprovalsModule);

    const pendingInvitationsModule =
      await import('@/features/workspaces/server/GetPendingInvitations');
    ({ getPendingInvitations } = pendingInvitationsModule);

    const workspaceInvitationModule =
      await import('@/features/workspaces/server/GetWorkspaceInvitation');
    ({ getWorkspaceInvitation } = workspaceInvitationModule);

    await database.transaction(async (transaction) => {
      await transaction.query(`
        INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
        VALUES
          ('user_owner', 'Owner User', 'owner@knowmesh.test', true, NOW(), NOW()),
          ('user_invitee', 'Invitee User', 'invitee@knowmesh.test', true, NOW(), NOW()),
          ('user_other', 'Other User', 'other@knowmesh.test', true, NOW(), NOW())
      `);

      await transaction.query(`
        INSERT INTO workspaces (id, kind, name, owner_id)
        VALUES
          ('10000000-0000-4000-8000-000000000201', 'team', 'Test Workspace 1', 'user_owner'),
          ('10000000-0000-4000-8000-000000000202', 'team', 'Test Workspace 2', 'user_owner'),
          ('10000000-0000-4000-8000-000000000203', 'team', 'Test Workspace 3', 'user_owner')
      `);

      await transaction.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES
          ('10000000-0000-4000-8000-000000000201', 'user_owner', 'owner'),
          ('10000000-0000-4000-8000-000000000202', 'user_owner', 'owner'),
          ('10000000-0000-4000-8000-000000000203', 'user_owner', 'owner')
      `);

      await transaction.query(`
        INSERT INTO projects (id, workspace_id, name, owner_id)
        VALUES
          ('20000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000201', 'Test Project 1', 'user_owner'),
          ('20000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000201', 'Test Project 2', 'user_owner')
      `);

      await transaction.query(`
        INSERT INTO project_members (project_id, user_id, role, workspace_id)
        VALUES
          ('20000000-0000-4000-8000-000000000201', 'user_owner', 'owner', '10000000-0000-4000-8000-000000000201'),
          ('20000000-0000-4000-8000-000000000202', 'user_owner', 'owner', '10000000-0000-4000-8000-000000000201')
      `);
    });
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('accepts workspace invitation in-app and auto-marks notification as read', async () => {
    currentUser = {
      email: 'invitee@knowmesh.test',
      id: 'user_invitee',
      name: 'Invitee User',
    };
    const workspaceId = '10000000-0000-4000-8000-000000000201';

    await database.query(`
      INSERT INTO workspace_invitations (id, workspace_id, email, token_hash, invited_by_id, expires_at)
      VALUES (
        '40000000-0000-4000-8000-000000000201',
        '${workspaceId}',
        'invitee@knowmesh.test',
        'hash123',
        'user_owner',
        NOW() + INTERVAL '7 days'
      )
    `);

    await database.query(`
      INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, title, body, target_kind, target_id)
      VALUES (
        '50000000-0000-4000-8000-000000000201',
        'user_invitee',
        'user_owner',
        'workspace_invited',
        '邀请加入工作区',
        '邀请加入 Test Workspace 1',
        'workspace',
        '${workspaceId}'
      )
    `);

    const result = await acceptWorkspaceInvitationInApp({ workspaceId });
    expect(result.workspaceId).toBe(workspaceId);

    const memberResult = await database.query<{ role: string }>(
      `SELECT * FROM workspace_members WHERE workspace_id = '${workspaceId}' AND user_id = 'user_invitee'`,
    );
    expect(memberResult.rows.length).toBe(1);
    expect(memberResult.rows[0]?.role).toBe('viewer');

    const notifResult = await database.query<{ read_at: string | null }>(
      `SELECT read_at FROM notifications WHERE id = '50000000-0000-4000-8000-000000000201'`,
    );
    expect(notifResult.rows[0]?.read_at).not.toBeNull();
  });

  it('declines workspace invitation in-app and auto-marks notification as read', async () => {
    currentUser = {
      email: 'invitee@knowmesh.test',
      id: 'user_invitee',
      name: 'Invitee User',
    };
    const workspaceId = '10000000-0000-4000-8000-000000000202';

    await database.query(`
      INSERT INTO workspace_invitations (id, workspace_id, email, token_hash, invited_by_id, expires_at)
      VALUES (
        '40000000-0000-4000-8000-000000000202',
        '${workspaceId}',
        'invitee@knowmesh.test',
        'hash456',
        'user_owner',
        NOW() + INTERVAL '7 days'
      )
    `);

    await database.query(`
      INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, title, body, target_kind, target_id)
      VALUES (
        '50000000-0000-4000-8000-000000000202',
        'user_invitee',
        'user_owner',
        'workspace_invited',
        '邀请加入工作区',
        '邀请加入 Test Workspace 2',
        'workspace',
        '${workspaceId}'
      )
    `);

    const result = await declineWorkspaceInvitationInApp({ workspaceId });
    expect(result.workspaceId).toBe(workspaceId);

    const invResult = await database.query<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM workspace_invitations WHERE id = '40000000-0000-4000-8000-000000000202'`,
    );
    expect(invResult.rows[0]?.revoked_at).not.toBeNull();

    const notifResult = await database.query<{ read_at: string | null }>(
      `SELECT read_at FROM notifications WHERE id = '50000000-0000-4000-8000-000000000202'`,
    );
    expect(notifResult.rows[0]?.read_at).not.toBeNull();
  });

  it('fetches pending invitations with workspaceId and invitationId', async () => {
    currentUser = {
      email: 'invitee@knowmesh.test',
      id: 'user_invitee',
      name: 'Invitee User',
    };
    const workspaceId = '10000000-0000-4000-8000-000000000203';

    await database.query(`
      INSERT INTO workspace_invitations (id, workspace_id, email, token_hash, invited_by_id, expires_at)
      VALUES (
        '40000000-0000-4000-8000-000000000203',
        '${workspaceId}',
        'invitee@knowmesh.test',
        'hash789',
        'user_owner',
        NOW() + INTERVAL '7 days'
      )
    `);

    const invitations = await getPendingInvitations();
    expect(invitations.length).toBeGreaterThan(0);
    const item = invitations.find((inv) => inv.workspaceId === workspaceId);
    expect(item).toBeDefined();
    expect(item?.workspaceName).toBe('Test Workspace 3');
    expect(item?.invitationId).toBe('40000000-0000-4000-8000-000000000203');
  });

  it('fetches workspace invitation summary by workspaceId', async () => {
    currentUser = {
      email: 'invitee@knowmesh.test',
      id: 'user_invitee',
      name: 'Invitee User',
    };
    const workspaceId = '10000000-0000-4000-8000-000000000203';

    const result = await getWorkspaceInvitation({ workspaceId });
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.invitation.workspaceName).toBe('Test Workspace 3');
      expect(result.invitation.inviteeEmail).toBe('invitee@knowmesh.test');
    }
  });

  it('approves workspace access request and auto-marks notification as read', async () => {
    currentUser = {
      email: 'owner@knowmesh.test',
      id: 'user_owner',
      name: 'Owner User',
    };
    const workspaceId = '10000000-0000-4000-8000-000000000201';

    await database.query(`
      INSERT INTO workspace_access_requests (workspace_id, user_id, requested_role)
      VALUES ('${workspaceId}', 'user_invitee', 'editor')
    `);

    await database.query(`
      INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, title, body, target_kind, target_id)
      VALUES (
        '50000000-0000-4000-8000-000000000204',
        'user_owner',
        'user_invitee',
        'workspace_access_requested',
        '权限申请',
        '申请 Editor 权限',
        'workspace',
        '${workspaceId}'
      )
    `);

    await approveWorkspaceAccessRequest({
      memberUserId: 'user_invitee',
      workspaceId,
    });

    const memberResult = await database.query<{ role: string }>(
      `SELECT role FROM workspace_members WHERE workspace_id = '${workspaceId}' AND user_id = 'user_invitee'`,
    );
    expect(memberResult.rows[0]?.role).toBe('editor');

    const notifResult = await database.query<{ read_at: string | null }>(
      `SELECT read_at FROM notifications WHERE id = '50000000-0000-4000-8000-000000000204'`,
    );
    expect(notifResult.rows[0]?.read_at).not.toBeNull();
  });

  it('rejects workspace access request and auto-marks notification as read', async () => {
    currentUser = {
      email: 'owner@knowmesh.test',
      id: 'user_owner',
      name: 'Owner User',
    };
    const workspaceId = '10000000-0000-4000-8000-000000000202';

    await database.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('${workspaceId}', 'user_other', 'viewer')
    `);

    await database.query(`
      INSERT INTO workspace_access_requests (workspace_id, user_id, requested_role)
      VALUES ('${workspaceId}', 'user_other', 'editor')
    `);

    await database.query(`
      INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, title, body, target_kind, target_id)
      VALUES (
        '50000000-0000-4000-8000-000000000205',
        'user_owner',
        'user_other',
        'workspace_access_requested',
        '权限申请',
        '申请 Editor 权限',
        'workspace',
        '${workspaceId}'
      )
    `);

    await rejectWorkspaceAccessRequest({
      memberUserId: 'user_other',
      workspaceId,
    });

    const reqResult = await database.query<{ user_id: string }>(
      `SELECT user_id FROM workspace_access_requests WHERE workspace_id = '${workspaceId}' AND user_id = 'user_other'`,
    );
    expect(reqResult.rows.length).toBe(0);

    const notifResult = await database.query<{ read_at: string | null }>(
      `SELECT read_at FROM notifications WHERE id = '50000000-0000-4000-8000-000000000205'`,
    );
    expect(notifResult.rows[0]?.read_at).not.toBeNull();
  });

  it('accepts and rejects project invitations and marks notifications as read', async () => {
    currentUser = {
      email: 'invitee@knowmesh.test',
      id: 'user_invitee',
      name: 'Invitee User',
    };
    const projectId1 = '20000000-0000-4000-8000-000000000201';
    const projectId2 = '20000000-0000-4000-8000-000000000202';

    await database.query(`
      INSERT INTO project_invitations (project_id, user_id, invited_by_id)
      VALUES
        ('${projectId1}', 'user_invitee', 'user_owner'),
        ('${projectId2}', 'user_invitee', 'user_owner')
    `);

    await database.query(`
      INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, title, body, target_kind, target_id)
      VALUES
        ('50000000-0000-4000-8000-000000000206', 'user_invitee', 'user_owner', 'project_invited', '项目邀请', '邀请加入 Project 1', 'project', '${projectId1}'),
        ('50000000-0000-4000-8000-000000000207', 'user_invitee', 'user_owner', 'project_invited', '项目邀请', '邀请加入 Project 2', 'project', '${projectId2}')
    `);

    await acceptProjectInvitation({ projectId: projectId1 });
    await rejectProjectInvitation({ projectId: projectId2 });

    const memberResult = await database.query<{ role: string }>(
      `SELECT role FROM project_members WHERE project_id = '${projectId1}' AND user_id = 'user_invitee'`,
    );
    expect(memberResult.rows.length).toBe(1);

    const notifResult1 = await database.query<{ read_at: string | null }>(
      `SELECT read_at FROM notifications WHERE id = '50000000-0000-4000-8000-000000000206'`,
    );
    const notifResult2 = await database.query<{ read_at: string | null }>(
      `SELECT read_at FROM notifications WHERE id = '50000000-0000-4000-8000-000000000207'`,
    );
    expect(notifResult1.rows[0]?.read_at).not.toBeNull();
    expect(notifResult2.rows[0]?.read_at).not.toBeNull();
  });

  it('approves and rejects project access requests and marks notifications as read', async () => {
    const projectId = '20000000-0000-4000-8000-000000000201';
    currentUser = {
      email: 'owner@knowmesh.test',
      id: 'user_owner',
      name: 'Owner User',
    };

    await database.query(`
      INSERT INTO project_access_requests (project_id, user_id, requested_role)
      VALUES
        ('${projectId}', 'user_invitee', 'editor')
    `);

    await database.query(`
      INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, title, body, target_kind, target_id)
      VALUES
        ('50000000-0000-4000-8000-000000000208', 'user_owner', 'user_invitee', 'project_access_requested', '项目权限申请', '申请 Editor 权限', 'project', '${projectId}')
    `);

    await approveProjectAccessRequest({
      memberUserId: 'user_invitee',
      projectId,
    });

    const notifResult = await database.query<{ read_at: string | null }>(
      `SELECT read_at FROM notifications WHERE id = '50000000-0000-4000-8000-000000000208'`,
    );
    expect(notifResult.rows[0]?.read_at).not.toBeNull();

    await database.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ('10000000-0000-4000-8000-000000000201', 'user_other', 'viewer')
      ON CONFLICT DO NOTHING
    `);

    await database.query(`
      INSERT INTO project_access_requests (project_id, user_id, requested_role)
      VALUES
        ('${projectId}', 'user_other', 'editor')
    `);

    await database.query(`
      INSERT INTO notifications (id, recipient_user_id, actor_user_id, type, title, body, target_kind, target_id)
      VALUES
        ('50000000-0000-4000-8000-000000000209', 'user_owner', 'user_other', 'project_access_requested', '项目权限申请', '申请 Editor 权限', 'project', '${projectId}')
    `);

    await rejectProjectAccessRequest({
      memberUserId: 'user_other',
      projectId,
    });

    const notifResult2 = await database.query<{ read_at: string | null }>(
      `SELECT read_at FROM notifications WHERE id = '50000000-0000-4000-8000-000000000209'`,
    );
    expect(notifResult2.rows[0]?.read_at).not.toBeNull();
  });

  it('fetches pending approvals with requester name and resource identifiers', async () => {
    currentUser = {
      email: 'owner@knowmesh.test',
      id: 'user_owner',
      name: 'Owner User',
    };
    const workspaceId = '10000000-0000-4000-8000-000000000203';

    await database.query(`
      INSERT INTO workspace_access_requests (workspace_id, user_id, requested_role)
      VALUES ('${workspaceId}', 'user_other', 'editor')
    `);

    const approvals = await getPendingApprovals();
    expect(approvals.length).toBeGreaterThan(0);
    const item = approvals.find(
      (app) => app.resourceId === workspaceId && app.memberUserId === 'user_other',
    );
    expect(item).toBeDefined();
    expect(item?.requesterName).toBe('Other User');
    expect(item?.requesterEmail).toBe('other@knowmesh.test');
    expect(item?.requestedRole).toBe('editor');
    expect(item?.resourceName).toBe('Test Workspace 3');
  });
});
