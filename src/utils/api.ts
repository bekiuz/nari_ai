const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return `${API_BASE_URL}${path}`;
}

export function websocketUrl(path: string): string {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  if (API_BASE_URL) {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${url.origin}${path}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}
