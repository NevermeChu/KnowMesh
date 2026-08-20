import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

const statementBreakpoint = '--> statement-breakpoint';

export const migrationFiles = [
  '0000_deep_the_anarchist.sql',
  '0001_add-project-members.sql',
  '0002_add-documents.sql',
  '0003_add-workspaces.sql',
  '0004_tricky_scarlet_spider.sql',
  '0005_add-workspace-kind.sql',
  '0006_remove-project-kind.sql',
  '0007_remove-redundant-indexes.sql',
  '0008_dashing_vivisector.sql',
  '0009_cheerful_mockingbird.sql',
  '0010_silly_nomad.sql',
  '0011_add-notifications.sql',
  '0012_add-user-preferences.sql',
  '0013_add-content-width-preference.sql',
  '0014_flawless_lilandra.sql',
  '0015_neat_earthquake.sql',
  '0016_perpetual_korath.sql',
  '0017_late_dakota_north.sql',
  '0018_cloudy_the_spike.sql',
  '0019_add-better-auth.sql',
  '0020_swift_groot.sql',
  '0021_notification_realtime_delivery.sql',
] as const;

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
