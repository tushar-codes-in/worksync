'use client';
import { useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';

/**
 * On mount, attempts a silent /auth/refresh. If it succeeds, we hydrate the auth
 * store with the new access token + /me payload. Either way, sets `hydrated = true`
 * so route guards know it's safe to redirect.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAccessToken = useAuth((s) => s.setAccessToken);
  const setUser = useAuth((s) => s.setUser);
  const setHydrated = useAuth((s) => s.setHydrated);

  useEffect(() => {
    (async () => {
      try {
        const { accessToken } = await api<{ accessToken: string }>('/api/auth/refresh', {
          method: 'POST',
          skipAuth: true,
        });
        setAccessToken(accessToken);
        const me = await api<{ id: string; name: string; email: string; avatarUrl?: string }>(
          '/api/auth/me',
        );
        setUser({ _id: me.id, name: me.name, email: me.email, avatarUrl: me.avatarUrl });
      } catch {
        // No active session — landing on /login or public pages is fine.
      } finally {
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}