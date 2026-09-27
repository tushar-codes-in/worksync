'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Archive, FolderKanban, Plus, Sparkles, Users } from 'lucide-react';
import { apiRaw } from '@/lib/api';
import { CreateProjectDialog } from '@/components/create-project-dialog';
import { formatDistanceToNow } from 'date-fns';
import type { Project } from '@/lib/types';

type Tab = 'active' | 'archived';
type Member = string | { user?: { name?: string; email?: string; _id?: string }; name?: string; email?: string; _id?: string };

function getMemberLabel(member: Member) {
  if (typeof member === 'string') return member;
  return member.user?.name ?? member.user?.email ?? member.name ?? member.email ?? 'U';
}

export default function DashboardPage() {
  const [items, setItems] = useState<Project[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>('active');

  useEffect(() => {
    let alive = true;
    setItems(null);

    (async () => {
      const res = await apiRaw<Project[]>(`/api/projects?status=${tab}`);
      if (alive) setItems(res.data);
    })().catch(() => alive && setItems([]));

    return () => {
      alive = false;
    };
  }, [refreshKey, tab]);

  const stats = useMemo(() => {
    const projects = items ?? [];
    const totalMembers = new Set(
      projects.flatMap((p) =>
        p.members.map((m: any) => m.user?._id ?? m.user ?? m._id ?? m.email),
      ),
    ).size;

    const lastUpdated = projects.length
      ? formatDistanceToNow(
          new Date(Math.max(...projects.map((p) => new Date(p.updatedAt).getTime()))),
          { addSuffix: true },
        )
      : 'No activity yet';

    return {
      projects: projects.length,
      members: totalMembers,
      updated: lastUpdated,
    };
  }, [items]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Project workspace
            </div>

            <h1 className="text-3xl font-semibold tracking-tight">
              Manage your team’s work in one place
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Track active projects, review team progress, and jump back into the work that needs your attention.
            </p>
          </div>

          {tab === 'active' && (
            <CreateProjectDialog onCreated={() => setRefreshKey((k) => k + 1)}>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-sm transition hover:opacity-90">
                <Plus className="h-4 w-4" />
                Create project
              </button>
            </CreateProjectDialog>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StatCard icon={FolderKanban} label="Projects" value={stats.projects} />
          <StatCard icon={Users} label="Collaborators" value={stats.members} />
          <StatCard icon={Archive} label="Last updated" value={stats.updated} />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {tab === 'active' ? 'Active projects' : 'Archived projects'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tab === 'active'
              ? 'Projects your team is currently working on.'
              : 'Projects moved out of your active workspace.'}
          </p>
        </div>

        <div className="flex w-fit rounded-xl border bg-muted/40 p-1">
          {(['active', 'archived'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                tab === t
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {items === null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border bg-muted/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-muted/20 px-8 py-14 text-center">
          <h3 className="text-base font-semibold">
            {tab === 'active' ? 'No active projects yet' : 'No archived projects yet'}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {tab === 'active'
              ? 'Create your first project and start organizing tasks, members, files, and discussions.'
              : 'When you archive a project, it will appear here for future reference.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => {
            const members = p.members as unknown as Member[];
            const visible = members.slice(0, 4);
            const overflow = members.length - 4;

            return (
              <Link
                key={p._id}
                href={`/projects/${p._id}`}
                className="group flex min-h-44 flex-col rounded-2xl border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold tracking-tight">
                      {p.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                    </p>
                  </div>

                  <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs capitalize text-muted-foreground">
                    {p.status}
                  </span>
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {p.description || 'No project description added yet.'}
                </p>

                <div className="mt-auto flex items-center justify-between pt-5">
                  <div className="flex items-center">
                    {visible.map((m, i) => {
                      const label = getMemberLabel(m);

                      return (
                        <div
                          key={`${label}-${i}`}
                          style={{ marginLeft: i === 0 ? 0 : -8 }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-foreground"
                        >
                          {label.slice(0, 2).toUpperCase()}
                        </div>
                      );
                    })}

                    {overflow > 0 && (
                      <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-foreground text-xs font-medium text-background">
                        +{overflow}
                      </div>
                    )}
                  </div>

                  <span className="text-xs font-medium text-muted-foreground transition group-hover:text-foreground">
                    Open
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}