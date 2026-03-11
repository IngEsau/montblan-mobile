const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8080/api/v1';

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '');
}

export const API_BASE_URL = normalizeBaseUrl(
  (process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).trim(),
);
