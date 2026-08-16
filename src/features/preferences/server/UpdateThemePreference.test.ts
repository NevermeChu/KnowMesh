import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_COOKIE } from '@/features/preferences/Preferences';
import { updateThemePreference } from './UpdateThemePreference';

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

  return {
    cookieSet,
    cookies,
    insert,
    onConflictDoUpdate,
    protect,
    revalidatePath,
    values,
  };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates insert behavior.
vi.mock('@/libs/DB', () => ({ db: { insert: state.insert } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Column markers make conflict target assertions explicit.
vi.mock('@/models/Schema', () => ({
  userPreferencesSchema: {
    theme: 'user_preferences.theme',
    updatedAt: 'user_preferences.updatedAt',
    userId: 'user_preferences.userId',
  },
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cookies mock verifies the theme mirror.
vi.mock('next/headers', () => ({ cookies: state.cookies }));

describe(updateThemePreference, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_reader' });
    state.cookies.mockResolvedValue({ set: state.cookieSet });
    state.onConflictDoUpdate.mockResolvedValue([]);
  });

  it('upserts theme and mirrors it into the theme cookie', async () => {
    await expect(updateThemePreference({ theme: 'dark' })).resolves.toBeUndefined();

    expect(state.values).toHaveBeenCalledWith({ theme: 'dark', userId: 'user_reader' });
    expect(state.onConflictDoUpdate).toHaveBeenCalledWith({
      target: 'user_preferences.userId',
      set: { theme: 'dark', updatedAt: expect.any(Date) },
    });
    expect(state.cookieSet).toHaveBeenCalledWith(
      THEME_COOKIE,
      'dark',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(state.revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('rejects unsupported theme values', async () => {
    // oxlint-disable-next-line typescript/no-unsafe-argument -- Simulates an untrusted client payload.
    await expect(updateThemePreference(JSON.parse('{"theme":"sepia"}'))).rejects.toThrow(
      '不支持的主题选项',
    );

    expect(state.insert).not.toHaveBeenCalled();
    expect(state.cookieSet).not.toHaveBeenCalled();
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated callers', async () => {
    state.protect.mockRejectedValue(new Error('未登录'));

    await expect(updateThemePreference({ theme: 'light' })).rejects.toThrow('未登录');

    expect(state.insert).not.toHaveBeenCalled();
  });
});
