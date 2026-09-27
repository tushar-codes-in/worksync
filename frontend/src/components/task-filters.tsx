'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface TaskFilterState {
  search: string;
  status: 'all' | 'todo' | 'in_progress' | 'review' | 'completed';
  priority: 'all' | 'low' | 'medium' | 'high' | 'critical';
  sort: '-updatedAt' | 'dueDate' | '-priority' | 'createdAt';
}

export function TaskFilters({
  value,
  onChange,
}: {
  value: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
}) {
  // Debounce search 250ms so we don't refetch per keystroke.
  const [search, setSearch] = useState(value.search);
  useEffect(() => {
    const t = setTimeout(() => onChange({ ...value, search }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as TaskFilterState['status'] })}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="todo">To do</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="review">In review</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={value.priority} onValueChange={(v) => onChange({ ...value, priority: v as TaskFilterState['priority'] })}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>
      <Select value={value.sort} onValueChange={(v) => onChange({ ...value, sort: v as TaskFilterState['sort'] })}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="-updatedAt">Recently updated</SelectItem>
          <SelectItem value="createdAt">Oldest first</SelectItem>
          <SelectItem value="dueDate">Due date</SelectItem>
          <SelectItem value="-priority">Priority (high → low)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
