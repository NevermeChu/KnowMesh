'use server';

import { randomBytes } from 'node:crypto';
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { sendWorkspaceInvitationEmail } from '@/features/emails/server/SendWorkspaceInvitationEmail';
import { createNotification } from '@/features/notifications/server/CreateNotification';
import { hashWorkspaceInvitationToken } from '@/features/permissions/server/WorkspaceInvitationToken';
import {
  formatWorkspaceInvitationExpiration,
  getWorkspaceInvitationInviterName,
  WORKSPACE_INVITATION_ROLE_LABEL,
} from '@/features/workspaces/WorkspaceInvitation';
import { db } from '@/libs/DB';
import {
  projectMembersSchema,
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  projectsSchema,
  workspaceAccessRequestsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
  workspacesSchema,
} from '@/models/Schema';
import { getBaseUrl } from '@/utils/Helpers';
import {
  acceptWorkspaceInvitationSchema,
  inviteWorkspaceMemberSchema,
  revokeWorkspaceInvitationSchema,
  workspaceMemberMutationSchema,
  workspaceAccessRequestSchema,
  workspaceAccessReviewSchema,
} from '../MemberSchema';
import type {
  AcceptWorkspaceInvitationInput,
  InviteWorkspaceMemberInput,
  RevokeWorkspaceInvitationInput,
  WorkspaceMemberMutationInput,
  WorkspaceAccessRequestInput,
  WorkspaceAccessReviewInput,
} from '../MemberSchema';
import { authorizeWorkspace } from './WorkspaceAuthorization';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export async function inviteWorkspaceMember(input: InviteWorkspaceMemberInput) {
  const { userId } = await auth.protect();
  const invitationInput = inviteWorkspaceMemberSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.members.manage',
    userId,
    workspaceId: invitationInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不支持邀请成员');
  }

  const inviter = await currentUser();

  if (!inviter) {
    throw new Error('无法读取当前用户');
  }

  const client = await clerkClient();
  const existingUsers = await client.users.getUserList({ emailAddress: [invitationInput.email] });
  const existingUser = existingUsers.data.find((user) =>
    user.emailAddresses.some(
      (emailAddress) => emailAddress.emailAddress.toLowerCase() === invitationInput.email,
    ),
  );

  if (existingUser) {
    const [membership] = await db
      .select({ userId: workspaceMembersSchema.userId })
      .from(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, invitationInput.workspaceId),
          eq(workspaceMembersSchema.userId, existingUser.id),
        ),
      )
      .limit(1);

    if (membership) {
      throw new Error('该用户已经是工作区成员');
    }
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashWorkspaceInvitationToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
  const [invitation] = await db
    .insert(workspaceInvitationsSchema)
    .values({
      email: invitationInput.email,
      expiresAt,
      invitedById: userId,
      tokenHash,
      workspaceId: invitationInput.workspaceId,
    })
    .returning({ id: workspaceInvitationsSchema.id });

  if (!invitation) {
    throw new Error('工作区邀请创建失败');
  }

  try {
    await sendWorkspaceInvitationEmail({
      acceptUrl: `${getBaseUrl()}/invitations/accept?token=${encodeURIComponent(token)}`,
      invitation: {
        expiresAtLabel: formatWorkspaceInvitationExpiration(expiresAt),
        inviteeEmail: invitationInput.email,
        inviterName: getWorkspaceInvitationInviterName(inviter),
        roleLabel: WORKSPACE_INVITATION_ROLE_LABEL,
        workspaceName: authorization.workspace.name,
      },
    });
  } catch (error) {
    await db
      .delete(workspaceInvitationsSchema)
      .where(eq(workspaceInvitationsSchema.id, invitation.id));
    throw error;
  }

  if (existingUser) {
    await createNotification(db, {
      actorUserId: userId,
      body: `${getWorkspaceInvitationInviterName(inviter)} 邀请你加入工作区“${authorization.workspace.name}”。`,
      recipientUserId: existingUser.id,
      target: { id: invitationInput.workspaceId, kind: 'workspace' },
      title: '收到工作区邀请',
      type: 'workspace_invited',
    });
  }

  return invitation;
}

