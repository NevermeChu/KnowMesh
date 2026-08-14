import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markAllNotificationsRead, markNotificationRead } from './NotificationActions';

const state = vi.hoisted(() => {
  const protect = vi.fn<() => Promise<{ userId: string }>>();
  const returning = vi.fn<() => Promise<{ id: string }[]>>();
  const where = vi.fn<(condition: unknown) => { returning: typeof returning }>(() => ({
    returning,
  }));
  const set = vi.fn<(values: unknown) => { where: typeof where }>(() => ({ where }));
  const update = vi.fn<(table: unknown) => { set: typeof set }>(() => ({ set }));
  const eq = vi.fn<
    (column: unknown, value: unknown) => { column: unknown; operation: string; value: unknown }
  >((column, value) => ({ column, operation: 'eq', value }));
  const isNull = vi.fn<(column: unknown) => { column: unknown; operation: string }>((column) => ({
    column,
    operation: 'is-null',
  }));
  const and = vi.fn<(...conditions: unknown[]) => unknown[]>((...conditions) => conditions);
  const revalidatePath = vi.fn<(path: string, type?: 'layout' | 'page') => void>();

  return { and, eq, isNull, protect, revalidatePath, returning, set, update, where };
});

// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial Clerk mock isolates authentication.
vi.mock('@clerk/nextjs/server', () => ({ auth: { protect: state.protect } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Query operators are inspected as test values.
vi.mock('drizzle-orm', () => ({ and: state.and, eq: state.eq, isNull: state.isNull }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates update behavior.
vi.mock('@/libs/DB', () => ({ db: { update: state.update } }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Column markers make ownership assertions explicit.
vi.mock('@/models/Schema', () => ({
  notificationsSchema: {
    id: 'notifications.id',
    readAt: 'notifications.readAt',
    recipientUserId: 'notifications.recipientUserId',
  },
}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial cache mock verifies invalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));

describe(markNotificationRead, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_recipient' });
    state.returning.mockResolvedValue([{ id: '01987654-3210-7000-8000-000000000011' }]);
  });

  it('scopes update to authenticated recipient', async () => {
    await expect(
      markNotificationRead({ notificationId: '01987654-3210-7000-8000-000000000011' }),
    ).resolves.toBeUndefined();

    expect(state.eq).toHaveBeenCalledWith('notifications.recipientUserId', 'user_recipient');
    expect(state.isNull).toHaveBeenCalledWith('notifications.readAt');
    expect(state.revalidatePath).toHaveBeenCalledWith('/(workspace)', 'layout');
    expect(state.revalidatePath).toHaveBeenCalledWith('/notifications');
  });

  it('rejects missing unread notification', async () => {
    state.returning.mockResolvedValueOnce([]);

    await expect(
      markNotificationRead({ notificationId: '01987654-3210-7000-8000-000000000011' }),
    ).rejects.toThrow('未读通知不存在');

    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects invalid identifier before update', async () => {
    await expect(markNotificationRead({ notificationId: 'invalid' })).rejects.toThrow(
      'Invalid UUID',
    );

    expect(state.update).not.toHaveBeenCalled();
  });
});

describe(markAllNotificationsRead, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.protect.mockResolvedValue({ userId: 'user_recipient' });
  });

  it('scopes updates to authenticated recipient', async () => {
    await expect(markAllNotificationsRead()).resolves.toBeUndefined();

    expect(state.eq).toHaveBeenCalledWith('notifications.recipientUserId', 'user_recipient');
    expect(state.isNull).toHaveBeenCalledWith('notifications.readAt');
  });
});
