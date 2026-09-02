export const notificationTypes = [
  'workspace_invitation_accepted',
  'workspace_access_requested',
  'workspace_access_approved',
  'workspace_access_rejected',
  'workspace_invited',
  'workspace_member_role_updated',
  'workspace_member_removed',
  'project_invitation_accepted',
  'project_access_requested',
  'project_access_approved',
  'project_access_rejected',
  'project_invited',
  'project_member_role_updated',
  'project_member_removed',
] as const;

export const notificationTargetKinds = ['workspace', 'project'] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type NotificationTargetKind = (typeof notificationTargetKinds)[number];

export type NotificationItem = {
  accessRequestPending: boolean;
  actorUserId?: string | null;
  body: string;
  createdAt: Date;
  id: string;
  readAt: Date | null;
  targetId: string | null;
  targetKind: NotificationTargetKind | null;
  title: string;
  type: NotificationType;
};

export type RealtimeNotificationItem = {
  actorUserId?: string | null;
  body: string;
  createdAt: string;
  id: string;
  readAt: string | null;
  targetId: string | null;
  targetKind: NotificationTargetKind | null;
  title: string;
  type: NotificationType;
};

export type NotificationRealtimeEvent =
  | {
      payload: {
        notification: RealtimeNotificationItem;
        unreadCount?: number;
      };
      type: 'notification:new';
    }
  | {
      payload: {
        unreadCount: number;
      };
      type: 'notification:count_sync';
    };
