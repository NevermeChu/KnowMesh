'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/features/audit-logs/server/RecordAuditLog';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { createNotification } from '@/features/notifications/server/CreateNotification';
import { markRelatedNotificationsRead } from '@/features/notifications/server/MarkRelatedNotificationsRead';
import { MEMBER_INVITATION_LIFETIME_MS } from '@/features/permissions/MemberInvitation';
import { db } from '@/libs/DB';
import {
  projectAccessRequestsSchema,
  projectInvitationsSchema,
  projectMembersSchema,
  projectsSchema,
  workspaceMembersSchema,
} from '@/models/Schema';
import {
  projectAccessRequestSchema,
  projectAccessReviewSchema,
  projectInvitationSchema,
  projectMemberMutationSchema,
  transferProjectOwnershipSchema,
} from '../MemberSchema';
import type {
  ProjectAccessRequestInput,
  ProjectAccessReviewInput,
  ProjectInvitationInput,
  ProjectMemberMutationInput,
  TransferProjectOwnershipInput,
} from '../MemberSchema';
import { authorizeProject } from './ProjectAuthorization';

async function authorizeProjectMemberMutation(input: ProjectMemberMutationInput) {
  const { id: userId } = await requireUser();
  const memberInput = projectMemberMutationSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'project.members.manage',
    projectId: memberInput.projectId,
    userId,
  });

  if (authorization.project.workspaceKind === 'personal') {
    throw new Error('个人空间不支持项目成员');
  }

  if (memberInput.memberUserId === authorization.project.ownerId) {
    throw new Error('项目所有者角色不可修改或移除');
  }

  const [workspaceMembership] = await db
    .select({ userId: workspaceMembersSchema.userId })
    .from(workspaceMembersSchema)
    .where(
      and(
        eq(workspaceMembersSchema.workspaceId, authorization.project.workspaceId),
        eq(workspaceMembersSchema.userId, memberInput.memberUserId),
      ),
    )
    .limit(1);

  if (!workspaceMembership) {
    throw new Error('项目成员必须先加入所属工作区');
  }

  return { authorization, memberInput, userId };
}

export async function inviteProjectMember(input: ProjectInvitationInput) {
  const { id: userId } = await requireUser();
  const invitationInput = projectInvitationSchema.parse(input);
  const { authorization, memberInput } = await authorizeProjectMemberMutation({
    ...invitationInput,
    role: 'viewer',
  });
  const [membership] = await db
    .select({ userId: projectMembersSchema.userId })
    .from(projectMembersSchema)
    .where(
      and(
        eq(projectMembersSchema.projectId, memberInput.projectId),
        eq(projectMembersSchema.userId, memberInput.memberUserId),
      ),
    )
    .limit(1);

  if (membership) {
    throw new Error('该用户已经是项目成员');
  }

  await db.transaction(async (transaction) => {
    const [invitation] = await transaction
      .insert(projectInvitationsSchema)
      .values({
        expiresAt: new Date(Date.now() + MEMBER_INVITATION_LIFETIME_MS),
        invitedById: userId,
        projectId: memberInput.projectId,
        userId: memberInput.memberUserId,
      })
      .onConflictDoNothing()
      .returning({ projectId: projectInvitationsSchema.projectId });

    if (invitation) {
      await createNotification(transaction, {
        actorUserId: userId,
        body: `你收到了加入项目“${authorization.project.name}”的邀请。`,
        recipientUserId: memberInput.memberUserId,
        target: { id: memberInput.projectId, kind: 'project' },
        title: '收到项目邀请',
        type: 'project_invited',
      });
      await recordAuditLog(transaction, {
        action: 'project_invited',
        actorUserId: userId,
        metadata: {
          resourceName: authorization.project.name,
          targetUserId: memberInput.memberUserId,
        },
        targetId: memberInput.memberUserId,
        targetKind: 'invitation',
        workspaceId: authorization.project.workspaceId,
      });
    }
  });

  return { userId: memberInput.memberUserId };
}

