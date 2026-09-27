'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useTasks } from '@/store/tasks';
import type { ProjectMember, Task, TaskStatus } from '@/lib/types';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['todo', 'in_progress', 'review', 'completed']),
  dueDate: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function CreateTaskDialog({
  projectId,
  members,
  defaultStatus = 'todo',
  children,
}: {
  projectId: string;
  members: ProjectMember[];
  defaultStatus?: TaskStatus;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const upsert = useTasks((s) => s.upsert);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium', status: defaultStatus, title: '' },
  });

  const onSubmit = async (data: Values) => {
    try {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
      };
      if (data.dueDate) payload.dueDate = new Date(data.dueDate).toISOString();
      const task = await api<Task>(`/api/projects/${projectId}/tasks`, { method: 'POST', body: payload });
      upsert(projectId, task);
      reset({ priority: 'medium', status: defaultStatus, title: '' });
      setOpen(false);
      toast.success('Task created');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" autoFocus {...register('title')} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={watch('status')} onValueChange={(v) => setValue('status', v as TaskStatus)}>
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
              <Select value={watch('priority')} onValueChange={(v) => setValue('priority', v as Values['priority'])}>
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
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" type="date" {...register('dueDate')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
