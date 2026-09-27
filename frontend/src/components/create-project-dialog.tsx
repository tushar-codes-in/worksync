'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Project } from '@/lib/types';

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});
type Values = z.infer<typeof schema>;

export function CreateProjectDialog({
  children,
  onCreated,
}: {
  children: React.ReactNode;
  onCreated?: (p: Project) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<Values>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Values) => {
    try {
      const project = await api<Project>('/api/projects', { method: 'POST', body: data });
      toast.success('Project created');
      reset();
      setOpen(false);
      onCreated?.(project);
      router.push(`/projects/${project._id}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Projects organize tasks, members, and files.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" autoFocus {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register('description')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
