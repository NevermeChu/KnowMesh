'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
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
} from '../MemberSchema';
import type {
  ProjectAccessRequestInput,
  ProjectAccessReviewInput,
  ProjectInvitationInput,
  ProjectMemberMutationInput,
} from '../MemberSchema';
import { authorizeProject } from './ProjectAuthorization';

async function authorizeProjectMemberMutation(input: ProjectMemberMutationInput) {
  const { userId } = await auth.protect();
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

  return memberInput;
}

export async function inviteProjectMember(input: ProjectInvitationInput) {
  const { userId } = await auth.protect();
  const invitationInput = projectInvitationSchema.parse(input);
  const memberInput = await authorizeProjectMemberMutation({
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

  await db
    .insert(projectInvitationsSchema)
    .values({
      invitedById: userId,
      projectId: memberInput.projectId,
      userId: memberInput.memberUserId,
    })
    .onConflictDoNothing();

  return { userId: memberInput.memberUserId };
}

export async function acceptProjectInvitation(input: { projectId: string }) {
  const { userId } = await auth.protect();
  const invitationInput = projectAccessRequestSchema.pick({ projectId: true }).parse(input);

  await db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ workspaceId: projectsSchema.workspaceId })
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
      .returning({ projectId: projectInvitationsSchema.projectId });

    if (!invitation) {
      throw new Error('项目邀请不存在');
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
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function requestProjectAccess(input: ProjectAccessRequestInput) {
  const { userId } = await auth.protect();
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

  await db
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
}

export async function approveProjectAccessRequest(input: ProjectAccessReviewInput) {
  const reviewInput = projectAccessReviewSchema.parse(input);
  await authorizeProjectMemberMutation({
    memberUserId: reviewInput.memberUserId,
    projectId: reviewInput.projectId,
    role: 'viewer',
  });

  await db.transaction(async (transaction) => {
    const [project] = await transaction
      .select({ workspaceId: projectsSchema.workspaceId })
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
  });

  revalidatePath('/(workspace)', 'layout');
}

export async function updateProjectMemberRole(input: ProjectMemberMutationInput) {
  const memberInput = projectMemberMutationSchema.required({ role: true }).parse(input);

  if (memberInput.role !== 'viewer') {
    throw new Error('提升项目角色必须通过权限申请');
  }
  await authorizeProjectMemberMutation(memberInput);
  const [membership] = await db
    .update(projectMembersSchema)
    .set({ role: memberInput.role })
    .where(
      and(
        eq(projectMembersSchema.projectId, memberInput.projectId),
        eq(projectMembersSchema.userId, memberInput.memberUserId),
      ),
    )
    .returning({ userId: projectMembersSchema.userId });

  if (!membership) {
    throw new Error('项目成员不存在');
  }

  revalidatePath('/(workspace)', 'layout');
  return membership;
}

export async function removeProjectMember(input: ProjectMemberMutationInput) {
  const memberInput = await authorizeProjectMemberMutation(input);
  const [membership] = await db
    .delete(projectMembersSchema)
    .where(
      and(
        eq(projectMembersSchema.projectId, memberInput.projectId),
        eq(projectMembersSchema.userId, memberInput.memberUserId),
      ),
    )
    .returning({ userId: projectMembersSchema.userId });

  if (!membership) {
    throw new Error('项目成员不存在');
  }
  revalidatePath('/(workspace)', 'layout');
  return { userId: memberInput.memberUserId };
}
