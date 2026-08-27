import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

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
  '0022_giant_annihilus.sql',
  '0023_document_collaboration_invalidation.sql',
  '0024_add-document-search-text.sql',
  '0025_add-trgm-search-indexes.sql',
  '0026_remarkable_edwin_jarvis.sql',
  '0027_woozy_magus.sql',
  '0028_blushing_moonstone.sql',
  '0029_majestic_orphan.sql',
  '0030_flowery_domino.sql',
  '0031_chief_silver_sable.sql',
  '0032_clammy_garia.sql',
] as const;

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
