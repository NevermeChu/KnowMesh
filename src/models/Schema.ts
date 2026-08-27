import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  text,
  uuid,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { auditActions, auditTargetKinds } from '@/features/audit-logs/AuditLog';
import type { AuditLogMetadata } from '@/features/audit-logs/AuditLog';
import {
  DOCUMENT_CONTENT_SCHEMA_VERSION,
  EMPTY_DOCUMENT_CONTENT,
} from '@/features/documents/Document';
import type { DocumentContent } from '@/features/documents/Document';
import { notificationTargetKinds, notificationTypes } from '@/features/notifications/Notification';
import { memberRoles } from '@/features/permissions/Permission';
import { userThemePreferences } from '@/features/preferences/Preferences';
import { workspaceKinds } from '@/features/workspaces/Workspace';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// Development startup applies migrations before Next.js starts.
// Alternatively, if the database is running, use `npm run db:migrate` without restarting the server.

export const projectMemberRoleEnum = pgEnum('project_member_role', memberRoles);
export const notificationTypeEnum = pgEnum('notification_type', notificationTypes);

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  fromDriver: (value) => new Uint8Array(value),
  toDriver: (value) => Buffer.from(value),
});
export const notificationTargetKindEnum = pgEnum(
  'notification_target_kind',
  notificationTargetKinds,
);
export const auditActionEnum = pgEnum('audit_action', auditActions);
export const auditTargetKindEnum = pgEnum('audit_target_kind', auditTargetKinds);
export const workspaceKindEnum = pgEnum('workspace_kind', workspaceKinds);
export const userThemePreferenceEnum = pgEnum('user_theme_preference', userThemePreferences);

export const userSchema = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex('user_email_idx').on(table.email)],
);

export const sessionSchema = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('session_token_idx').on(table.token),
    index('session_user_id_idx').on(table.userId),
  ],
);

export const accountSchema = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    issuer: text('issuer').notNull(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      mode: 'date',
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      mode: 'date',
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('account_issuer_account_id_idx').on(table.issuer, table.accountId),
    index('account_user_id_idx').on(table.userId),
  ],
);

export const verificationSchema = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

export const notificationsSchema = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientUserId: varchar('recipient_user_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    actorUserId: varchar('actor_user_id', { length: 255 }).references(() => userSchema.id, {
      onDelete: 'set null',
    }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    body: varchar('body', { length: 320 }).notNull(),
    targetKind: notificationTargetKindEnum('target_kind'),
    targetId: uuid('target_id'),
    readAt: timestamp('read_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'notifications_target_pair_check',
      sql`(${table.targetKind} is null) = (${table.targetId} is null)`,
    ),
    index('notifications_recipient_created_idx').on(table.recipientUserId, table.createdAt.desc()),
    index('notifications_recipient_unread_idx')
      .on(table.recipientUserId)
      .where(sql`${table.readAt} is null`),
    uniqueIndex('notifications_workspace_invited_recipient_target_idx')
      .on(table.recipientUserId, table.targetId)
      .where(
        sql`${table.type} = 'workspace_invited' and ${table.targetKind} = 'workspace' and ${table.targetId} is not null`,
      ),
  ],
);

export const userPreferencesSchema = pgTable(
  'user_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    theme: userThemePreferenceEnum('theme').notNull().default('system'),
    contentWidth: integer('content_width').notNull().default(80),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex('user_preferences_user_id_idx').on(table.userId)],
);

export const workspacesSchema = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: workspaceKindEnum('kind').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workspaces_personal_owner_idx')
      .on(table.ownerId)
      .where(sql`${table.kind} = 'personal'`),
  ],
);

export const workspaceMembersSchema = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspacesSchema.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    role: projectMemberRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_members_user_workspace_idx').on(table.userId, table.workspaceId),
    uniqueIndex('workspace_members_single_owner_idx')
      .on(table.workspaceId)
      .where(sql`${table.role} = 'owner'`),
  ],
);

