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
      reporter: ['text', 'html', 'json-summary'],
      // Gates only pin pure domain modules at (or below) their reproducible
      // baseline so unrelated UI code cannot dilute them; no global gate yet.
      thresholds: {
        'src/features/permissions/PermissionPolicy.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/features/documents/DocumentSortOrder.ts': {
          branches: 90,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/features/search/Search.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/features/permissions/MemberWorkflow.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/features/permissions/server/RecordMemberAuditLog.ts': {
          branches: 45,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        'src/features/search/server/SearchWorkspaceContent.ts': {
          branches: 85,
          functions: 100,
          lines: 97,
          statements: 97,
        },
        'src/features/search/server/GetRecentPaletteDocuments.ts': {
          branches: 70,
          functions: 100,
          lines: 92,
          statements: 92,
        },
        'src/features/documents/server/GetDocumentNavigation.ts': {
          branches: 70,
          functions: 100,
          lines: 94,
          statements: 95,
        },
        'src/features/documents/server/MoveDocument.ts': {
          branches: 75,
          functions: 100,
          lines: 88,
          statements: 88,
        },
        'src/components/layout/AppSidebar/SidebarDocumentNavigationState.ts': {
          branches: 60,
          functions: 80,
          lines: 85,
          statements: 85,
        },
      },
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
