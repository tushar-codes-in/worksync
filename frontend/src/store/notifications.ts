import { create } from 'zustand';
import type { Notification } from '@/lib/types';

interface NotificationsState {
  items: Notification[];
  unread: number;
  setAll: (items: Notification[], unread: number) => void;
  prepend: (n: Notification) => void;
  markAllRead: () => void;
}

export const useNotifications = create<NotificationsState>((set) => ({
  items: [],
  unread: 0,
  setAll: (items, unread) => set({ items, unread }),
  prepend: (n) => set((s) => ({ items: [n, ...s.items].slice(0, 50), unread: s.unread + (n.read ? 0 : 1) })),
  markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })), unread: 0 })),
}));
