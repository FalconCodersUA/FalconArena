import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

type HeaderValue = string | string[] | undefined;

export type HttpRequestLike = {
  headers?: Record<string, HeaderValue>;
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  requestId?: string;
  user?: {
    id?: string;
    role?: string;
    email?: string;
  };
};

export type HttpResponseLike = {
  statusCode?: number;
};

export function normalizeRequestId(candidate: HeaderValue): string | null {
  const raw = Array.isArray(candidate) ? candidate[0] : candidate;

  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 128);
}

export function resolveRequestId(request: HttpRequestLike): string {
  const headerRequestId = normalizeRequestId(request.headers?.[REQUEST_ID_HEADER]);
  return headerRequestId ?? request.requestId ?? randomUUID();
}

export type HttpLogEntryParams = {
  request: HttpRequestLike;
  response?: HttpResponseLike;
  durationMs: number;
  requestId: string;
  errorMessage?: string;
};

export function buildHttpLogEntry({
  request,
  response,
  durationMs,
  requestId,
  errorMessage,
}: HttpLogEntryParams) {
  return {
    requestId,
    method: request.method ?? 'UNKNOWN',
    path: request.originalUrl ?? request.url ?? '/',
    statusCode: response?.statusCode ?? 500,
    durationMs,
    ip: request.ip ?? null,
    userId: request.user?.id ?? null,
    userRole: request.user?.role ?? null,
    userEmail: request.user?.email ?? null,
    error: errorMessage ?? null,
  };
}
