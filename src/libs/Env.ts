import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const Env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    COLLABORATION_ADDRESS: z.string().min(1).default('127.0.0.1'),
    COLLABORATION_ENABLED: z.enum(['false', 'true']).optional(),
    COLLABORATION_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(1235),
    COLLABORATION_PORT: z.coerce.number().int().min(1).max(65_535).default(1234),
    DATABASE_URL: z.string().min(1),
    E2E_REAL_POSTGRES: z.enum(['true']).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_COLLABORATION_URL: z.url().default('ws://localhost:1234'),
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
  },
  // You need to destructure all the keys manually
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    COLLABORATION_ADDRESS: process.env.COLLABORATION_ADDRESS,
    COLLABORATION_ENABLED: process.env.COLLABORATION_ENABLED,
    COLLABORATION_HEALTH_PORT: process.env.COLLABORATION_HEALTH_PORT,
    COLLABORATION_PORT: process.env.COLLABORATION_PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    E2E_REAL_POSTGRES: process.env.E2E_REAL_POSTGRES,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_COLLABORATION_URL: process.env.NEXT_PUBLIC_COLLABORATION_URL,
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  },
});
