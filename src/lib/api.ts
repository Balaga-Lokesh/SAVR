export function apiBase(): string {
  // When running in the dev server (Vite), prefer relative paths so the dev
  // proxy (vite.config.ts) forwards /api requests to the Django backend over HTTP.
  if (import.meta.env.DEV) return '';
  return (import.meta.env.VITE_API_BASE as string) || 'http://127.0.0.1:8000';
}

export function apiUrl(path: string) {
  const base = apiBase();
  if (!base) return path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/+$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}
