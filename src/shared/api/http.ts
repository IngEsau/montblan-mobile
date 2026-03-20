import { API_BASE_URL } from '../config/env';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  token?: string | null;
  body?: unknown;
};

function buildHeaders(token?: string | null, body?: unknown) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  headers['Content-Type'] = 'application/json';

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function parseErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const asObject = payload as Record<string, unknown>;
    if (typeof asObject.message === 'string' && asObject.message.trim()) {
      return asObject.message;
    }
  }

  return fallback;
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', token, body }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(token, body),
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });

  const rawText = await response.text();
  let payload: unknown = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      parseErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }

  return payload as T;
}
