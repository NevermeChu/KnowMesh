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
  it('locks scripts, fonts, and collaboration sockets to approved origins', () => {
    const policy = proxy(new NextRequest('http://localhost:3000/')).headers.get(
      'Content-Security-Policy',
    );

    expect({
      connectSrc: policy?.includes("connect-src 'self'"),
      fontSrc: policy?.includes("font-src 'self' data:"),
      frameAncestors: policy?.includes("frame-ancestors 'none'"),
      hocuspocus: policy?.includes('ws://localhost:1234'),
      noGoogleFonts:
        !policy?.includes('fonts.googleapis.com') && !policy?.includes('fonts.gstatic.com'),
      nonceScript: /script-src 'self' 'nonce-[a-f0-9]{32}' 'strict-dynamic'/u.test(policy ?? ''),
      noUnsafeInline: !/script-src[^;]*'unsafe-inline'/u.test(policy ?? ''),
      objectSrc: policy?.includes("object-src 'none'"),
      styleSrc: policy?.includes("style-src 'self' 'unsafe-inline'"),
      whiteboardHttp: policy?.includes('http://localhost:1244'),
      whiteboardWs: policy?.includes('ws://localhost:1244'),
    }).toStrictEqual({
      connectSrc: true,
      fontSrc: true,
      frameAncestors: true,
      hocuspocus: true,
      noGoogleFonts: true,
      nonceScript: true,
      noUnsafeInline: true,
      objectSrc: true,
      styleSrc: true,
      whiteboardHttp: true,
      whiteboardWs: true,
    });
  });
});
