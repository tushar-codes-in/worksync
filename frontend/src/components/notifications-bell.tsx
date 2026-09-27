'use client';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, apiRaw } from '@/lib/api';
import { useNotifications } from '@/store/notifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/store/auth';
import { formatDistanceToNow } from 'date-fns';
import { usePathname } from 'next/navigation';
import type { Activity } from '@/lib/types';
import { ACTION_LABEL } from '../lib/activity-labels';

export function NotificationsBell() {
  const items       = useNotifications((s) => s.items);
  const unread      = useNotifications((s) => s.unread);
  const setAll      = useNotifications((s) => s.setAll);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const hydrated    = useAuth((s) => s.hydrated);
  const user        = useAuth((s) => s.user);
  const pathname    = usePathname();

  const [activity, setActivity]           = useState<Activity[]>([]);
  const [activityCount, setActivityCount] = useState(0);

  const projectId      = pathname.match(/\/projects\/([^/]+)/)?.[1] ?? null;
  const prevCountRef   = useRef(0);  // tracks previous activity length to detect new items
  const isFirstLoad    = useRef(true);


  useEffect(() => {
    if (!hydrated || !user) return;
    (async () => {
      try {
        const res = await api<any>('/api/notifications?limit=30');
        setAll(Array.isArray(res) ? res : res?.data ?? [], 0);
      } catch {  }
    })();
  }, [hydrated, user, setAll]);

 
  useEffect(() => {
    if (!projectId) { setActivity([]); setActivityCount(0); prevCountRef.current = 0; isFirstLoad.current = true; return; }

    const fetchActivity = async () => {
      try {
        const res = await apiRaw<Activity[]>(`/api/projects/${projectId}/activity?limit=20`);
        const newItems = res.data;
        setActivity(newItems);

        if (isFirstLoad.current) {
         
          prevCountRef.current = newItems.length;
          isFirstLoad.current  = false;
        } else {
        
          const added = newItems.length - prevCountRef.current;
          if (added > 0) {
            setActivityCount((c) => c + added);
            prevCountRef.current = newItems.length;
          }
        }
      } catch {  }
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 10_000);
    return () => clearInterval(interval);
  }, [projectId]);

  const totalUnread = projectId ? activityCount : unread;

  const handleOpenChange = async (open: boolean) => {
    if (open) {
      // Clear counts on open
      setActivityCount(0);
      if (unread > 0) {
        await api('/api/notifications/mark-read', { method: 'POST', body: { ids: [] } }).catch(() => null);
        markAllRead();
      }
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#c0392b] px-1 text-[9px] font-semibold text-white leading-none">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[300px] p-0 overflow-hidden rounded-[10px] border border-[#e8e8e8]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
          <p className="text-[13px] font-medium tracking-[-0.01em] text-[#0a0a0a]">
            {projectId ? 'Activity' : 'Notifications'}
          </p>
          {totalUnread > 0 && (
            <span className="rounded-full bg-[#fdf2f1] border border-[#f5c6c2] px-2 py-0.5 text-[10px] font-medium text-[#c0392b]">
              {totalUnread} new
            </span>
          )}
        </div>

     
        {projectId ? (
          <div className="max-h-[360px] overflow-y-auto">
            {activity.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-[#888]">No activity yet</p>
                <p className="mt-0.5 text-[11.5px] text-[#bbb]">Actions will appear here.</p>
              </div>
            ) : (
              activity.map((a, i) => {
                const actorName = typeof a.actor === 'string' ? 'Someone' : a.actor.name;
                return (
                  <DropdownMenuItem
                    key={a._id}
                    className={`flex flex-col items-start gap-0.5 px-4 py-3 cursor-default rounded-none focus:bg-[#fafafa] ${
                      i !== 0 ? 'border-t border-[#f5f5f5]' : ''
                    }`}
                  >
                    <span className="text-[12.5px] text-[#0a0a0a] leading-snug">
                      <span className="font-medium">{actorName}</span>{' '}
                      <span className="text-[#888]">{ACTION_LABEL[a.action] ?? a.action}</span>
                    </span>
                    <span className="text-[10.5px] text-[#bbb]">
                      {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

        ) : (
        
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-[#888]">All caught up</p>
                <p className="mt-0.5 text-[11.5px] text-[#bbb]">No notifications yet.</p>
              </div>
            ) : (
              items.slice(0, 15).map((n, i) => (
                <DropdownMenuItem
                  key={n._id}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 cursor-default rounded-none focus:bg-[#fafafa] ${
                    i !== 0 ? 'border-t border-[#f5f5f5]' : ''
                  }`}
                >
                  <span className="text-[12.5px] font-normal text-[#0a0a0a] leading-snug">
                    {n.message}
                  </span>
                  <span className="text-[10.5px] text-[#bbb]">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </div>
        )}

       
        <DropdownMenuSeparator className="m-0" />
        <div className="px-4 py-2.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5DCAA5]" />
          <p className="text-[11px] text-[#bbb]">Live — updates appear instantly</p>
        </div>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}