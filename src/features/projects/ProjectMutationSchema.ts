import * as z from 'zod';
import { createProjectSchema } from './CreateProjectSchema';

export const updateProjectSchema = z.object({
  name: createProjectSchema.shape.name,
  projectId: z.uuid(),
});

export const deleteProjectSchema = z.object({ projectId: z.uuid() });

export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
