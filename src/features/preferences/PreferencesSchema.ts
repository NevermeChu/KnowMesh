import * as z from 'zod';
import { userThemePreferences } from '@/features/preferences/Preferences';

export const updateUserThemeSchema = z.object({
  theme: z.enum(userThemePreferences, '不支持的主题选项'),
});

export type UpdateUserThemeInput = z.infer<typeof updateUserThemeSchema>;

export const updateContentWidthSchema = z.object({
  width: z.union(
    [z.literal(60), z.literal(70), z.literal(80), z.literal(90)],
    '不支持的内容宽度选项',
  ),
});

export type UpdateContentWidthInput = z.infer<typeof updateContentWidthSchema>;
