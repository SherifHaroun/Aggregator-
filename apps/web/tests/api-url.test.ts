/**
 * The web client and the API are deployed to different origins (Vercel and
 * Railway). Uploaded files are stored as root-relative paths, so an `<img>`
 * pointing straight at `/uploads/abc.png` asked the WEB origin for the file and
 * got a 404 — every company logo rendered broken in production.
 *
 * These tests pin the resolution rules that fixed it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAssetUrl } from '@/lib/api-url';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('with the API on another origin (production)', () => {
  const API = 'https://aggregator-production-a48d.up.railway.app/api/v1';

  it('resolves a stored upload path against the API origin', () => {
    vi.stubEnv('VITE_API_BASE_URL', API);
    expect(resolveAssetUrl('/uploads/abc.png')).toBe(
      'https://aggregator-production-a48d.up.railway.app/uploads/abc.png',
    );
  });

  it('resolves any uploaded file, not just logos', () => {
    vi.stubEnv('VITE_API_BASE_URL', API);
    expect(resolveAssetUrl('/uploads/nested/doc.pdf')).toBe(
      'https://aggregator-production-a48d.up.railway.app/uploads/nested/doc.pdf',
    );
  });

  it('leaves absolute and data URLs untouched', () => {
    vi.stubEnv('VITE_API_BASE_URL', API);
    expect(resolveAssetUrl('https://cdn.example.com/logo.svg')).toBe(
      'https://cdn.example.com/logo.svg',
    );
    expect(resolveAssetUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(resolveAssetUrl('blob:https://example.com/1234')).toBe('blob:https://example.com/1234');
    expect(resolveAssetUrl('//cdn.example.com/logo.svg')).toBe('//cdn.example.com/logo.svg');
  });

  it('falls back to same-origin when the base URL is unusable', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://');
    expect(resolveAssetUrl('/uploads/abc.png')).toBe('/uploads/abc.png');
  });
});

describe('with the API proxied on this origin (development)', () => {
  it('keeps the path relative so the Vite proxy handles it', () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
    expect(resolveAssetUrl('/uploads/abc.png')).toBe('/uploads/abc.png');
  });

  it('keeps the path relative when no base URL is configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(resolveAssetUrl('/uploads/abc.png')).toBe('/uploads/abc.png');
  });
});

describe('missing values', () => {
  it('reports nothing to render so callers can fall back to initials', () => {
    expect(resolveAssetUrl(null)).toBeUndefined();
    expect(resolveAssetUrl(undefined)).toBeUndefined();
    expect(resolveAssetUrl('   ')).toBeUndefined();
  });
});
