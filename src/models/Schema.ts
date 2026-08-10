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
} from 'drizzle-orm/pg-core';
import {
  DOCUMENT_CONTENT_SCHEMA_VERSION,
  EMPTY_DOCUMENT_CONTENT,
} from '@/features/documents/Document';
import type { DocumentContent } from '@/features/documents/Document';
import { projectKinds, projectMemberRoles } from '@/features/projects/Project';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// Development startup applies migrations before Next.js starts.
// Alternatively, if the database is running, use `npm run db:migrate` without restarting the server.

export const projectKindEnum = pgEnum('project_kind', projectKinds);
export const projectMemberRoleEnum = pgEnum('project_member_role', projectMemberRoles);

export const workspacesSchema = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('workspaces_owner_idx').on(table.ownerId)],
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

export const projectsSchema = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspacesSchema.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    kind: projectKindEnum('kind').notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('projects_workspace_kind_idx').on(table.workspaceId, table.kind)],
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
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index('project_members_user_project_idx').on(table.userId, table.projectId),
  ],
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
