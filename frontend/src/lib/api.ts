/**
 * Lightweight typed fetch wrapper.
 *
 *  - Adds `Authorization: Bearer <token>` from the auth store.
 *  - Sends cookies on every call (`credentials: 'include'`) so the refresh cookie travels.
 *  - On `401 INVALID_TOKEN`, attempts a single in-flight refresh and replays the original request.
 *
 * Refresh is single-flighted (a shared promise) so a burst of parallel 401s doesn't
 * spawn N refresh calls.
 */
import { useAuth } from '@/store/auth';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const json = await res.json();
      const token: string | undefined = json?.data?.accessToken;
      if (!token) return null;
      useAuth.getState().setAccessToken(token);
      return token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export interface RequestOpts extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set true to bypass refresh-on-401 (used by /auth/refresh itself). */
  skipAuth?: boolean;
  /** When passed, sent as multipart/form-data — used by file upload (with progress). */
  form?: FormData;
}

export async function api<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { body, form, skipAuth, headers, ...rest } = opts;
  const init: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      ...(form ? {} : { 'Content-Type': 'application/json' }),
      ...(headers as Record<string, string> | undefined),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (form) init.body = form;

  if (!skipAuth) {
    const token = useAuth.getState().accessToken;
    if (token) (init.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${path}`, init);

  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      (init.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, init);
    } else {
      useAuth.getState().clear();
    }
  }

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const err = new Error(
      (data as any)?.error?.message ?? `Request failed (${res.status})`,
    ) as ApiError;
    err.status = res.status;
    err.code = (data as any)?.error?.code;
    err.details = (data as any)?.error?.details;
    throw err;
  }

  return ((data as any)?.data ?? data) as T;
}

export async function apiRaw<T = unknown>(path: string, opts: RequestOpts = {}): Promise<{ data: T; meta?: any }> {
  const { body, form, skipAuth, headers, ...rest } = opts;
  const init: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      ...(form ? {} : { 'Content-Type': 'application/json' }),
      ...(headers as Record<string, string> | undefined),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (form) init.body = form;

  if (!skipAuth) {
    const token = useAuth.getState().accessToken;
    if (token) (init.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${API_URL}${path}`, init);
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      (init.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}${path}`, init);
    }
  }
  const text = await res.text();
  const json = text ? safeJson(text) : { data: undefined };
  if (!res.ok) {
    const err = new Error((json as any)?.error?.message ?? `Request failed (${res.status})`) as ApiError;
    err.status = res.status;
    err.code = (json as any)?.error?.code;
    throw err;
  }
  return json as { data: T; meta?: any };
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

/**
 * Uploads a file with progress reporting using XHR (fetch can't report upload progress).
 */
export function uploadWithProgress(
  path: string,
  form: FormData,
  onProgress?: (pct: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    xhr.withCredentials = true;
    const token = useAuth.getState().accessToken;
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const data = xhr.responseText ? safeJson(xhr.responseText) : undefined;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((data as any)?.data ?? data);
      } else {
        const err = new Error((data as any)?.error?.message ?? `Upload failed (${xhr.status})`);
        (err as any).status = xhr.status;
        (err as any).code = (data as any)?.error?.code;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}