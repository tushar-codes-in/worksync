'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteProjectDialog({ open, projectId, projectName, onClose, onDeleted }: Props) {
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isMatch = confirm === projectName;

  const handleDelete = async () => {
    if (!isMatch) return;
    setLoading(true);
    setError('');
    try {
      await api(`/api/projects/${projectId}`, { method: 'DELETE' });
      onDeleted();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete project.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setConfirm(''); } }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold tracking-[-0.02em] text-[#c0392b]">
            Delete project
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-[#555] leading-relaxed">
            This will permanently delete{' '}
            <span className="font-semibold text-[#0a0a0a]">{projectName}</span> and all its
            tasks. This action <span className="font-semibold">cannot be undone</span>.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#555]">
              Type <span className="font-semibold text-[#0a0a0a]">{projectName}</span> to confirm
            </Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={projectName}
              className="text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => { onClose(); setConfirm(''); }} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleDelete}
            disabled={!isMatch || loading}
            className="bg-[#c0392b] hover:bg-[#a93226] text-white disabled:opacity-40"
          >
            {loading ? 'Deleting…' : 'Delete project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}