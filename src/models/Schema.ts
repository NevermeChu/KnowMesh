import { index, pgEnum, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { projectKinds, projectMemberRoles } from '@/features/projects/Project';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// Development startup applies migrations before Next.js starts.
// Alternatively, if the database is running, use `npm run db:migrate` without restarting the server.

export const projectKindEnum = pgEnum('project_kind', projectKinds);
export const projectMemberRoleEnum = pgEnum('project_member_role', projectMemberRoles);

export const projectsSchema = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    kind: projectKindEnum('kind').notNull(),
    ownerId: varchar('owner_id', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('projects_owner_kind_idx').on(table.ownerId, table.kind)],
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
