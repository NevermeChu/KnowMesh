import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationsSchema } from '@/models/Schema';
import { markAllNotificationsRead, markNotificationRead } from './NotificationActions';
import { notificationBroadcaster } from './NotificationBroadcaster';

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

  const selectWhere = vi.fn<(condition: unknown) => Promise<{ value: number }[]>>();
  const selectFrom = vi.fn<(table: unknown) => { where: typeof selectWhere }>(() => ({
    where: selectWhere,
  }));
  const select = vi.fn<(fields?: unknown) => { from: typeof selectFrom }>(() => ({
    from: selectFrom,
  }));

  return {
    currentUser,
    requireUser,
    returning,
    revalidatePath: vi.fn<() => void>(),
    select,
    selectFrom,
    selectWhere,
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
    select: state.select,
    update: state.update,
  },
}));

describe('NotificationActions mutation suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe(markNotificationRead, () => {
    it('marks a single notification as read and publishes updated unread count', async () => {
      const publishSpy = vi.spyOn(notificationBroadcaster, 'publish');
      state.returning.mockResolvedValueOnce([{ id: 'notif-1' }]);
      state.selectWhere.mockResolvedValueOnce([{ value: 2 }]);

      await markNotificationRead({ notificationId: 'a3b8e7c1-1111-4222-8333-444455556666' });

      expect(state.update).toHaveBeenCalledWith(notificationsSchema);
      expect(publishSpy).toHaveBeenCalledWith('user-1', {
        payload: { unreadCount: 2 },
        type: 'notification:count_sync',
      });

      publishSpy.mockRestore();
    });

    it('throws error when notification does not exist', async () => {
      state.returning.mockResolvedValueOnce([]);

      await expect(
        markNotificationRead({ notificationId: 'a3b8e7c1-1111-4222-8333-444455556666' }),
      ).rejects.toThrow('未读通知不存在');
    });
  });

  describe(markAllNotificationsRead, () => {
    it('marks all notifications as read and publishes unreadCount 0', async () => {
      const publishSpy = vi.spyOn(notificationBroadcaster, 'publish');
      state.updateWhere.mockReturnValueOnce({ returning: state.returning });

      await markAllNotificationsRead();

      expect(state.update).toHaveBeenCalledWith(notificationsSchema);
      expect(publishSpy).toHaveBeenCalledWith('user-1', {
        payload: { unreadCount: 0 },
        type: 'notification:count_sync',
      });

      publishSpy.mockRestore();
    });
  });
});
