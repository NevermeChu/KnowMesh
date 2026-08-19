'use server';

import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/features/audit-logs/server/RecordAuditLog';
import { requireUser } from '@/features/auth/server/CurrentUser';
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
  notificationsSchema,
  projectMembersSchema,
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  projectsSchema,
  workspaceAccessRequestsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
  workspacesSchema,
  userSchema,
} from '@/models/Schema';
import { getBaseUrl } from '@/utils/Helpers';
import {
  acceptWorkspaceInvitationSchema,
  inviteWorkspaceMemberSchema,
  revokeWorkspaceInvitationSchema,
  transferWorkspaceOwnershipSchema,
  workspaceMemberMutationSchema,
  workspaceAccessRequestSchema,
  workspaceAccessReviewSchema,
} from '../MemberSchema';
import type {
  AcceptWorkspaceInvitationInput,
  InviteWorkspaceMemberInput,
  RevokeWorkspaceInvitationInput,
  TransferWorkspaceOwnershipInput,
  WorkspaceMemberMutationInput,
  WorkspaceAccessRequestInput,
  WorkspaceAccessReviewInput,
} from '../MemberSchema';
import { authorizeWorkspace } from './WorkspaceAuthorization';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export async function inviteWorkspaceMember(input: InviteWorkspaceMemberInput) {
  const inviter = await requireUser();
  const userId = inviter.id;
  const invitationInput = inviteWorkspaceMemberSchema.parse(input);
  const authorization = await authorizeWorkspace({
    permission: 'workspace.members.manage',
    userId,
    workspaceId: invitationInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不支持邀请成员');
  }

  const [existingUser] = await db
    .select({ id: userSchema.id })
    .from(userSchema)
    .where(eq(sql`lower(${userSchema.email})`, invitationInput.email))
    .limit(1);

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

  const [existingPendingInvitation] = await db
    .select({ id: workspaceInvitationsSchema.id })
    .from(workspaceInvitationsSchema)
    .where(
      and(
        eq(workspaceInvitationsSchema.workspaceId, invitationInput.workspaceId),
        eq(sql`lower(${workspaceInvitationsSchema.email})`, invitationInput.email),
        isNull(workspaceInvitationsSchema.acceptedAt),
        isNull(workspaceInvitationsSchema.revokedAt),
        gt(workspaceInvitationsSchema.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (existingPendingInvitation) {
    throw new Error('该邮箱已有待处理的工作区邀请');
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
    const [existingNotification] = await db
      .select({ id: notificationsSchema.id })
      .from(notificationsSchema)
      .where(
        and(
          eq(notificationsSchema.recipientUserId, existingUser.id),
          eq(notificationsSchema.type, 'workspace_invited'),
          eq(notificationsSchema.targetKind, 'workspace'),
          eq(notificationsSchema.targetId, invitationInput.workspaceId),
          isNull(notificationsSchema.readAt),
        ),
      )
      .limit(1);

    if (!existingNotification) {
      await createNotification(db, {
        actorUserId: userId,
        body: `${getWorkspaceInvitationInviterName(inviter)} 邀请你加入工作区“${authorization.workspace.name}”。`,
        recipientUserId: existingUser.id,
        target: { id: invitationInput.workspaceId, kind: 'workspace' },
        title: '收到工作区邀请',
        type: 'workspace_invited',
      });
    }
  }

  await recordAuditLog(db, {
    action: 'workspace_invited',
    actorUserId: userId,
    metadata: {
      resourceName: authorization.workspace.name,
      targetUserEmail: invitationInput.email,
    },
    targetId: invitation.id,
    targetKind: 'invitation',
    workspaceId: invitationInput.workspaceId,
  });

  return invitation;
}

export async function acceptWorkspaceInvitation(input: AcceptWorkspaceInvitationInput) {
  const user = await requireUser();
  const userId = user.id;
  const invitationInput = acceptWorkspaceInvitationSchema.parse(input);
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

  if (!invitation || invitation.expiresAt <= now || user.email.toLowerCase() !== invitation.email) {
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
    await recordAuditLog(transaction, {
      action: 'workspace_invitation_accepted',
      actorUserId: userId,
      metadata: {
        resourceName: workspace.name,
      },
      targetId: userId,
      targetKind: 'member',
      workspaceId: invitation.workspaceId,
    });
  });

  revalidatePath('/(workspace)', 'layout');
  return { workspaceId: invitation.workspaceId };
}

export async function revokeWorkspaceInvitation(input: RevokeWorkspaceInvitationInput) {
  const { id: userId } = await requireUser();
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
    .returning({ id: workspaceInvitationsSchema.id, email: workspaceInvitationsSchema.email });

  if (!revoked) {
    throw new Error('邀请不存在或已处理');
  }

  await recordAuditLog(db, {
    action: 'workspace_invitation_revoked',
    actorUserId: userId,
    metadata: {
      resourceName: authorization.workspace.name,
      targetUserEmail: revoked.email,
    },
    targetId: revokeInput.invitationId,
    targetKind: 'invitation',
    workspaceId: revokeInput.workspaceId,
  });

  revalidatePath('/(workspace)', 'layout');
  return revoked;
}

export async function updateWorkspaceMemberRole(input: WorkspaceMemberMutationInput) {
  const { id: userId } = await requireUser();
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

    await recordAuditLog(transaction, {
      action: 'workspace_member_role_updated',
      actorUserId: userId,
      metadata: {
        nextRole: memberInput.role,
        resourceName: authorization.workspace.name,
        targetUserId: memberInput.memberUserId,
      },
      targetId: memberInput.memberUserId,
      targetKind: 'member',
      workspaceId: memberInput.workspaceId,
    });

    return updatedMembership;
  });

  revalidatePath('/(workspace)', 'layout');
  return membership;
}

export async function requestWorkspaceEditAccess(input: WorkspaceAccessRequestInput) {
  const { id: userId } = await requireUser();
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
  const { id: userId } = await requireUser();
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
    await recordAuditLog(transaction, {
      action: 'workspace_access_approved',
      actorUserId: userId,
      metadata: {
        nextRole: 'editor',
        resourceName: authorization.workspace.name,
        targetUserId: reviewInput.memberUserId,
      },
      targetId: reviewInput.memberUserId,
      targetKind: 'member',
      workspaceId: reviewInput.workspaceId,
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function rejectWorkspaceAccessRequest(input: WorkspaceAccessReviewInput) {
  const { id: userId } = await requireUser();
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
    await recordAuditLog(transaction, {
      action: 'workspace_access_rejected',
      actorUserId: userId,
      metadata: {
        resourceName: authorization.workspace.name,
        targetUserId: reviewInput.memberUserId,
      },
      targetId: reviewInput.memberUserId,
      targetKind: 'member',
      workspaceId: reviewInput.workspaceId,
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function removeWorkspaceMember(input: WorkspaceMemberMutationInput) {
  const { id: userId } = await requireUser();
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

    await recordAuditLog(transaction, {
      action: 'workspace_member_removed',
      actorUserId: userId,
      metadata: {
        resourceName: authorization.workspace.name,
        targetUserId: memberInput.memberUserId,
      },
      targetId: memberInput.memberUserId,
      targetKind: 'member',
      workspaceId: memberInput.workspaceId,
    });
  });

  revalidatePath('/(workspace)', 'layout');
  return { userId: memberInput.memberUserId };
}

/**
 * Transfers team workspace ownership to another workspace member.
 *
 * @param input - Target member user ID and workspace ID.
 * @returns The transferred workspace ID and new owner user ID.
 */
export async function transferWorkspaceOwnership(input: TransferWorkspaceOwnershipInput) {
  const { id: userId } = await requireUser();
  const transferInput = transferWorkspaceOwnershipSchema.parse(input);

  if (transferInput.targetUserId === userId) {
    throw new Error('不能将工作区所有权转让给自己');
  }

  const authorization = await authorizeWorkspace({
    permission: 'workspace.delete',
    userId,
    workspaceId: transferInput.workspaceId,
  });

  if (authorization.workspace.kind === 'personal') {
    throw new Error('个人空间不支持所有权转让');
  }

  if (authorization.workspace.ownerId !== userId) {
    throw new Error('只有工作区所有者可以转让所有权');
  }

  await db.transaction(async (transaction) => {
    const [targetMembership] = await transaction
      .select({ role: workspaceMembersSchema.role, userId: workspaceMembersSchema.userId })
      .from(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, transferInput.workspaceId),
          eq(workspaceMembersSchema.userId, transferInput.targetUserId),
        ),
      )
      .for('update');

    if (!targetMembership) {
      throw new Error('目标用户不是该工作区成员');
    }

    const [currentMembership] = await transaction
      .select({ role: workspaceMembersSchema.role, userId: workspaceMembersSchema.userId })
      .from(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, transferInput.workspaceId),
          eq(workspaceMembersSchema.userId, userId),
        ),
      )
      .for('update');

    if (!currentMembership || currentMembership.role !== 'owner') {
      throw new Error('当前用户不是工作区所有者');
    }

    await transaction
      .update(workspaceMembersSchema)
      .set({ role: 'editor' })
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, transferInput.workspaceId),
          eq(workspaceMembersSchema.userId, userId),
        ),
      );

    await transaction
      .update(workspaceMembersSchema)
      .set({ role: 'owner' })
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, transferInput.workspaceId),
          eq(workspaceMembersSchema.userId, transferInput.targetUserId),
        ),
      );

    await transaction
      .update(workspacesSchema)
      .set({ ownerId: transferInput.targetUserId })
      .where(eq(workspacesSchema.id, transferInput.workspaceId));

    await transaction
      .delete(workspaceAccessRequestsSchema)
      .where(
        and(
          eq(workspaceAccessRequestsSchema.workspaceId, transferInput.workspaceId),
          eq(workspaceAccessRequestsSchema.userId, transferInput.targetUserId),
        ),
      );

    await createNotification(transaction, {
      actorUserId: userId,
      body: `你已成为工作区“${authorization.workspace.name}”的所有者。`,
      recipientUserId: transferInput.targetUserId,
      target: { id: transferInput.workspaceId, kind: 'workspace' },
      title: '工作区所有权转让',
      type: 'workspace_member_role_updated',
    });

    await recordAuditLog(transaction, {
      action: 'workspace_ownership_transferred',
      actorUserId: userId,
      metadata: {
        resourceName: authorization.workspace.name,
        targetUserId: transferInput.targetUserId,
      },
      targetId: transferInput.targetUserId,
      targetKind: 'member',
      workspaceId: transferInput.workspaceId,
    });
  });

  revalidatePath('/(workspace)', 'layout');
  return { newOwnerId: transferInput.targetUserId, workspaceId: transferInput.workspaceId };
}
