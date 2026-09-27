'use client';

import { useMemo, useState } from 'react';
import {
  Calendar,
  Edit3,
  Paperclip,
  Trash2,
  MessageCircle,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useTasks } from '@/store/tasks';
import type { ProjectMember, Task, UserRef } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { initials, cn } from '@/lib/utils';
import { TaskDialog } from './task-dialog';

const STATUS_LABEL: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  completed: 'Completed',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-700',
};

function isUserRef(value: UserRef | string): value is UserRef {
  return typeof value !== 'string';
}

export function TaskDetailsDialog({
  projectId,
  taskId,
  members,
  canEdit,
  canDelete,
  onClose,
}: {
  projectId: string;
  taskId: string;
  members: ProjectMember[];
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const task = useTasks((s) => s.byProject[projectId]?.[taskId]);
  const remove = useTasks((s) => s.remove);
  const upsert = useTasks((s) => s.upsert);

  const [editOpen, setEditOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [mentions, setMentions] = useState<string[]>([]);

  const mentionOpen = comment.includes('@');

  const selectedMentionNames = useMemo(() => {
    return members
      .filter((m) => mentions.includes(m.user._id))
      .map((m) => m.user.name);
  }, [members, mentions]);

  if (!task) return null;

  const del = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;

    try {
      await api(`/api/projects/${projectId}/tasks/${task._id}`, {
        method: 'DELETE',
      });
      remove(projectId, task._id);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;

    setSavingComment(true);

    try {
      const updated = await api<Task>(
        `/api/projects/${projectId}/tasks/${task._id}/comments`,
        {
          method: 'POST',
          body: {
            text: comment.trim(),
            mentions,
          },
        },
      );

      upsert(projectId, updated);
      setComment('');
      setMentions([]);
      toast.success('Comment added');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingComment(false);
    }
  };

  const dueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'No due date';

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="break-words text-2xl leading-tight">
                  {task.title}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  View task details, attachments and discussion
                </DialogDescription>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {canEdit && (
                  <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                )}

                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700"
                    onClick={del}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <div>
              <h4 className="mb-2 text-sm font-medium">Description</h4>
              <div className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                {task.description || 'No description added.'}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard label="Status">
                <Badge variant="outline">{STATUS_LABEL[task.status] ?? task.status}</Badge>
              </InfoCard>

              <InfoCard label="Priority">
                <span
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium capitalize',
                    PRIORITY_COLORS[task.priority],
                  )}
                >
                  {task.priority}
                </span>
              </InfoCard>

              <InfoCard label="Due date">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {dueDate}
                </div>
              </InfoCard>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Assignees</h4>

              {task.assignees.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {task.assignees.map((a) => {
                    const id = typeof a === 'string' ? a : a._id;
                    const name = typeof a === 'string' ? a : a.name;

                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-2 rounded-full border bg-background px-2 py-1 text-xs"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback>{initials(name)}</AvatarFallback>
                        </Avatar>
                        {name}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No assignees added.</p>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">
                Attachments ({task.attachments.length})
              </h4>

              {task.attachments.length > 0 ? (
                <div className="space-y-2">
                  {task.attachments.map((a) => (
                    <a
                      key={a.fileId}
                      href={`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}/files/${a.fileId}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-accent"
                    >
                      <Paperclip className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {(a.size / 1024).toFixed(1)} KB
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attachments added.</p>
              )}
            </div>

            <div className="border-t pt-5">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <h4 className="text-sm font-medium">
                  Comments ({task.comments?.length ?? 0})
                </h4>
              </div>

              <div className="space-y-3">
                {task.comments && task.comments.length > 0 ? (
                  task.comments.map((c) => {
                    const authorName = isUserRef(c.author) ? c.author.name : 'User';
                    const createdAt = c.createdAt
                      ? new Date(c.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <div key={c._id} className="rounded-xl border bg-background p-3">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback>{initials(authorName)}</AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium">{authorName}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{createdAt}</span>
                        </div>

                        <p className="whitespace-pre-wrap break-words pl-9 text-sm leading-6 text-muted-foreground">
                          {c.text}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No comments yet.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment... type @ to mention members"
                  rows={3}
                  className="resize-none bg-background"
                />

                {selectedMentionNames.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mentioning: {selectedMentionNames.join(', ')}
                  </p>
                )}

                {mentionOpen && (
                  <div className="mt-2 rounded-lg border bg-background p-2">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Mention members
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => {
                        const selected = mentions.includes(m.user._id);

                        return (
                          <button
                            key={m.user._id}
                            type="button"
                            onClick={() => {
                              setMentions((prev) =>
                                selected
                                  ? prev.filter((id) => id !== m.user._id)
                                  : [...prev, m.user._id],
                              );

                              if (!comment.includes(`@${m.user.name}`)) {
                                setComment((prev) => `${prev} @${m.user.name}`);
                              }
                            }}
                            className={cn(
                              'rounded-full border px-2 py-1 text-xs hover:bg-accent',
                              selected && 'bg-foreground text-background hover:bg-foreground',
                            )}
                          >
                            @{m.user.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <Button
                    disabled={!comment.trim() || savingComment}
                    onClick={addComment}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {savingComment ? 'Posting...' : 'Comment'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {editOpen && (
        <TaskDialog
          projectId={projectId}
          taskId={taskId}
          members={members}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}