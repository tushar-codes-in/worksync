'use client';
import { useState } from 'react';
import { api, apiRaw } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onArchived: () => void;
}

export function ArchiveProjectDialog({ open, projectId, projectName, onClose, onArchived }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleArchive = async () => {
    setLoading(true);
    setError('');
    try {
     await apiRaw(`/api/projects/${projectId}`, {
  method: 'PATCH',
  body: { status: 'archived' },
});
      onArchived();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to archive project.');
      setLoading(false);
    }
  };

  

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold tracking-[-0.02em]">
            Archive project
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <p className="text-sm text-[#555] leading-relaxed">
            <span className="font-medium text-[#0a0a0a]">{projectName}</span> will be hidden
            from active views. You can restore it later from settings.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleArchive} disabled={loading}>
            {loading ? 'Archiving…' : 'Archive project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}