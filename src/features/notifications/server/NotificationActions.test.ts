import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationsSchema } from '@/models/Schema';
import { markAllNotificationsRead, markNotificationRead } from './NotificationActions';

const state = vi.hoisted(() => {
  const currentUser = { id: 'user-1', email: 'user@example.com' };
  const requireUser = vi.fn<() => Promise<typeof currentUser>>().mockResolvedValue(currentUser);

  const returning = vi.fn<() => Promise<{ id: string }[]>>();
  const updateWhere = vi.fn<(condition: unknown) => { returning: typeof returning }>(() => ({
    returning,
  }));
  const updateSet = vi.fn<(values: unknown) => { where: typeof updateWhere }>(() => ({
    where: updateWhere,
  }));
  const update = vi.fn<(table: unknown) => { set: typeof updateSet }>(() => ({
    set: updateSet,
  }));

  return {
    currentUser,
    requireUser,
    returning,
    revalidatePath: vi.fn<() => void>(),
    update,
    updateSet,
    updateWhere,
  };
});

vi.mock(import('server-only'), () => ({}));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial next/cache mock isolates layout revalidation.
vi.mock('next/cache', () => ({ revalidatePath: state.revalidatePath }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial auth mock isolates identity.
vi.mock('@/features/auth/server/CurrentUser', () => ({ requireUser: state.requireUser }));
// oxlint-disable-next-line vitest/prefer-import-in-mock -- Partial database mock isolates queries.
vi.mock('@/libs/DB', () => ({
  db: {
    update: state.update,
  },
}));

describe('NotificationActions mutation suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe(markNotificationRead, () => {
    it('marks a single notification as read for database-triggered synchronization', async () => {
      state.returning.mockResolvedValueOnce([{ id: 'notif-1' }]);

      await markNotificationRead({ notificationId: 'a3b8e7c1-1111-4222-8333-444455556666' });

      expect(state.update).toHaveBeenCalledWith(notificationsSchema);
    });

    it('throws error when notification does not exist', async () => {
      state.returning.mockResolvedValueOnce([]);

      await expect(
        markNotificationRead({ notificationId: 'a3b8e7c1-1111-4222-8333-444455556666' }),
      ).rejects.toThrow('未读通知不存在');
    });
  });

  describe(markAllNotificationsRead, () => {
    it('marks all notifications as read for database-triggered synchronization', async () => {
      state.updateWhere.mockReturnValueOnce({ returning: state.returning });

      await markAllNotificationsRead();

      expect(state.update).toHaveBeenCalledWith(notificationsSchema);
    });
  });
});
