export type Priority = 'Низкий' | 'Средний' | 'Высокий' | 'Критический';

export type Department = {
  id: string;
  name: string;
  color: string;
  order: number;
  archived: boolean;
};

export type Assignee = {
  id: string;
  name: string;
  initials: string;
  color: string;
  order: number;
  archived: boolean;
};

export type Status = {
  id: string;
  name: string;
  order: number;
  archived: boolean;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  departmentId: string;
  assigneeId: string;
  priority: Priority;
  statusId: string;
  startDate: string;
  deadline: string;
  color: string;
  urgent: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type BoardData = {
  departments: Department[];
  assignees: Assignee[];
  statuses: Status[];
  tasks: Task[];
};

export type ViewMode = 'kanban' | 'list' | 'settings';
