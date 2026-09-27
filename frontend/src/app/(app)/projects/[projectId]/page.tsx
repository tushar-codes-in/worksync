'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { api, apiRaw } from '@/lib/api';
import { joinProject, leaveProject } from '@/lib/socket';
import { useTasks } from '@/store/tasks';
import type { Project, Task, Role } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KanbanBoard } from '@/components/kanban-board';
import { TaskFilters, type TaskFilterState } from '@/components/task-filters';
import { ProjectMembersPanel } from '@/components/project-members-panel';

import { useAuth } from '@/store/auth';
import { EditProjectDialog } from '@/components/edit-project-dialog';
import { ArchiveProjectDialog } from '@/components/archive-project-dialog';
import { TransferOwnershipDialog } from '@/components/transfer-ownership-dialog';
import { DeleteProjectDialog } from '@/components/delete-project-dialog';

const EMPTY_TASK_MAP: Record<string, Task> = {};

type DialogType = 'edit' | 'archive' | 'transfer' | 'delete' | null;

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [filters, setFilters] = useState<TaskFilterState>({
    search: '',
    status: 'all',
    priority: 'all',
    sort: '-updatedAt',
  });
  const setMany = useTasks((s) => s.setMany);
  const tasksMap = useTasks((s) => s.byProject[projectId] ?? EMPTY_TASK_MAP);
  const me = useAuth((s) => s.user);

  useEffect(() => {
    joinProject(projectId);
    return () => { leaveProject(projectId); };
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await api<Project>(`/api/projects/${projectId}`);
      if (alive) setProject(p);
    })();
    return () => { alive = false; };
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const qs = new URLSearchParams();
      if (filters.search) qs.set('search', filters.search);
      if (filters.status !== 'all') qs.set('status', filters.status);
      if (filters.priority !== 'all') qs.set('priority', filters.priority);
      qs.set('sort', filters.sort);
      qs.set('limit', '100');
      const res = await apiRaw<Task[]>(`/api/projects/${projectId}/tasks?${qs.toString()}`);
      if (alive) setMany(projectId, res.data);
    })();
    return () => { alive = false; };
  }, [projectId, filters, setMany]);

  if (!project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const myRole: Role | undefined = me
    ? typeof project.owner === 'string'
      ? undefined
      : project.owner._id === me._id
        ? 'admin'
        : project.members.find((m) => m.user._id === me._id)?.role
    : undefined;

  const canManage = myRole === 'admin';
  const canEdit   = myRole === 'admin' || myRole === 'member';
  const tasks     = Object.values(tasksMap);

  const closeDialog = () => setActiveDialog(null);
  const handleUnarchive = async () => {
  await apiRaw(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: { status: 'active' },
  });
  router.push('/dashboard');
};

  return (
    <>
      {/* Dialogs */}
      <EditProjectDialog
        open={activeDialog === 'edit'}
        project={project}
        onClose={closeDialog}
        onUpdated={(updated) => { setProject(updated); closeDialog(); }}
      />
      <ArchiveProjectDialog
        open={activeDialog === 'archive'}
        projectId={project._id}
        projectName={project.name}
        onClose={closeDialog}
        onArchived={() => router.push('/dashboard')}
      />
      <TransferOwnershipDialog
        open={activeDialog === 'transfer'}
        project={project}
        onClose={closeDialog}
        onTransferred={() => router.push('/dashboard')}
      />
      <DeleteProjectDialog
        open={activeDialog === 'delete'}
        projectId={project._id}
        projectName={project.name}
        onClose={closeDialog}
        onDeleted={() => router.push('/dashboard')}
      />

      {/* Page */}
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
              <Link href="/dashboard">
                <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <Badge variant={project.status === 'active' ? 'secondary' : 'outline'}>
            {project.status}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <TaskFilters value={filters} onChange={setFilters} />
            <KanbanBoard
              projectId={projectId}
              tasks={tasks}
              members={project.members}
              canEdit={canEdit}
              canDelete={canManage}
            />
          </div>

          <div className="space-y-6">
            <ProjectMembersPanel project={project} canManage={canManage} onUpdated={setProject} />
           

            {canManage && (
              <div className="space-y-2.5">

                {/* Project settings */}
                <div className="overflow-hidden rounded-[10px] border border-[#e8e8e8]">
                  <div className="border-b border-[#e8e8e8] px-[18px] py-3.5">
                    <p className="text-[13px] font-medium tracking-[-0.01em] text-[#0a0a0a]">
                      Project settings
                    </p>
                    <p className="mt-0.5 text-[11.5px] font-light text-[#aaa]">
                      Manage name, description and status
                    </p>
                  </div>
                  <SettingsRow
                    label="Edit project"
                    desc="Update the project name, description, or status."
                  >
                    <ActionButton onClick={() => setActiveDialog('edit')}>Edit</ActionButton>
                  </SettingsRow>
                 {project.status === 'archived' ? (
  <SettingsRow
    label="Unarchive project"
    desc="Restore this project back to your active list."
  >
    <ActionButton onClick={handleUnarchive}>Unarchive</ActionButton>
  </SettingsRow>
) : (
  <SettingsRow
    label="Archive project"
    desc="Hide this project from active views. Can be restored later."
  >
    <ActionButton onClick={() => setActiveDialog('archive')}>Archive</ActionButton>
  </SettingsRow>
)}
                </div>

                
                <div className="overflow-hidden rounded-[10px] border border-[#fde8e6]">
                  <div className="border-b border-[#fde8e6] bg-[#fffaf9] px-[18px] py-3.5">
                    <p className="text-[13px] font-medium tracking-[-0.01em] text-[#c0392b]">
                      Danger zone
                    </p>
                    <p className="mt-0.5 text-[11.5px] font-light text-[#e0a09a]">
                      These actions are irreversible. Please be certain.
                    </p>
                  </div>
                  <SettingsRow
                    label="Transfer ownership"
                    desc="Assign a new owner. You will lose admin access."
                  >
                    <DangerButton onClick={() => setActiveDialog('transfer')}>Transfer</DangerButton>
                  </SettingsRow>
                  <SettingsRow
                    label="Delete project"
                    desc="Permanently delete this project and all its tasks. Cannot be undone."
                  >
                    <DangerButton onClick={() => setActiveDialog('delete')}>Delete project</DangerButton>
                  </SettingsRow>
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SettingsRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#f0f0f0] px-[18px] py-3.5 last:border-b-0">
      <div>
        <p className="text-[13px] font-medium tracking-[-0.01em] text-[#0a0a0a]">{label}</p>
        <p className="mt-0.5 text-[11.5px] font-light text-[#aaa]">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="whitespace-nowrap rounded-[7px] border border-[#d0d0d0] bg-transparent px-3.5 py-1.5 text-xs font-medium tracking-[-0.01em] text-[#0a0a0a] transition-colors hover:bg-[#f5f5f5]"
    >
      {children}
    </button>
  );
}

function DangerButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="whitespace-nowrap rounded-[7px] border border-[#f5c6c2] bg-transparent px-3.5 py-1.5 text-xs font-medium tracking-[-0.01em] text-[#c0392b] transition-colors hover:bg-[#fdf2f1]"
    >
      {children}
    </button>
  );
}