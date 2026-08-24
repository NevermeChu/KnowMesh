import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    'process.env': JSON.stringify(loadEnv('', process.cwd(), 'NEXT_PUBLIC_')),
  },
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      include: ['src/**/*'],
    },
    environment: 'node',
    include: ['src/**/*.test.{js,ts,tsx}', 'scripts/**/*.test.ts', 'tests/**/*.integ.ts'],
    reporters: ['default', process.env.CI ? 'github-actions' : {}],
    env: loadEnv('', process.cwd(), ''),
    // Each integration file boots an embedded PostgreSQL (WASM); too many
    // concurrent forks exhaust memory and kill workers mid-run.
    maxWorkers: 2,
  },
});
