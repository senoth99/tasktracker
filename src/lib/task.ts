import type { Task, Priority, Status } from '../types';
import { isOverdue } from './date';

const priorityRank: Record<Priority, number> = {
  Критический: 0,
  Высокий: 1,
  Средний: 2,
  Низкий: 3
};

export const priorityColor: Record<Priority, string> = {
  Низкий: 'bg-slate-100 text-slate-700',
  Средний: 'bg-sky-100 text-sky-700',
  Высокий: 'bg-amber-100 text-amber-700',
  Критический: 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
};

export const sortTasks = (tasks: Task[], statuses: Status[]) => {
  const statusOrder = new Map(statuses.map((s) => [s.id, s.order]));
  return [...tasks].sort((a, b) => {
    const p = priorityRank[a.priority] - priorityRank[b.priority];
    if (p !== 0) return p;

    const aOver = isOverdue(a.deadline) ? -1 : 1;
    const bOver = isOverdue(b.deadline) ? -1 : 1;
    if (aOver !== bOver) return aOver - bOver;

    const d = a.deadline.localeCompare(b.deadline);
    if (d !== 0) return d;

    return (statusOrder.get(a.statusId) ?? 999) - (statusOrder.get(b.statusId) ?? 999);
  });
};
