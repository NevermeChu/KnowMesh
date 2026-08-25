import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Env } from '@/libs/Env';
import * as schema from '@/models/Schema';

export const createDbConnection = () => {
  const pool = new Pool({
    connectionTimeoutMillis: 5000,
    connectionString: Env.DATABASE_URL,
    idle_in_transaction_session_timeout: 15_000,
    lock_timeout: 5000,
    max: 10,
    statement_timeout: 15_000,
  });

  pool.on('error', (error) => {
    console.error('Database pool error:', error);
  });

  return drizzle({
    client: pool,
    schema,
  });
};
