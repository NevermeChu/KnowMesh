import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

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
});