export async function acceptProjectInvitation(input: { projectId: string }) {
  const { id: userId } = await requireUser();
  const invitationInput = projectAccessRequestSchema.pick({ projectId: true }).parse(input);

  await db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ name: projectsSchema.name, workspaceId: projectsSchema.workspaceId })
      .from(projectsSchema)
      .where(eq(projectsSchema.id, invitationInput.projectId))
      .limit(1);

    if (!project) {
      throw new Error('项目不存在');
    }

    const [workspaceMembership] = await transaction
      .select({ userId: workspaceMembersSchema.userId })
      .from(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, project.workspaceId),
          eq(workspaceMembersSchema.userId, userId),
        ),
      )
      .for('update');

    if (!workspaceMembership) {
      throw new Error('请先加入项目所属工作区');
    }

    const [invitation] = await transaction
      .delete(projectInvitationsSchema)
      .where(
        and(
          eq(projectInvitationsSchema.projectId, invitationInput.projectId),
          eq(projectInvitationsSchema.userId, userId),
        ),
      )
      .returning({
        expiresAt: projectInvitationsSchema.expiresAt,
        invitedById: projectInvitationsSchema.invitedById,
        projectId: projectInvitationsSchema.projectId,
      });

    if (!invitation) {
      throw new Error('项目邀请不存在');
    }

    if (invitation.expiresAt <= new Date()) {
      throw new Error('项目邀请已过期');
    }

    await transaction
      .insert(projectMembersSchema)
      .values({
        projectId: invitation.projectId,
        role: 'viewer',
        userId,
        workspaceId: project.workspaceId,
      })
      .onConflictDoNothing();
    await transaction
      .delete(projectAccessRequestsSchema)
      .where(
        and(
          eq(projectAccessRequestsSchema.projectId, invitation.projectId),
          eq(projectAccessRequestsSchema.userId, userId),
        ),
      );
    await createNotification(transaction, {
      actorUserId: userId,
      body: `你发出的“${project.name}”项目邀请已被接受。`,
      recipientUserId: invitation.invitedById,
      target: { id: invitation.projectId, kind: 'project' },
      title: '项目邀请已接受',
      type: 'project_invitation_accepted',
    });
    await recordAuditLog(transaction, {
      action: 'project_invitation_accepted',
      actorUserId: userId,
      metadata: {
        resourceName: project.name,
      },
      targetId: userId,
      targetKind: 'member',
      workspaceId: project.workspaceId,
    });
    await markRelatedNotificationsRead(transaction, {
      recipientUserId: userId,
      targetId: invitation.projectId,
      type: 'project_invited',
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function requestProjectAccess(input: ProjectAccessRequestInput) {
  const { id: userId } = await requireUser();
  const requestInput = projectAccessRequestSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'project.structure.read',
    projectId: requestInput.projectId,
    userId,
  });
  const existingRole = authorization.decision.grants.find(
    (grant) => grant.source === 'project',
  )?.role;

  if (requestInput.requestedRole === 'viewer' && existingRole) {
    throw new Error('你已经是项目成员');
  }

  if (requestInput.requestedRole === 'editor' && existingRole !== 'viewer') {
    throw new Error('只有项目 Viewer 可以申请编辑权限');
  }

  await db.transaction(async (transaction) => {
    await transaction
      .insert(projectAccessRequestsSchema)
      .values({
        projectId: requestInput.projectId,
        requestedRole: requestInput.requestedRole,
        userId,
      })
      .onConflictDoUpdate({
        set: { requestedRole: requestInput.requestedRole },
        target: [projectAccessRequestsSchema.projectId, projectAccessRequestsSchema.userId],
      });
    await createNotification(transaction, {
      actorUserId: userId,
      body: `“${authorization.project.name}”收到新的 ${requestInput.requestedRole} 权限申请。`,
      recipientUserId: authorization.project.ownerId,
      target: { id: requestInput.projectId, kind: 'project' },
      title: '新的项目权限申请',
      type: 'project_access_requested',
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function approveProjectAccessRequest(input: ProjectAccessReviewInput) {
  const reviewInput = projectAccessReviewSchema.parse(input);
  const { userId } = await authorizeProjectMemberMutation({
    memberUserId: reviewInput.memberUserId,
    projectId: reviewInput.projectId,
    role: 'viewer',
  });

  await db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ name: projectsSchema.name, workspaceId: projectsSchema.workspaceId })
      .from(projectsSchema)
      .where(eq(projectsSchema.id, reviewInput.projectId))
      .limit(1);

    if (!project) {
      throw new Error('项目不存在');
    }

    const [workspaceMembership] = await transaction
      .select({ userId: workspaceMembersSchema.userId })
      .from(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, project.workspaceId),
          eq(workspaceMembersSchema.userId, reviewInput.memberUserId),
        ),
      )
      .for('update');

    if (!workspaceMembership) {
      throw new Error('项目成员必须先加入所属工作区');
    }

    const [request] = await transaction
      .delete(projectAccessRequestsSchema)
      .where(
        and(
          eq(projectAccessRequestsSchema.projectId, reviewInput.projectId),
          eq(projectAccessRequestsSchema.userId, reviewInput.memberUserId),
        ),
      )
      .returning({ requestedRole: projectAccessRequestsSchema.requestedRole });

    if (!request) {
      throw new Error('权限申请不存在');
    }
    if (request.requestedRole === 'owner') {
      throw new Error('不能通过权限申请成为项目所有者');
    }

    await transaction
      .insert(projectMembersSchema)
      .values({
        projectId: reviewInput.projectId,
        role: request.requestedRole,
        userId: reviewInput.memberUserId,
        workspaceId: project.workspaceId,
      })
      .onConflictDoUpdate({
        set: { role: request.requestedRole },
        target: [projectMembersSchema.projectId, projectMembersSchema.userId],
      });
    await transaction
      .delete(projectInvitationsSchema)
      .where(
        and(
          eq(projectInvitationsSchema.projectId, reviewInput.projectId),
          eq(projectInvitationsSchema.userId, reviewInput.memberUserId),
        ),
      );
    await createNotification(transaction, {
      actorUserId: userId,
      body: `你在“${project.name}”的 ${request.requestedRole} 权限申请已通过。`,
      recipientUserId: reviewInput.memberUserId,
      target: { id: reviewInput.projectId, kind: 'project' },
      title: '项目权限申请已通过',
      type: 'project_access_approved',
    });
    await recordAuditLog(transaction, {
      action: 'project_access_approved',
      actorUserId: userId,
      metadata: {
        nextRole: request.requestedRole,
        resourceName: project.name,
        targetUserId: reviewInput.memberUserId,
      },
      targetId: reviewInput.memberUserId,
      targetKind: 'member',
      workspaceId: project.workspaceId,
    });
    await markRelatedNotificationsRead(transaction, {
      actorUserId: reviewInput.memberUserId,
      recipientUserId: userId,
      targetId: reviewInput.projectId,
      type: 'project_access_requested',
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function rejectProjectAccessRequest(input: ProjectAccessReviewInput) {
  const reviewInput = projectAccessReviewSchema.parse(input);
  const { userId } = await authorizeProjectMemberMutation({
    memberUserId: reviewInput.memberUserId,
    projectId: reviewInput.projectId,
    role: 'viewer',
  });

  await db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ name: projectsSchema.name, workspaceId: projectsSchema.workspaceId })
      .from(projectsSchema)
      .where(eq(projectsSchema.id, reviewInput.projectId))
      .limit(1);

    if (!project) {
      throw new Error('项目不存在');
    }

    const [request] = await transaction
      .delete(projectAccessRequestsSchema)
      .where(
        and(
          eq(projectAccessRequestsSchema.projectId, reviewInput.projectId),
          eq(projectAccessRequestsSchema.userId, reviewInput.memberUserId),
        ),
      )
      .returning({ requestedRole: projectAccessRequestsSchema.requestedRole });

    if (!request) {
      throw new Error('权限申请不存在');
    }

    await createNotification(transaction, {
      actorUserId: userId,
      body: `你在“${project.name}”的 ${request.requestedRole} 权限申请未通过。`,
      recipientUserId: reviewInput.memberUserId,
      target: { id: reviewInput.projectId, kind: 'project' },
      title: '项目权限申请未通过',
      type: 'project_access_rejected',
    });
    await recordAuditLog(transaction, {
      action: 'project_access_rejected',
      actorUserId: userId,
      metadata: {
        resourceName: project.name,
        targetUserId: reviewInput.memberUserId,
      },
      targetId: reviewInput.memberUserId,
      targetKind: 'member',
      workspaceId: project.workspaceId,
    });
    await markRelatedNotificationsRead(transaction, {
      actorUserId: reviewInput.memberUserId,
      recipientUserId: userId,
      targetId: reviewInput.projectId,
      type: 'project_access_requested',
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function updateProjectMemberRole(input: ProjectMemberMutationInput) {
  const memberInput = projectMemberMutationSchema.required({ role: true }).parse(input);
  const { authorization, userId } = await authorizeProjectMemberMutation(memberInput);

  const membership = await db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ ownerId: projectsSchema.ownerId })
      .from(projectsSchema)
      .where(eq(projectsSchema.id, memberInput.projectId))
      .for('update');

    if (!project || project.ownerId !== authorization.project.ownerId) {
      throw new Error('项目所有权已发生变化，请刷新后重试');
    }

    if (memberInput.memberUserId === project.ownerId) {
      throw new Error('项目所有者角色不可修改或移除');
    }

    const [updatedMembership] = await transaction
      .update(projectMembersSchema)
      .set({ role: memberInput.role })
      .where(
        and(
          eq(projectMembersSchema.projectId, memberInput.projectId),
          eq(projectMembersSchema.userId, memberInput.memberUserId),
        ),
      )
      .returning({ userId: projectMembersSchema.userId });

    if (!updatedMembership) {
      throw new Error('项目成员不存在');
    }

    await transaction
      .delete(projectAccessRequestsSchema)
      .where(
        and(
          eq(projectAccessRequestsSchema.projectId, memberInput.projectId),
          eq(projectAccessRequestsSchema.userId, memberInput.memberUserId),
        ),
      );

    if (memberInput.memberUserId !== userId) {
      const roleLabel = memberInput.role === 'editor' ? '编辑者' : '查看者';
      await createNotification(transaction, {
        actorUserId: userId,
        body: `你在项目“${authorization.project.name}”中的角色已变更为${roleLabel}。`,
        recipientUserId: memberInput.memberUserId,
        target: { id: memberInput.projectId, kind: 'project' },
        title: '项目角色变更',
        type: 'project_member_role_updated',
      });
    }

    await recordAuditLog(transaction, {
      action: 'project_member_role_updated',
      actorUserId: userId,
      metadata: {
        nextRole: memberInput.role,
        resourceName: authorization.project.name,
        targetUserId: memberInput.memberUserId,
      },
      targetId: memberInput.memberUserId,
      targetKind: 'member',
      workspaceId: authorization.project.workspaceId,
    });

    return updatedMembership;
  });

  revalidatePath('/(workspace)', 'layout');
  return membership;
}

export async function removeProjectMember(input: ProjectMemberMutationInput) {
  const { authorization, memberInput, userId } = await authorizeProjectMemberMutation(input);
  const membership = await db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ ownerId: projectsSchema.ownerId })
      .from(projectsSchema)
      .where(eq(projectsSchema.id, memberInput.projectId))
      .for('update');

    if (!project || project.ownerId !== authorization.project.ownerId) {
      throw new Error('项目所有权已发生变化，请刷新后重试');
    }

    if (memberInput.memberUserId === project.ownerId) {
      throw new Error('项目所有者角色不可修改或移除');
    }

    await transaction
      .delete(projectAccessRequestsSchema)
      .where(
        and(
          eq(projectAccessRequestsSchema.projectId, memberInput.projectId),
          eq(projectAccessRequestsSchema.userId, memberInput.memberUserId),
        ),
      );
    await transaction
      .delete(projectInvitationsSchema)
      .where(
        and(
          eq(projectInvitationsSchema.projectId, memberInput.projectId),
          eq(projectInvitationsSchema.userId, memberInput.memberUserId),
        ),
      );
    const [deletedMembership] = await transaction
      .delete(projectMembersSchema)
      .where(
        and(
          eq(projectMembersSchema.projectId, memberInput.projectId),
          eq(projectMembersSchema.userId, memberInput.memberUserId),
        ),
      )
      .returning({ userId: projectMembersSchema.userId });

    if (!deletedMembership) {
      throw new Error('项目成员不存在');
    }

    if (memberInput.memberUserId !== userId) {
      await createNotification(transaction, {
        actorUserId: userId,
        body: `你已被移出项目“${authorization.project.name}”。`,
        recipientUserId: memberInput.memberUserId,
        target: { id: memberInput.projectId, kind: 'project' },
        title: '已移出项目',
        type: 'project_member_removed',
      });
    }

    await recordAuditLog(transaction, {
      action: 'project_member_removed',
      actorUserId: userId,
      metadata: {
        resourceName: authorization.project.name,
        targetUserId: memberInput.memberUserId,
      },
      targetId: memberInput.memberUserId,
      targetKind: 'member',
      workspaceId: authorization.project.workspaceId,
    });

    return deletedMembership;
  });

  revalidatePath('/(workspace)', 'layout');
  return membership;
}

