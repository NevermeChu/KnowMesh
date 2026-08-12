'use server';

import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/libs/DB';
import { projectMembersSchema, workspaceMembersSchema } from '@/models/Schema';
import { projectMemberMutationSchema } from '../MemberSchema';
import type { ProjectMemberMutationInput } from '../MemberSchema';
import { authorizeProject } from './ProjectAuthorization';

async function authorizeProjectMemberMutation(input: ProjectMemberMutationInput) {
  const { userId } = await auth.protect();
  const memberInput = projectMemberMutationSchema.parse(input);
  const authorization = await authorizeProject({
    permission: 'project.members.manage',
    projectId: memberInput.projectId,
    userId,
  });

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

export async function addProjectMember(input: ProjectMemberMutationInput) {
  const memberInput = projectMemberMutationSchema.required({ role: true }).parse(input);
  await authorizeProjectMemberMutation(memberInput);
  await db
    .insert(projectMembersSchema)
    .values({
      projectId: memberInput.projectId,
      role: memberInput.role,
      userId: memberInput.memberUserId,
    })
    .onConflictDoUpdate({
      set: { role: memberInput.role },
      target: [projectMembersSchema.projectId, projectMembersSchema.userId],
    });
  revalidatePath('/(workspace)', 'layout');
  return { userId: memberInput.memberUserId };
}

export async function updateProjectMemberRole(input: ProjectMemberMutationInput) {
  return await addProjectMember(input);
}

export async function removeProjectMember(input: ProjectMemberMutationInput) {
  const memberInput = await authorizeProjectMemberMutation(input);
  await db
    .delete(projectMembersSchema)
    .where(
      and(
        eq(projectMembersSchema.projectId, memberInput.projectId),
        eq(projectMembersSchema.userId, memberInput.memberUserId),
      ),
    );
  revalidatePath('/(workspace)', 'layout');
  return { userId: memberInput.memberUserId };
}
