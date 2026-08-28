import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import type * as EnvModule from '@/libs/Env';
import { proxy } from './proxy';

vi.mock(
  import('@/libs/Env'),
  (): Partial<typeof EnvModule> => ({
    Env: {
      BETTER_AUTH_SECRET: 'unit-test-placeholder-secret-000000000000',
      COLLABORATION_ADDRESS: '127.0.0.1',
      COLLABORATION_HEALTH_PORT: 1235,
      COLLABORATION_PORT: 1234,
      DATABASE_URL: 'postgresql://localhost:5432/unit-test',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_COLLABORATION_URL: 'ws://localhost:1234',
      NEXT_PUBLIC_WHITEBOARD_COLLABORATION_URL: 'http://localhost:1244',
      NODE_ENV: 'test',
      WHITEBOARD_COLLABORATION_ADDRESS: '127.0.0.1',
      WHITEBOARD_COLLABORATION_HEALTH_PORT: 1245,
      WHITEBOARD_COLLABORATION_PORT: 1244,
    },
  }),
);

describe(proxy, () => {
  it('adds strict script policy with a request nonce', () => {
    const response = proxy(new NextRequest('http://localhost:3000/'));
    const policy = response.headers.get('Content-Security-Policy');

    expect(policy).toMatch(/script-src 'self' 'nonce-[a-f0-9]{32}' 'strict-dynamic'/u);
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/u);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it('keeps font and style assets same-origin', () => {
    const response = proxy(new NextRequest('http://localhost:3000/'));
    const policy = response.headers.get('Content-Security-Policy');

    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("font-src 'self' data:");
    expect(policy).not.toContain('fonts.googleapis.com');
    expect(policy).not.toContain('fonts.gstatic.com');
  });

  it('allows same-origin and collaboration websocket origins', () => {
    const response = proxy(new NextRequest('http://localhost:3000/'));
    const policy = response.headers.get('Content-Security-Policy');

    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain('ws://localhost:1234');
    expect(policy).toContain('http://localhost:1244');
    expect(policy).toContain('ws://localhost:1244');
  });
});
