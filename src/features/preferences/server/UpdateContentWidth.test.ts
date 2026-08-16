import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_WIDTH_COOKIE } from '@/features/preferences/Preferences';
import type { UpdateContentWidthInput } from '@/features/preferences/PreferencesSchema';
import { updateContentWidth } from './UpdateContentWidth';

const state = vi.hoisted(() => {
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const onConflictDoUpdate = vi.fn<(config: unknown) => Promise<unknown[]>>();
  const values = vi.fn<(values: unknown) => { onConflictDoUpdate: typeof onConflictDoUpdate }>(
    () => ({ onConflictDoUpdate }),
  );
  const insert = vi.fn<(table: unknown) => { values: typeof values }>(() => ({ values }));
  const cookieSet = vi.fn<(name: string, value: string, options: unknown) => void>();
  const cookies = vi.fn<() => Promise<{ set: typeof cookieSet }>>();
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return { cookieSet, cookies, insert, onConflictDoUpdate, protect, revalidatePath, values };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates insert behavior.
vi.mock('@/libs/DB', () => ({ db: { insert: state.insert } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Column markers make conflict target assertions explicit.
vi.mock('@/models/Schema', () => ({
  userPreferencesSchema: {
    contentWidth: 'user_preferences.contentWidth',
    updatedAt: 'user_preferences.updatedAt',
    userId: 'user_preferences.userId',
  },
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cookies mock verifies the width mirror.
vi.mock('next/headers', () => ({ cookies: state.cookies }));

describe(updateContentWidth, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_reader' });
    state.cookies.mockResolvedValue({ set: state.cookieSet });
    state.onConflictDoUpdate.mockResolvedValue([]);
  });

  it('upserts width and mirrors it into the content width cookie', async () => {
    await expect(updateContentWidth({ width: 70 })).resolves.toBeUndefined();

    expect(state.values).toHaveBeenCalledWith({ contentWidth: 70, userId: 'user_reader' });
    expect(state.onConflictDoUpdate).toHaveBeenCalledWith({
      target: 'user_preferences.userId',
      set: { contentWidth: 70, updatedAt: expect.any(Date) },
    });
    expect(state.cookieSet).toHaveBeenCalledWith(
      CONTENT_WIDTH_COOKIE,
      '70',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
  });

  it('rejects widths outside the supported steps', async () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Simulates an untrusted client payload that bypassed client-side guards.
    const payload = { width: 75 } as unknown as UpdateContentWidthInput;

    await expect(updateContentWidth(payload)).rejects.toThrow('不支持的内容宽度选项');

    expect(state.insert).not.toHaveBeenCalled();
    expect(state.cookieSet).not.toHaveBeenCalled();
  });
});
