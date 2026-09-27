'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const router = useRouter();
  const hydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (hydrated && user) router.replace('/dashboard');
  }, [hydrated, user, router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(hsl(0 0% 0% / 0.06) 1px, transparent 1px),
            linear-gradient(90deg, hsl(0 0% 0% / 0.06) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 100%)',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 100%)',
        }}
      />

      <span className="absolute left-6 top-5 font-mono text-[10px] tracking-widest text-muted-foreground/50">
        v2.0 — 2026
      </span>
      <span className="absolute bottom-5 right-6 font-mono text-[10px] tracking-widest text-muted-foreground/50">
        real-time sync
      </span>

      
      <div className="relative flex flex-col items-center">
        <p
          className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          style={{ animation: 'fadeUp 0.6s ease forwards 0.1s', opacity: 0 }}
        >
          Where teams stop losing track.
        </p>

        <h1
          className="mb-1 font-serif text-[72px] font-normal leading-none tracking-tight"
          style={{ animation: 'fadeUp 0.7s ease forwards 0.25s', opacity: 0 }}
        >
          Sync<span className="opacity-35 italic">.</span>
        </h1>

        <p
          className="mb-10 max-w-[300px] font-mono text-[13px] font-light leading-relaxed text-muted-foreground"
          style={{ animation: 'fadeUp 0.7s ease forwards 0.4s', opacity: 0 }}
        >
          Plan work, ship faster,<br />see updates instantly.
        </p>

        <div
          className="flex gap-2.5"
          style={{ animation: 'fadeUp 0.7s ease forwards 0.55s', opacity: 0 }}
        >
          <Button asChild className="rounded font-mono text-xs tracking-wide px-6">
            <Link href="/login">Log in</Link>
          </Button>
          <Button variant="outline" asChild className="rounded font-mono text-xs tracking-wide px-6">
            <Link href="/register">Create account</Link>
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}