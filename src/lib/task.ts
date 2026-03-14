import type { Priority, Status, Task } from '../types';
import { isOverdue } from './date';

const priorityRank: Record<Priority, number> = {
  Критический: 0,
  Высокий: 1,
  Средний: 2,
  Низкий: 3
};

export const priorityColor: Record<Priority, string> = {
  Низкий: 'priority-low',
  Средний: 'priority-mid',
  Высокий: 'priority-high',
  Критический: 'priority-critical'
};

export const sortTasks = (tasks: Task[], statuses: Status[]) => {
  const statusOrder = new Map(statuses.map((s) => [s.id, s.order]));
  return [...tasks].sort((a, b) => {
    const p = priorityRank[a.priority] - priorityRank[b.priority];
    if (p !== 0) return p;

    const overdueDelta = Number(isOverdue(b.deadline)) - Number(isOverdue(a.deadline));
    if (overdueDelta !== 0) return overdueDelta;

    const dateDelta = a.deadline.localeCompare(b.deadline);
    if (dateDelta !== 0) return dateDelta;

    return (statusOrder.get(a.statusId) ?? 999) - (statusOrder.get(b.statusId) ?? 999);
  });
};
