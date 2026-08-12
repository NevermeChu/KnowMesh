'use server';

import { createHash, randomBytes } from 'node:crypto';
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { sendWorkspaceInvitationEmail } from '@/features/emails/server/SendWorkspaceInvitationEmail';
import { db } from '@/libs/DB';
import {
  projectMembersSchema,
  projectsSchema,
  workspaceInvitationsSchema,
  workspaceMembersSchema,
} from '@/models/Schema';
import { getBaseUrl } from '@/utils/Helpers';
import {
  acceptWorkspaceInvitationSchema,
  inviteWorkspaceMemberSchema,
  workspaceMemberMutationSchema,
} from '../MemberSchema';
import type {
  AcceptWorkspaceInvitationInput,
  InviteWorkspaceMemberInput,
  WorkspaceMemberMutationInput,
} from '../MemberSchema';
import { authorizeWorkspace } from './WorkspaceAuthorization';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

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
  const tokenHash = hashToken(token);
  const [invitation] = await db
    .insert(workspaceInvitationsSchema)
    .values({
      email: invitationInput.email,
      expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
      invitedById: userId,
      role: invitationInput.role,
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
      email: invitationInput.email,
      workspaceName: authorization.workspace.name,
    });
  } catch (error) {
    await db
      .delete(workspaceInvitationsSchema)
      .where(eq(workspaceInvitationsSchema.id, invitation.id));
    throw error;
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
        eq(workspaceInvitationsSchema.tokenHash, hashToken(invitationInput.token)),
        isNull(workspaceInvitationsSchema.acceptedAt),
        isNull(workspaceInvitationsSchema.revokedAt),
      ),
    )
    .limit(1);

  if (!invitation || invitation.expiresAt <= now || !verifiedEmails.has(invitation.email)) {
    throw new Error('邀请无效、已过期或与当前账号邮箱不匹配');
  }

  await db.transaction(async (transaction) => {
    await transaction
      .insert(workspaceMembersSchema)
      .values({ role: invitation.role, userId, workspaceId: invitation.workspaceId })
      .onConflictDoNothing();
    await transaction
      .update(workspaceInvitationsSchema)
      .set({ acceptedAt: now, acceptedById: userId })
      .where(eq(workspaceInvitationsSchema.id, invitation.id));
  });

  revalidatePath('/(workspace)', 'layout');
  return { workspaceId: invitation.workspaceId };
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

  const [membership] = await db
    .update(workspaceMembersSchema)
    .set({ role: memberInput.role })
    .where(
      and(
        eq(workspaceMembersSchema.workspaceId, memberInput.workspaceId),
        eq(workspaceMembersSchema.userId, memberInput.memberUserId),
      ),
    )
    .returning({ userId: workspaceMembersSchema.userId });

  if (!membership) {
    throw new Error('工作区成员不存在');
  }

  revalidatePath('/(workspace)', 'layout');
  return membership;
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

  const ownedProjects = await db
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

  await db.transaction(async (transaction) => {
    const projects = await transaction
      .select({ id: projectsSchema.id })
      .from(projectsSchema)
      .where(eq(projectsSchema.workspaceId, memberInput.workspaceId));

    for (const project of projects) {
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
      .delete(workspaceMembersSchema)
      .where(
        and(
          eq(workspaceMembersSchema.workspaceId, memberInput.workspaceId),
          eq(workspaceMembersSchema.userId, memberInput.memberUserId),
        ),
      );
  });

  revalidatePath('/(workspace)', 'layout');
  return { userId: memberInput.memberUserId };
}