export const workspaceInvitationsSchema = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspacesSchema.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    invitedById: varchar('invited_by_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    acceptedById: varchar('accepted_by_id', { length: 255 }).references(() => userSchema.id, {
      onDelete: 'cascade',
    }),
    acceptedAt: timestamp('accepted_at', { mode: 'date', withTimezone: true }),
    revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('workspace_invitations_token_hash_idx').on(table.tokenHash),
    uniqueIndex('workspace_invitations_pending_workspace_email_idx')
      .on(table.workspaceId, table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
  ],
);

export const workspaceAccessRequestsSchema = pgTable(
  'workspace_access_requests',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspacesSchema.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    requestedRole: projectMemberRoleEnum('requested_role').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

export const projectsSchema = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspacesSchema.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.ownerId],
      foreignColumns: [workspaceMembersSchema.workspaceId, workspaceMembersSchema.userId],
      name: 'projects_workspace_owner_member_fk',
    }),
    index('projects_workspace_created_idx').on(table.workspaceId, table.createdAt),
    uniqueIndex('projects_id_workspace_idx').on(table.id, table.workspaceId),
  ],
);

export const projectMembersSchema = pgTable(
  'project_members',
  {
    projectId: uuid('project_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    role: projectMemberRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projectsSchema.id, projectsSchema.workspaceId],
      name: 'project_members_project_workspace_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.userId],
      foreignColumns: [workspaceMembersSchema.workspaceId, workspaceMembersSchema.userId],
      name: 'project_members_workspace_member_fk',
    }).onDelete('cascade'),
    uniqueIndex('project_members_single_owner_idx')
      .on(table.projectId)
      .where(sql`${table.role} = 'owner'`),
    index('project_members_user_project_idx').on(table.userId, table.projectId),
  ],
);

export const projectInvitationsSchema = pgTable(
  'project_invitations',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsSchema.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    invitedById: varchar('invited_by_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

export const projectAccessRequestsSchema = pgTable(
  'project_access_requests',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsSchema.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    requestedRole: projectMemberRoleEnum('requested_role').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

export const documentsSchema = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsSchema.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    title: varchar('title', { length: 200 }).notNull(),
    titleVersion: integer('title_version').default(1).notNull(),
    sortOrder: doublePrecision('sort_order').default(0).notNull(),
    content: jsonb('content').$type<DocumentContent>().default(EMPTY_DOCUMENT_CONTENT).notNull(),
    contentSchemaVersion: integer('content_schema_version')
      .default(DOCUMENT_CONTENT_SCHEMA_VERSION)
      .notNull(),
    searchText: text('search_text').default('').notNull(),
    createdById: varchar('created_by_id', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'documents_parent_id_fk',
    }).onDelete('cascade'),
    index('documents_project_updated_idx').on(table.projectId, table.updatedAt),
    index('documents_project_parent_sort_idx').on(
      table.projectId,
      table.parentId,
      table.sortOrder,
      table.id,
    ),
    index('documents_search_text_trgm_idx').using('gin', table.searchText.op('gin_trgm_ops')),
    index('documents_title_trgm_idx').using('gin', table.title.op('gin_trgm_ops')),
  ],
);

export const documentCollaborationStatesSchema = pgTable('document_collaboration_states', {
  documentId: uuid('document_id')
    .primaryKey()
    .references(() => documentsSchema.id, { onDelete: 'cascade' }),
  state: bytea('state').notNull(),
  documentSchemaVersion: integer('document_schema_version').notNull(),
  initializedAt: timestamp('initialized_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const starredDocumentsSchema = pgTable(
  'starred_documents',
  {
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => userSchema.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documentsSchema.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.documentId] }),
    index('starred_documents_user_created_idx').on(table.userId, table.createdAt.desc()),
  ],
);

export const auditLogsSchema = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    actorUserId: varchar('actor_user_id', { length: 255 }).notNull(),
    action: auditActionEnum('action').notNull(),
    targetKind: auditTargetKindEnum('target_kind'),
    targetId: varchar('target_id', { length: 255 }),
    metadata: jsonb('metadata').$type<AuditLogMetadata>().default({}).notNull(),
    ipAddress: varchar('ip_address', { length: 128 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_workspace_created_idx').on(table.workspaceId, table.createdAt.desc()),
    index('audit_logs_actor_idx').on(table.actorUserId),
  ],
);
