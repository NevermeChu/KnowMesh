import * as z from 'zod';
import { userThemePreferences } from '@/features/preferences/Preferences';

export const updateUserThemeSchema = z.object({
  theme: z.enum(userThemePreferences, '不支持的主题选项'),
});

export type UpdateUserThemeInput = z.infer<typeof updateUserThemeSchema>;