export async function acceptWorkspaceInvitation(input: AcceptWorkspaceInvitationInput) {
  const { userId } = await auth.protect();
  const invitationInput = acceptWorkspaceInvitationSchema.parse(input);
  const user = await currentUser();

  if (!user) {
    throw new Error('无法读取当前用户');
  }

  const verifiedEmails = new Set(
    user.emailAddresses
      .filter((emailAddress) => emailAddress.verification?.status === 'verified')
      .map((emailAddress) => emailAddress.emailAddress.toLowerCase()),
  );
  const now = new Date();
  const [invitation] = await db
    .select()
    .from(workspaceInvitationsSchema)
    .where(
      and(
        eq(
          workspaceInvitationsSchema.tokenHash,
          hashWorkspaceInvitationToken(invitationInput.token),
        ),
        isNull(workspaceInvitationsSchema.acceptedAt),
        isNull(workspaceInvitationsSchema.revokedAt),
      ),
    )
    .limit(1);

  if (!invitation || invitation.expiresAt <= now || !verifiedEmails.has(invitation.email)) {
    throw new Error('邀请无效、已过期或与当前账号邮箱不匹配');
  }

  await db.transaction(async (transaction) => {
    const [workspace] = await transaction
      .select({ name: workspacesSchema.name })
      .from(workspacesSchema)
      .where(eq(workspacesSchema.id, invitation.workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error('工作区不存在');
    }

    await transaction
      .insert(workspaceMembersSchema)
      .values({ role: 'viewer', userId, workspaceId: invitation.workspaceId })
      .onConflictDoNothing();
    await transaction
      .update(workspaceInvitationsSchema)
      .set({ acceptedAt: now, acceptedById: userId })
      .where(eq(workspaceInvitationsSchema.id, invitation.id));
    await createNotification(transaction, {
      actorUserId: userId,
      body: `${getWorkspaceInvitationInviterName(user)} 已接受加入“${workspace.name}”的邀请。`,
      recipientUserId: invitation.invitedById,
      target: { id: invitation.workspaceId, kind: 'workspace' },
      title: '工作区邀请已接受',
      type: 'workspace_invitation_accepted',
    });
  });

  revalidatePath('/(workspace)', 'layout');
  return { workspaceId: invitation.workspaceId };
}

export async function revokeWorkspaceInvitation(input: RevokeWorkspaceInvitationInput) {
  const { userId } = await auth.protect();
  const revokeInput = revokeWorkspaceInvitationSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.members.manage',
    userId,
    workspaceId: revokeInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不支持撤销邀请');
  }

  const now = new Date();
  const [revoked] = await db
    .update(workspaceInvitationsSchema)
    .set({ revokedAt: now })
    .where(
      and(
        eq(workspaceInvitationsSchema.id, revokeInput.invitationId),
        eq(workspaceInvitationsSchema.workspaceId, revokeInput.workspaceId),
        isNull(workspaceInvitationsSchema.acceptedAt),
        isNull(workspaceInvitationsSchema.revokedAt),
      ),
    )
    .returning({ id: workspaceInvitationsSchema.id });

  if (!revoked) {
    throw new Error('邀请不存在或已处理');
  }

  revalidatePath('/(workspace)', 'layout');
  return revoked;
}

