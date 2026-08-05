import * as z from 'zod';
import { projectKinds } from './Project';

export const createProjectSchema = z.object({
  kind: z.enum(projectKinds),
  name: z.string().trim().min(1, '请输入项目名称').max(80, '项目名称不能超过 80 个字符'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
