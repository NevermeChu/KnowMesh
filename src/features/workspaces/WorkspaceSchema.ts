import * as z from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, '请输入工作区名称').max(80, '工作区名称不能超过 80 个字符'),
});

export const selectWorkspaceSchema = z.object({ workspaceId: z.uuid() });

export const updateWorkspaceSchema = z.object({
  name: createWorkspaceSchema.shape.name,
  workspaceId: z.uuid(),
});

export const deleteWorkspaceSchema = z.object({ workspaceId: z.uuid() });

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