export async function updateWorkspaceMemberRole(input: WorkspaceMemberMutationInput) {
  const { userId } = await auth.protect();
  const memberInput = workspaceMemberMutationSchema.required({ role: true }).parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.members.manage',
    userId,
    workspaceId: memberInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不支持成员角色修改');
  }

  if (memberInput.memberUserId === authorization.workspace.ownerId) {
    throw new Error('工作区所有者角色不可修改');
  }

  const membership = await db.transaction(async (transaction) => {
    const [updatedMembership] = await transaction
      .update(workspaceMembersSchema)
      .set({ role: memberInput.role })
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, memberInput.workspaceId),
          eq(workspaceMembersSchema.userId, memberInput.memberUserId),
        ),
      )
      .returning({ userId: workspaceMembersSchema.userId });

    if (!updatedMembership) {
      throw new Error('工作区成员不存在');
    }

    await transaction
      .delete(workspaceAccessRequestsSchema)
      .where(
        and(
          eq(workspaceAccessRequestsSchema.workspaceId, memberInput.workspaceId),
          eq(workspaceAccessRequestsSchema.userId, memberInput.memberUserId),
        ),
      );

    if (memberInput.memberUserId !== userId) {
      const roleLabel = memberInput.role === 'editor' ? '编辑者' : '查看者';
      await createNotification(transaction, {
        actorUserId: userId,
        body: `你在工作区“${authorization.workspace.name}”中的角色已变更为${roleLabel}。`,
        recipientUserId: memberInput.memberUserId,
        target: { id: memberInput.workspaceId, kind: 'workspace' },
        title: '工作区角色变更',
        type: 'workspace_member_role_updated',
      });
    }

    return updatedMembership;
  });

  revalidatePath('/(workspace)', 'layout');
  return membership;
}

