'use client';
import { useEffect, useState } from 'react';
import { Paperclip, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, uploadWithProgress } from '@/lib/api';
import { useTasks } from '@/store/tasks';
import { emitEditing, emitStopEditing } from '@/lib/socket';
import type { ProjectMember, Task, TaskPriority, TaskStatus } from '@/lib/types';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/utils';

export function TaskDialog({
  projectId, taskId, members, canEdit, canDelete, onClose,
}: {
  projectId: string;
  taskId: string;
  members: ProjectMember[];
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const task = useTasks((s) => s.byProject[projectId]?.[taskId]);
  const presence = useTasks((s) => s.presence[projectId]?.[taskId]);
  const upsert = useTasks((s) => s.upsert);
  const remove = useTasks((s) => s.remove);

  const [draft, setDraft] = useState<Partial<Task> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  useEffect(() => {
    if (task && !draft) setDraft({ ...task });
  }, [task, draft]);

  useEffect(() => {
    if (!canEdit) return;
    emitEditing(projectId, taskId);
    return () => emitStopEditing(projectId, taskId);
  }, [canEdit, projectId, taskId]);

  if (!task) return null;
  const current = draft ?? task;

  const save = async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        expectedVersion: task.version,
      };
      if (current.title !== task.title) patch.title = current.title;
      if (current.description !== task.description) patch.description = current.description;
      if (current.status !== task.status) patch.status = current.status;
      if (current.priority !== task.priority) patch.priority = current.priority;
      if (current.dueDate !== task.dueDate) patch.dueDate = current.dueDate ?? null;

      if (Object.keys(patch).length === 1) {
        onClose();
        return;
      }
      const updated = await api<Task>(`/api/projects/${projectId}/tasks/${task._id}`, {
        method: 'PATCH', body: patch,
      });
      upsert(projectId, updated);
      toast.success('Saved');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      await api(`/api/projects/${projectId}/tasks/${task._id}`, { method: 'DELETE' });
      remove(projectId, task._id);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onFileChange = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('taskId', task._id);
    setUploadPct(0);
    try {
      const result = await uploadWithProgress(`/api/projects/${projectId}/files`, form, (pct) => setUploadPct(pct));
      // Refresh task to pull in new attachment array.
      const refreshed = await api<Task>(`/api/projects/${projectId}/tasks/${task._id}`);
      upsert(projectId, refreshed);
      toast.success(`Uploaded ${result.filename}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadPct(null);
    }
  };

  const removeAttachment = async (fileId: string) => {
    try {
      await api(`/api/projects/${projectId}/files/${fileId}`, { method: 'DELETE' });
      const refreshed = await api<Task>(`/api/projects/${projectId}/tasks/${task._id}`);
      upsert(projectId, refreshed);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const presenceCount = presence?.size ?? 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Task</DialogTitle>
          {presenceCount > 0 && (
            <DialogDescription className="text-green-700">
              {presenceCount} other {presenceCount === 1 ? 'person is' : 'people are'} viewing this task
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={current.title ?? ''}
              onChange={(e) => setDraft({ ...current, title: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={5}
              value={current.description ?? ''}
              onChange={(e) => setDraft({ ...current, description: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={current.status}
                onValueChange={(v) => setDraft({ ...current, status: v as TaskStatus })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={current.priority}
                onValueChange={(v) => setDraft({ ...current, priority: v as TaskPriority })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input
              type="date"
              value={current.dueDate ? new Date(current.dueDate).toISOString().slice(0, 10) : ''}
              onChange={(e) => setDraft({ ...current, dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              disabled={!canEdit}
            />
          </div>

       
          {task.assignees.length > 0 && (
            <div className="space-y-2">
              <Label>Assignees</Label>
              <div className="flex flex-wrap gap-2">
                {task.assignees.map((a) => {
                  const name = typeof a === 'string' ? a : a.name;
                  return (
                    <span key={typeof a === 'string' ? a : a._id} className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback>{initials(name)}</AvatarFallback>
                      </Avatar>
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

         
          <div className="space-y-2">
            <Label>Attachments ({task.attachments.length})</Label>
            <div className="space-y-1.5">
              {task.attachments.map((a) => (
                <div key={a.fileId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}/files/${a.fileId}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 truncate underline-offset-2 hover:underline"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span className="truncate">{a.filename}</span>
                    <span className="text-xs text-muted-foreground">{(a.size / 1024).toFixed(1)} KB</span>
                  </a>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAttachment(a.fileId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {canEdit && (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent">
                  {uploadPct === null ? (
                    <>
                      <Paperclip className="h-4 w-4" /> Attach file (≤5MB)
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading… {uploadPct}%
                    </>
                  )}
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFileChange(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          {canDelete ? (
            <Button variant="destructive" onClick={del}>Delete</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={!canEdit || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
