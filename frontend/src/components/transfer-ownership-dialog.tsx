'use client';
import { useState } from 'react';
import { api, apiRaw } from '@/lib/api';
import type { Project } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  project: Project;
  onClose: () => void;
  onTransferred: () => void;
}

export function TransferOwnershipDialog({ open, project, onClose, onTransferred }: Props) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  
  const members = project.members.filter((m) => m.role !== 'admin');

  const handleTransfer = async () => {
    if (!selectedUserId) { setError('Select a member to transfer to.'); return; }
    setLoading(true);
    setError('');
    try {
     await apiRaw(`/api/projects/${project._id}/transfer`, {
  method: 'PATCH',
  body: { newOwnerId: selectedUserId },
});
      onTransferred();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to transfer ownership.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold tracking-[-0.02em]">
            Transfer ownership
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-[#888] leading-relaxed">
            You will lose admin access after transferring. This cannot be undone.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#555]">Transfer to</Label>
            {members.length === 0 ? (
              <p className="text-xs text-[#aaa]">No other members to transfer to.</p>
            ) : (
              <div className="divide-y divide-[#f0f0f0] rounded-[8px] border border-[#e8e8e8] overflow-hidden">
                {members.map((m) => {
                  const user = m.user;
                  const initials = user.name?.slice(0, 2).toUpperCase() ?? '??';
                  return (
                    <label
                      key={user._id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        selectedUserId === user._id ? 'bg-[#f5f5f5]' : 'hover:bg-[#fafafa]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="transfer-target"
                        value={user._id}
                        checked={selectedUserId === user._id}
                        onChange={() => setSelectedUserId(user._id)}
                        className="accent-black"
                      />
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8e8e8] text-[10px] font-medium text-[#555]">
                        {initials}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#0a0a0a]">{user.name}</p>
                        <p className="text-[11px] text-[#aaa]">{user.email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleTransfer}
            disabled={loading || !selectedUserId || members.length === 0}
            className="bg-[#c0392b] hover:bg-[#a93226] text-white"
          >
            {loading ? 'Transferring…' : 'Transfer ownership'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}