import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { auth as AuthInstance } from '@/libs/Auth';
import { getCurrentUser, requireUser } from './CurrentUser';

vi.mock(import('server-only'), () => ({}));

const state = vi.hoisted(() => ({
  getSession: vi.fn<typeof AuthInstance.api.getSession>(),
  headers: vi.fn<() => Promise<Headers>>(),
}));

vi.mock(import('next/headers'), () => ({ headers: state.headers }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates sessions.
vi.mock('@/libs/Auth', () => ({ auth: { api: { getSession: state.getSession } } }));

const verifiedUser = {
  createdAt: new Date('2026-08-18T00:00:00.000Z'),
  email: 'user@example.com',
  emailVerified: true,
  id: 'user-1',
  image: null,
  name: '测试用户',
  updatedAt: new Date('2026-08-18T00:00:00.000Z'),
};

const session = {
  createdAt: new Date('2026-08-18T00:00:00.000Z'),
  expiresAt: new Date('2026-08-25T00:00:00.000Z'),
  id: 'session-1',
  ipAddress: null,
  token: 'session-token',
  updatedAt: new Date('2026-08-18T00:00:00.000Z'),
  userAgent: null,
  userId: verifiedUser.id,
};

describe('Current user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.headers.mockResolvedValue(new Headers());
  });

  it('returns null without a session', async () => {
    state.getSession.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns stable user data for a verified session', async () => {
    state.getSession.mockResolvedValue({ session, user: verifiedUser });

    await expect(requireUser()).resolves.toStrictEqual({
      email: verifiedUser.email,
      emailVerified: true,
      id: verifiedUser.id,
      image: null,
      name: verifiedUser.name,
    });
  });

  it('rejects missing sessions', async () => {
    state.getSession.mockResolvedValue(null);

    await expect(requireUser()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects unverified users', async () => {
    state.getSession.mockResolvedValue({
      session,
      user: { ...verifiedUser, emailVerified: false },
    });

    await expect(requireUser()).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });
});
