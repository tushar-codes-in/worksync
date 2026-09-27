'use client';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { apiRaw } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Activity } from '@/lib/types';
import { ACTION_LABEL } from '../lib/activity-labels';



export function ProjectActivityPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Activity[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await apiRaw<Activity[]>(`/api/projects/${projectId}/activity?limit=20`);
      if (alive) setItems(res.data);
    })().catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [projectId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items === null ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          items.map((a) => {
            const actorName = typeof a.actor === 'string' ? 'Someone' : a.actor.name;
            return (
              <div key={a._id} className="text-sm">
                <span className="font-medium">{actorName}</span>{' '}
                <span className="text-muted-foreground">
                  {ACTION_LABEL[a.action] ?? a.action}
                </span>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
