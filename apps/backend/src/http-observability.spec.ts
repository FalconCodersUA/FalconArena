import { describe, expect, it } from 'vitest';
import {
  REQUEST_ID_HEADER,
  buildHttpLogEntry,
  normalizeRequestId,
  resolveRequestId,
} from './http-observability';

describe('http observability helpers', () => {
  it('uses incoming request id header when present', () => {
    expect(
      resolveRequestId({
        headers: {
          [REQUEST_ID_HEADER]: 'req-123',
        },
      }),
    ).toBe('req-123');
  });

  it('normalizes blank request ids to null', () => {
    expect(normalizeRequestId('   ')).toBeNull();
  });

  it('builds a structured log entry with request metadata', () => {
    expect(
      buildHttpLogEntry({
        requestId: 'req-123',
        durationMs: 42,
        request: {
          method: 'POST',
          originalUrl: '/auth/login',
          ip: '127.0.0.1',
          user: {
            id: 'user-1',
            role: 'ADMIN',
            email: 'admin@falconarena.live',
          },
        },
        response: {
          statusCode: 201,
        },
      }),
    ).toEqual({
      requestId: 'req-123',
      method: 'POST',
      path: '/auth/login',
      statusCode: 201,
      durationMs: 42,
      ip: '127.0.0.1',
      userId: 'user-1',
      userRole: 'ADMIN',
      userEmail: 'admin@falconarena.live',
      error: null,
    });
  });
});
