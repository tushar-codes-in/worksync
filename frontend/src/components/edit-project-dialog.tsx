'use client';
import { useState } from 'react';
import { apiRaw } from '@/lib/api';
import type { Project } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  project: Project;
  onClose: () => void;
  onUpdated: (p: Project) => void;
}

export function EditProjectDialog({ open, project, onClose, onUpdated }: Props) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiRaw<Project>(`/api/projects/${project._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: { name: name.trim(), description: description.trim() },
      });
      onUpdated(res.data);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold tracking-[-0.02em]">
            Edit project
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#555]">Project name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My project"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#555]">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              rows={3}
              className="resize-none text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}