export async function requestWorkspaceEditAccess(input: WorkspaceAccessRequestInput) {
  const { userId } = await auth.protect();
  const requestInput = workspaceAccessRequestSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.read',
    userId,
    workspaceId: requestInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal' || authorization.workspace.role !== 'viewer') {
    throw new Error('只有团队工作区 Viewer 可以申请编辑权限');
  }

  await db.transaction(async (transaction) => {
    const [request] = await transaction
      .insert(workspaceAccessRequestsSchema)
      .values({ requestedRole: 'editor', userId, workspaceId: requestInput.workspaceId })
      .onConflictDoNothing()
      .returning({ userId: workspaceAccessRequestsSchema.userId });

    if (!request) {
      return;
    }

    await createNotification(transaction, {
      actorUserId: userId,
      body: `“${authorization.workspace.name}”收到新的 Editor 权限申请。`,
      recipientUserId: authorization.workspace.ownerId,
      target: { id: requestInput.workspaceId, kind: 'workspace' },
      title: '新的工作区权限申请',
      type: 'workspace_access_requested',
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function approveWorkspaceAccessRequest(input: WorkspaceAccessReviewInput) {
  const { userId } = await auth.protect();
  const reviewInput = workspaceAccessReviewSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.members.manage',
    userId,
    workspaceId: reviewInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不支持权限申请');
  }

  await db.transaction(async (transaction) => {
    const [request] = await transaction
      .delete(workspaceAccessRequestsSchema)
      .where(
        and(
          eq(workspaceAccessRequestsSchema.workspaceId, reviewInput.workspaceId),
          eq(workspaceAccessRequestsSchema.userId, reviewInput.memberUserId),
        ),
      )
      .returning({ userId: workspaceAccessRequestsSchema.userId });

    if (!request) {
      throw new Error('权限申请不存在');
    }

    await transaction
      .update(workspaceMembersSchema)
      .set({ role: 'editor' })
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, reviewInput.workspaceId),
          eq(workspaceMembersSchema.userId, reviewInput.memberUserId),
        ),
      );
    await createNotification(transaction, {
      actorUserId: userId,
      body: `你在“${authorization.workspace.name}”的 Editor 权限申请已通过。`,
      recipientUserId: request.userId,
      target: { id: reviewInput.workspaceId, kind: 'workspace' },
      title: '工作区权限申请已通过',
      type: 'workspace_access_approved',
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function rejectWorkspaceAccessRequest(input: WorkspaceAccessReviewInput) {
  const { userId } = await auth.protect();
  const reviewInput = workspaceAccessReviewSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.members.manage',
    userId,
    workspaceId: reviewInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不支持权限申请');
  }

  await db.transaction(async (transaction) => {
    const [request] = await transaction
      .delete(workspaceAccessRequestsSchema)
      .where(
        and(
          eq(workspaceAccessRequestsSchema.workspaceId, reviewInput.workspaceId),
          eq(workspaceAccessRequestsSchema.userId, reviewInput.memberUserId),
        ),
      )
      .returning({ userId: workspaceAccessRequestsSchema.userId });

    if (!request) {
      throw new Error('权限申请不存在');
    }

    await createNotification(transaction, {
      actorUserId: userId,
      body: `你在“${authorization.workspace.name}”的 Editor 权限申请未通过。`,
      recipientUserId: request.userId,
      target: { id: reviewInput.workspaceId, kind: 'workspace' },
      title: '工作区权限申请未通过',
      type: 'workspace_access_rejected',
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function removeWorkspaceMember(input: WorkspaceMemberMutationInput) {
  const { userId } = await auth.protect();
  const memberInput = workspaceMemberMutationSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.members.manage',
    userId,
    workspaceId: memberInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不支持移除成员');
  }

  if (memberInput.memberUserId === authorization.workspace.ownerId) {
    throw new Error('工作区所有者不可移除');
  }

  await db.transaction(async (transaction) => {
    const [membership] = await transaction
      .select({ userId: workspaceMembersSchema.userId })
      .from(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, memberInput.workspaceId),
          eq(workspaceMembersSchema.userId, memberInput.memberUserId),
        ),
      )
      .for('update');

    if (!membership) {
      throw new Error('工作区成员不存在');
    }

    const ownedProjects = await transaction
      .select({ id: projectsSchema.id })
      .from(projectsSchema)
      .where(
        and(
          eq(projectsSchema.workspaceId, memberInput.workspaceId),
          eq(projectsSchema.ownerId, memberInput.memberUserId),
        ),
      )
      .limit(1);

    if (ownedProjects.length > 0) {
      throw new Error('该成员仍拥有项目，请先转让或删除这些项目');
    }

    const projects = await transaction
      .select({ id: projectsSchema.id })
      .from(projectsSchema)
      .where(eq(projectsSchema.workspaceId, memberInput.workspaceId));

    for (const project of projects) {
      await transaction
        .delete(projectAccessRequestsSchema)
        .where(
          and(
            eq(projectAccessRequestsSchema.projectId, project.id),
            eq(projectAccessRequestsSchema.userId, memberInput.memberUserId),
          ),
        );
      await transaction
        .delete(projectInvitationsSchema)
        .where(
          and(
            eq(projectInvitationsSchema.projectId, project.id),
            eq(projectInvitationsSchema.userId, memberInput.memberUserId),
          ),
        );
      await transaction
        .delete(projectMembersSchema)
        .where(
          and(
            eq(projectMembersSchema.projectId, project.id),
            eq(projectMembersSchema.userId, memberInput.memberUserId),
          ),
        );
    }

    await transaction
      .delete(workspaceAccessRequestsSchema)
      .where(
        and(
          eq(workspaceAccessRequestsSchema.workspaceId, memberInput.workspaceId),
          eq(workspaceAccessRequestsSchema.userId, memberInput.memberUserId),
        ),
      );

    await transaction
      .delete(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, memberInput.workspaceId),
          eq(workspaceMembersSchema.userId, memberInput.memberUserId),
        ),
      );

    if (memberInput.memberUserId !== userId) {
      await createNotification(transaction, {
        actorUserId: userId,
        body: `你已被移出工作区“${authorization.workspace.name}”。`,
        recipientUserId: memberInput.memberUserId,
        target: { id: memberInput.workspaceId, kind: 'workspace' },
        title: '已移出工作区',
        type: 'workspace_member_removed',
      });
    }
  });

  revalidatePath('/(workspace)', 'layout');
  return { userId: memberInput.memberUserId };
}
