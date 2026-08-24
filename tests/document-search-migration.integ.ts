import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestPGlite, executeMigrations } from './helpers/PGliteMigrations';

let database: PGlite;

describe('document search migrations', () => {
  beforeAll(async () => {
    database = createTestPGlite();
    await database.exec(`
      CREATE TABLE documents (
        id text PRIMARY KEY,
        title text NOT NULL,
        content jsonb NOT NULL
      );
      INSERT INTO documents (id, title, content)
      VALUES (
        'document_1',
        'Existing document',
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Alpha"},{"type":"text","text":"Beta"}]}]}'
      );
    `);

    await executeMigrations(database, [
      '0024_add-document-search-text.sql',
      '0025_add-trgm-search-indexes.sql',
    ]);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it('backfills existing document text and creates trigram indexes', async () => {
    const textResult = await database.query<{ search_text: string }>(
      `SELECT search_text FROM documents WHERE id = 'document_1'`,
    );
    const indexResult = await database.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'documents'
        AND indexname IN ('documents_search_text_trgm_idx', 'documents_title_trgm_idx')
      ORDER BY indexname
    `);

    expect(textResult.rows).toStrictEqual([{ search_text: 'Alpha Beta' }]);
    expect(indexResult.rows).toStrictEqual([
      { indexname: 'documents_search_text_trgm_idx' },
      { indexname: 'documents_title_trgm_idx' },
    ]);
  });
});
