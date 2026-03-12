import { getToken } from './auth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://falconarena.live';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function normalizeError(payload: unknown, status: number) {
  if (payload && typeof payload === 'object') {
    const maybeMessage = (payload as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      return maybeMessage;
    }

    if (Array.isArray(maybeMessage)) {
      return maybeMessage.join(', ');
    }
  }

  return `Request failed with status ${status}`;
}

function parsePayload(text: string) {
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = parsePayload(text);

  if (!response.ok) {
    throw new ApiError(normalizeError(payload, response.status), response.status);
  }

  return payload as T;
}
