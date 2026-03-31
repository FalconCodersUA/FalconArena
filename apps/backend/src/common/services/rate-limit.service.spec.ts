import { describe, expect, it, vi } from 'vitest';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  it('blocks after the limit is reached inside the same window', () => {
    const service = new RateLimitService();

    expect(
      service.consume({
        bucket: 'auth-login',
        key: 'user@example.com',
        limit: 2,
        windowSeconds: 60,
      }).allowed,
    ).toBe(true);

    expect(
      service.consume({
        bucket: 'auth-login',
        key: 'user@example.com',
        limit: 2,
        windowSeconds: 60,
      }).allowed,
    ).toBe(true);

    expect(
      service.consume({
        bucket: 'auth-login',
        key: 'user@example.com',
        limit: 2,
        windowSeconds: 60,
      }).allowed,
    ).toBe(false);
  });

  it('resets the bucket after the window expires', () => {
    vi.useFakeTimers();
    const service = new RateLimitService();

    expect(
      service.consume({
        bucket: 'auth-login',
        key: 'user@example.com',
        limit: 1,
        windowSeconds: 60,
      }).allowed,
    ).toBe(true);

    expect(
      service.consume({
        bucket: 'auth-login',
        key: 'user@example.com',
        limit: 1,
        windowSeconds: 60,
      }).allowed,
    ).toBe(false);

    vi.advanceTimersByTime(61_000);

    expect(
      service.consume({
        bucket: 'auth-login',
        key: 'user@example.com',
        limit: 1,
        windowSeconds: 60,
      }).allowed,
    ).toBe(true);

    vi.useRealTimers();
  });
});
