import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import migrationJournal from '../../migrations/meta/_journal.json';

const statementBreakpoint = '--> statement-breakpoint';

export const migrationFiles = migrationJournal.entries.map((entry) => `${entry.tag}.sql`);

export function createTestPGlite(options?: ConstructorParameters<typeof PGlite>[0]) {
  const extensions = {
    pg_trgm,
    ...(typeof options === 'object' && options !== null && 'extensions' in options
      ? options.extensions
      : {}),
  };

  if (typeof options === 'string') {
    return new PGlite(options, { extensions });
  }

  return new PGlite({
    ...options,
    extensions,
  });
}

export async function executeMigrations(database: PGlite, fileNames: readonly string[]) {
  for (const fileName of fileNames) {
    const sql = await readFile(resolve('migrations', fileName), 'utf-8');

    for (const statement of sql.split(statementBreakpoint)) {
      if (statement.trim()) {
        await database.exec(statement);
      }
    }
  }
}
