import { dateTag, normalizeDate } from './date';
import type { Assignee, BoardData, Department, Priority, Status, Task } from '../types';

const STORAGE_KEY = 'oper-board-data';

const seedDepartments = (): Department[] => [
  { id: crypto.randomUUID(), name: 'Операционный блок', color: '#4f46e5', order: 0, archived: false },
  { id: crypto.randomUUID(), name: 'Склад / Производство', color: '#0f766e', order: 1, archived: false },
  { id: crypto.randomUUID(), name: 'Маркетинг', color: '#0284c7', order: 2, archived: false },
  { id: crypto.randomUUID(), name: 'Контент', color: '#7c3aed', order: 3, archived: false },
  { id: crypto.randomUUID(), name: 'CRM / Автоматизация', color: '#ea580c', order: 4, archived: false }
];

const seedAssignees = (): Assignee[] => [
  { id: crypto.randomUUID(), name: 'Иван Петров', initials: 'ИП', color: '#2563eb', order: 0, archived: false },
  { id: crypto.randomUUID(), name: 'Анна Смирнова', initials: 'АС', color: '#db2777', order: 1, archived: false },
  { id: crypto.randomUUID(), name: 'Денис Волков', initials: 'ДВ', color: '#0d9488', order: 2, archived: false },
  { id: crypto.randomUUID(), name: 'Мария Орлова', initials: 'МО', color: '#7c3aed', order: 3, archived: false }
];

const seedStatuses = (): Status[] => [
  { id: crypto.randomUUID(), name: 'Бэклог', order: 0, archived: false },
  { id: crypto.randomUUID(), name: 'Запланировано', order: 1, archived: false },
  { id: crypto.randomUUID(), name: 'В работе', order: 2, archived: false },
  { id: crypto.randomUUID(), name: 'На проверке', order: 3, archived: false },
  { id: crypto.randomUUID(), name: 'Готово', order: 4, archived: false }
];

const seedTasks = (departments: Department[], assignees: Assignee[], statuses: Status[]): Task[] => {
  const status = (name: string) => statuses.find((s) => s.name === name)?.id ?? statuses[0].id;
  return [
    {
      id: crypto.randomUUID(),
      title: 'Запуск AmoCRM',
      description: 'Согласовать этапы внедрения, доступы и план миграции базы.',
      departmentId: departments[4].id,
      assigneeId: assignees[0].id,
      priority: 'Критический',
      statusId: status('В работе'),
      startDate: dateTag('today'),
      deadline: dateTag('plus3'),
      color: '#ea580c',
      urgent: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: 'Регламент по складу',
      description: 'Зафиксировать SLA комплектации и чек-лист ночной смены.',
      departmentId: departments[1].id,
      assigneeId: assignees[2].id,
      priority: 'Высокий',
      statusId: status('Запланировано'),
      startDate: dateTag('today'),
      deadline: dateTag('week'),
      color: '#0f766e',
      urgent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: 'Проверка контент-плана',
      description: 'Проверить темы недели и расставить приоритет публикаций.',
      departmentId: departments[3].id,
      assigneeId: assignees[3].id,
      priority: 'Средний',
      statusId: status('На проверке'),
      startDate: dateTag('tomorrow'),
      deadline: dateTag('week'),
      color: '#7c3aed',
      urgent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: 'Созвон по производству',
      description: 'Разобрать отклонения по выпуску и риск по комплектующим.',
      departmentId: departments[1].id,
      assigneeId: assignees[2].id,
      priority: 'Высокий',
      statusId: status('В работе'),
      startDate: dateTag('today'),
      deadline: dateTag('tomorrow'),
      color: '#0ea5e9',
      urgent: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      title: 'Таблица KPI по отделам',
      description: 'Обновить факт/план и выделить отклонения за неделю.',
      departmentId: departments[0].id,
      assigneeId: assignees[1].id,
      priority: 'Средний',
      statusId: status('Запланировано'),
      startDate: dateTag('today'),
      deadline: dateTag('plus3'),
      color: '#4f46e5',
      urgent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
};

const createDefaultData = (): BoardData => {
  const departments = seedDepartments();
  const assignees = seedAssignees();
  const statuses = seedStatuses();
  return { departments, assignees, statuses, tasks: seedTasks(departments, assignees, statuses) };
};

const normalizePriority = (value: unknown): Priority => {
  if (value === 'Низкий' || value === 'Средний' || value === 'Высокий' || value === 'Критический') return value;
  return 'Средний';
};

const migrate = (raw: Partial<BoardData>): BoardData => {
  const departments = (raw.departments ?? []).map((d, index) => ({
    id: d.id ?? crypto.randomUUID(),
    name: d.name ?? `Отдел ${index + 1}`,
    color: d.color ?? '#64748b',
    order: Number.isFinite(d.order) ? d.order : index,
    archived: Boolean(d.archived)
  }));
  const assignees = (raw.assignees ?? []).map((a, index) => ({
    id: a.id ?? crypto.randomUUID(),
    name: a.name ?? `Исполнитель ${index + 1}`,
    initials: a.initials ?? (a.name || '??').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(),
    color: a.color ?? '#64748b',
    order: Number.isFinite(a.order) ? a.order : index,
    archived: Boolean(a.archived)
  }));
  const statuses = (raw.statuses ?? []).map((s, index) => ({
    id: s.id ?? crypto.randomUUID(),
    name: s.name ?? `Статус ${index + 1}`,
    order: Number.isFinite(s.order) ? s.order : index,
    archived: Boolean(s.archived)
  }));

  const depMap = new Map(departments.map((d) => [d.id, d.id]));
  const assigneeMap = new Map(assignees.map((a) => [a.id, a.id]));
  const statusMap = new Map(statuses.map((s) => [s.id, s.id]));

  const tasks = (raw.tasks ?? []).map((t) => ({
    id: t.id ?? crypto.randomUUID(),
    title: t.title ?? 'Без названия',
    description: t.description ?? '',
    departmentId: depMap.has(t.departmentId) ? t.departmentId : departments[0]?.id ?? '',
    assigneeId: assigneeMap.has(t.assigneeId) ? t.assigneeId : assignees[0]?.id ?? '',
    priority: normalizePriority(t.priority),
    statusId: statusMap.has(t.statusId) ? t.statusId : statuses[0]?.id ?? '',
    startDate: normalizeDate(t.startDate) || dateTag('today'),
    deadline: normalizeDate(t.deadline) || dateTag('today'),
    color: t.color ?? '#cbd5e1',
    urgent: Boolean(t.urgent),
    completedAt: t.completedAt,
    createdAt: t.createdAt ?? new Date().toISOString(),
    updatedAt: t.updatedAt ?? new Date().toISOString()
  }));

  if (!departments.length || !assignees.length || !statuses.length) return createDefaultData();
  return { departments, assignees, statuses, tasks };
};

const browserStorage = {
  async readData(): Promise<BoardData> {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<BoardData>;
      const migrated = migrate(parsed);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      const initial = createDefaultData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
  },
  async writeData(payload: BoardData) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  },
  async dataPath() {
    return 'localStorage → ключ oper-board-data';
  }
};

export const storageApi = window.operBoardApi ?? browserStorage;