export async function rejectProjectInvitation(input: { projectId: string }) {
  const { id: userId } = await requireUser();
  const invitationInput = projectAccessRequestSchema.pick({ projectId: true }).parse(input);

  await db.transaction(async (transaction) => {
    await transaction
      .delete(projectInvitationsSchema)
      .where(
        and(
          eq(projectInvitationsSchema.projectId, invitationInput.projectId),
          eq(projectInvitationsSchema.userId, userId),
        ),
      );

    await markRelatedNotificationsRead(transaction, {
      recipientUserId: userId,
      targetId: invitationInput.projectId,
      type: 'project_invited',
    });
  });

  revalidatePath('/(workspace)', 'layout');
}

/**
 * Transfers project ownership to another member in the same workspace.
 *
 * @param input - Target member user ID and project ID.
 * @returns The transferred project ID and new owner user ID.
 */
export async function transferProjectOwnership(input: TransferProjectOwnershipInput) {
  const { id: userId } = await requireUser();
  const transferInput = transferProjectOwnershipSchema.parse(input);

  if (transferInput.targetUserId === userId) {
    throw new Error('不能将项目所有权转让给自己');
  }

  const authorization = await authorizeProject({
    permission: 'project.delete',
    projectId: transferInput.projectId,
    userId,
  });

  if (authorization.project.workspaceKind === 'personal') {
    throw new Error('个人空间不支持所有权转让');
  }

  if (authorization.project.ownerId !== userId) {
    throw new Error('只有项目所有者可以转让所有权');
  }

  await db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ ownerId: projectsSchema.ownerId, workspaceId: projectsSchema.workspaceId })
      .from(projectsSchema)
      .where(eq(projectsSchema.id, transferInput.projectId))
      .for('update');

    if (
      !project ||
      project.ownerId !== userId ||
      project.workspaceId !== authorization.project.workspaceId
    ) {
      throw new Error('项目所有权已发生变化，请刷新后重试');
    }

    const [workspaceMembership] = await transaction
      .select({ userId: workspaceMembersSchema.userId })
      .from(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, authorization.project.workspaceId),
          eq(workspaceMembersSchema.userId, transferInput.targetUserId),
        ),
      )
      .for('update');

    if (!workspaceMembership) {
      throw new Error('目标用户不是该工作区成员');
    }

    const [currentMembership] = await transaction
      .select({ role: projectMembersSchema.role, userId: projectMembersSchema.userId })
      .from(projectMembersSchema)
      .where(
        and(
          eq(projectMembersSchema.projectId, transferInput.projectId),
          eq(projectMembersSchema.userId, userId),
        ),
      )
      .for('update');

    if (!currentMembership || currentMembership.role !== 'owner') {
      throw new Error('当前用户不是项目所有者');
    }

    await transaction
      .update(projectMembersSchema)
      .set({ role: 'editor' })
      .where(
        and(
          eq(projectMembersSchema.projectId, transferInput.projectId),
          eq(projectMembersSchema.userId, userId),
        ),
      );

    await transaction
      .insert(projectMembersSchema)
      .values({
        projectId: transferInput.projectId,
        role: 'owner',
        userId: transferInput.targetUserId,
        workspaceId: authorization.project.workspaceId,
      })
      .onConflictDoUpdate({
        set: { role: 'owner' },
        target: [projectMembersSchema.projectId, projectMembersSchema.userId],
      });

    await transaction
      .update(projectsSchema)
      .set({ ownerId: transferInput.targetUserId })
      .where(eq(projectsSchema.id, transferInput.projectId));

    await transaction
      .delete(projectAccessRequestsSchema)
      .where(
        and(
          eq(projectAccessRequestsSchema.projectId, transferInput.projectId),
          eq(projectAccessRequestsSchema.userId, transferInput.targetUserId),
        ),
      );

    await transaction
      .delete(projectInvitationsSchema)
      .where(
        and(
          eq(projectInvitationsSchema.projectId, transferInput.projectId),
          eq(projectInvitationsSchema.userId, transferInput.targetUserId),
        ),
      );

    await createNotification(transaction, {
      actorUserId: userId,
      body: `你已成为项目“${authorization.project.name}”的所有者。`,
      recipientUserId: transferInput.targetUserId,
      target: { id: transferInput.projectId, kind: 'project' },
      title: '项目所有权转让',
      type: 'project_member_role_updated',
    });

    await recordAuditLog(transaction, {
      action: 'project_ownership_transferred',
      actorUserId: userId,
      metadata: {
        resourceName: authorization.project.name,
        targetUserId: transferInput.targetUserId,
      },
      targetId: transferInput.targetUserId,
      targetKind: 'member',
      workspaceId: authorization.project.workspaceId,
    });
  });

  revalidatePath('/(workspace)', 'layout');
  return { newOwnerId: transferInput.targetUserId, projectId: transferInput.projectId };
}
