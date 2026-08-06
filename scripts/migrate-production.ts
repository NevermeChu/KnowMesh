import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function migrateProduction() {
  const environmentFile = process.argv.at(2);
  const executable = process.argv.at(1);

  if (!(environmentFile && executable)) {
    throw new Error('Expected the migration executable and production environment file paths');
  }

  const environment = config({ path: environmentFile, quiet: true });

  if (environment.error) {
    throw environment.error;
  }

  if (environment.parsed?.HOSTNAME !== 'localhost') {
    throw new Error('Production HOSTNAME must be localhost');
  }

  if (environment.parsed?.PORT !== '3000') {
    throw new Error('Production PORT must be 3000');
  }

  const { Env } = await import('@/libs/Env');
  const pool = new Pool({ connectionString: Env.DATABASE_URL });

  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: resolve(dirname(executable), 'migrations'),
    });
  } finally {
    await pool.end();
  }
}

void migrateProduction();
