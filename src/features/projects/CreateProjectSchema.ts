import * as z from 'zod';
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, '请输入项目名称').max(80, '项目名称不能超过 80 个字符'),
  workspaceId: z.uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
