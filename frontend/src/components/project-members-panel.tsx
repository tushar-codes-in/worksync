'use client';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Project, Role } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { initials } from '@/lib/utils';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});
type InviteValues = z.infer<typeof inviteSchema>;

export function ProjectMembersPanel({
  project,
  canManage,
  onUpdated,
}: {
  project: Project;
  canManage: boolean;
  onUpdated: (p: Project) => void;
}) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, reset } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'member', email: '' },
  });

  const invite = async (data: InviteValues) => {
    try {
      await api(`/api/projects/${project._id}/invites`, { method: 'POST', body: data });
      toast.success(`Invitation sent to ${data.email}`);
      reset({ email: '', role: 'member' });
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const changeRole = async (userId: string, role: Role) => {
    try {
      const updated = await api<Project>(`/api/projects/${project._id}/members/${userId}`, {
        method: 'PATCH', body: { role },
      });
      onUpdated(updated);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm('Remove this member from the project?')) return;
    try {
      const updated = await api<Project>(`/api/projects/${project._id}/members/${userId}`, {
        method: 'DELETE',
      });
      onUpdated(updated);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Members</CardTitle>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1 h-4 w-4" /> Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a teammate</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(invite)} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input id="invite-email" type="email" {...register('email')} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={watch('role')} onValueChange={(v) => setValue('role', v as Role)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin — manage project & members</SelectItem>
                        <SelectItem value="member">Member — create & edit tasks</SelectItem>
                        <SelectItem value="viewer">Viewer — read-only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>Send invitation</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
       {project.members
  .filter((m) => typeof m.user !== 'string' && m.user?._id)
  .map((m) => {
          const isOwner = typeof project.owner !== 'string' && m.user._id === project.owner._id;
          return (
            <div key={`${m.user._id}-${m.role}`} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="h-7 w-7"><AvatarFallback>{initials(m.user.name)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm">{m.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canManage && !isOwner ? (
                  <Select value={m.role} onValueChange={(v) => changeRole(m.user._id, v as Role)}>
                    <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground capitalize">{isOwner ? 'Owner' : m.role}</span>
                )}
                {canManage && !isOwner && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(m.user._id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
