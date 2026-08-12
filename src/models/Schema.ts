import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  DOCUMENT_CONTENT_SCHEMA_VERSION,
  EMPTY_DOCUMENT_CONTENT,
} from '@/features/documents/Document';
import type { DocumentContent } from '@/features/documents/Document';
import { memberRoles } from '@/features/permissions/Permission';
import { workspaceKinds } from '@/features/workspaces/Workspace';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// Development startup applies migrations before Next.js starts.
// Alternatively, if the database is running, use `npm run db:migrate` without restarting the server.

export const projectMemberRoleEnum = pgEnum('project_member_role', memberRoles);
export const workspaceKindEnum = pgEnum('workspace_kind', workspaceKinds);

export const workspacesSchema = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: workspaceKindEnum('kind').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
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
    userId: varchar('user_id', { length: 255 }).notNull(),
    role: projectMemberRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_members_user_workspace_idx').on(table.userId, table.workspaceId),
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
    role: projectMemberRoleEnum('role').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    invitedById: varchar('invited_by_id', { length: 255 }).notNull(),
    acceptedById: varchar('accepted_by_id', { length: 255 }),
    acceptedAt: timestamp('accepted_at', { mode: 'date' }),
    revokedAt: timestamp('revoked_at', { mode: 'date' }),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('workspace_invitations_token_hash_idx').on(table.tokenHash)],
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
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('projects_workspace_created_idx').on(table.workspaceId, table.createdAt)],
);

export const projectMembersSchema = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projectsSchema.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 255 }).notNull(),
    role: projectMemberRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
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
    title: varchar('title', { length: 200 }).notNull(),
    content: jsonb('content').$type<DocumentContent>().default(EMPTY_DOCUMENT_CONTENT).notNull(),
    contentSchemaVersion: integer('content_schema_version')
      .default(DOCUMENT_CONTENT_SCHEMA_VERSION)
      .notNull(),
    createdById: varchar('created_by_id', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('documents_project_updated_idx').on(table.projectId, table.updatedAt)],
);
