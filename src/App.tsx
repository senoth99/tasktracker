import { useEffect, useMemo, useState } from 'react';
import type { BoardData, Priority, Status, Task, ViewMode } from './types';
import { dateTag, formatDate, isOverdue, normalizeDate, toISODate } from './lib/date';
import { priorityColor, sortTasks } from './lib/task';
import { storageApi } from './lib/storage';

const priorities: Priority[] = ['Низкий', 'Средний', 'Высокий', 'Критический'];
const views: { id: ViewMode; label: string; subtitle: string; icon: string }[] = [
  { id: 'dashboard', label: 'Overview', subtitle: 'Сигналы и фокус дня', icon: '◌' },
  { id: 'kanban', label: 'Flow', subtitle: 'Поток задач по статусам', icon: '◫' },
  { id: 'list', label: 'Library', subtitle: 'Плотный список задач', icon: '≡' },
  { id: 'departments', label: 'Teams', subtitle: 'Структура отделов', icon: '⌁' },
  { id: 'assignees', label: 'People', subtitle: 'Исполнители и нагрузка', icon: '◎' },
  { id: 'statuses', label: 'Stages', subtitle: 'Конфигурация потока', icon: '⋮' }
];

const emptyTask = (data: BoardData | null): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  description: '',
  departmentId: data?.departments.find((d) => !d.archived)?.id ?? '',
  assigneeId: data?.assignees.find((a) => !a.archived)?.id ?? '',
  priority: 'Средний',
  statusId: data?.statuses.find((s) => !s.archived)?.id ?? '',
  startDate: toISODate(new Date()),
  deadline: toISODate(new Date()),
  color: '#6366f1',
  urgent: false
});

function App() {
  const [data, setData] = useState<BoardData | null>(null);
  const [view, setView] = useState<ViewMode>('dashboard');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>(emptyTask(null));
  const [dataPath, setDataPath] = useState('');
  const [filter, setFilter] = useState({ status: '', dep: '', assignee: '', priority: '', overdue: '', urgent: '' });

  useEffect(() => {
    Promise.all([storageApi.readData(), storageApi.dataPath()]).then(([loaded, path]) => {
      setData(loaded);
      setDataPath(path);
      setDraft(emptyTask(loaded));
    });
  }, []);

  useEffect(() => {
    if (!data) return;
    void storageApi.writeData(data);
  }, [data]);

  if (!data) return <div className="loading-state">Loading workspace…</div>;

  const activeStatuses = data.statuses.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const doneStatusIds = activeStatuses.filter((s) => /готов|done/i.test(s.name)).map((s) => s.id);
  const selectedTask = selectedTaskId ? data.tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  const filteredTasks = sortTasks(data.tasks, activeStatuses).filter((task) => {
    if (!showArchived && doneStatusIds.includes(task.statusId)) return false;
    if (query && !`${task.title} ${task.description}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter.status && task.statusId !== filter.status) return false;
    if (filter.dep && task.departmentId !== filter.dep) return false;
    if (filter.assignee && task.assigneeId !== filter.assignee) return false;
    if (filter.priority && task.priority !== filter.priority) return false;
    if (filter.urgent === 'yes' && !task.urgent) return false;
    if (filter.urgent === 'no' && task.urgent) return false;
    if (filter.overdue === 'yes' && !isOverdue(task.deadline)) return false;
    if (filter.overdue === 'no' && isOverdue(task.deadline)) return false;
    return true;
  });

  const stats = useMemo(
    () => ({
      active: data.tasks.filter((t) => !doneStatusIds.includes(t.statusId)).length,
      overdue: data.tasks.filter((t) => isOverdue(t.deadline) && !doneStatusIds.includes(t.statusId)).length,
      urgent: data.tasks.filter((t) => t.urgent && !doneStatusIds.includes(t.statusId)).length,
      review: data.tasks.filter((t) => /провер/i.test(data.statuses.find((s) => s.id === t.statusId)?.name ?? '')).length
    }),
    [data.tasks, data.statuses, doneStatusIds]
  );

  const openCreate = () => {
    setSelectedTaskId(null);
    setDraft(emptyTask(data));
    setTaskPanelOpen(true);
  };

  const openEdit = (task: Task) => {
    setSelectedTaskId(task.id);
    setDraft({ ...task });
    setTaskPanelOpen(true);
  };

  const saveTask = () => {
    if (!draft.title.trim()) return;
    const normalized = { ...draft, startDate: normalizeDate(draft.startDate), deadline: normalizeDate(draft.deadline) };
    if (!normalized.startDate || !normalized.deadline) return;
    const now = new Date().toISOString();

    setData((prev) => {
      if (!prev) return prev;
      const task: Task = {
        ...normalized,
        id: selectedTask?.id ?? crypto.randomUUID(),
        completedAt: doneStatusIds.includes(normalized.statusId) ? now : undefined,
        createdAt: selectedTask?.createdAt ?? now,
        updatedAt: now
      };
      const tasks = selectedTask ? prev.tasks.map((t) => (t.id === selectedTask.id ? task : t)) : [task, ...prev.tasks];
      return { ...prev, tasks };
    });

    setTaskPanelOpen(false);
    setSelectedTaskId(null);
  };

  const deleteTask = () => {
    if (!selectedTask) return;
    if (!confirm('Удалить задачу?')) return;
    setData((prev) => (prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== selectedTask.id) } : prev));
    setTaskPanelOpen(false);
    setSelectedTaskId(null);
  };

  const moveStatus = (id: string, dir: -1 | 1) => {
    setData((prev) => {
      if (!prev) return prev;
      const sorted = [...prev.statuses].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((s) => s.id === id);
      const next = index + dir;
      if (index < 0 || next < 0 || next >= sorted.length) return prev;
      [sorted[index], sorted[next]] = [sorted[next], sorted[index]];
      const statuses = sorted.map((status, order) => ({ ...status, order }));
      return { ...prev, statuses };
    });
  };

  const updateEntity = (
    kind: 'departments' | 'assignees' | 'statuses',
    id: string,
    patch: Partial<{ name: string; color: string; initials: string; archived: boolean }>
  ) => {
    setData((prev) => {
      if (!prev) return prev;
      const bucket = prev[kind].map((item) => (item.id === id ? { ...item, ...patch } : item));
      return { ...prev, [kind]: bucket };
    });
  };

  return (
    <div className="liquid-app-shell">
      <div className="liquid-bg" aria-hidden />

      <aside className="side-rail glass-panel">
        <div className="brand-block">
          <div className="brand-mark">TT</div>
          <div>
            <h1>Tasktracker</h1>
            <p>Product planning space</p>
          </div>
        </div>

        <nav className="nav-stack">
          {views.map((item) => (
            <button key={item.id} className={`nav-item ${view === item.id ? 'is-active' : ''}`} onClick={() => setView(item.id)}>
              <span>{item.icon}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.subtitle}</small>
              </div>
            </button>
          ))}
        </nav>

        <div className="sidebar-footnote">
          <span>Data source</span>
          <code>{dataPath}</code>
        </div>
      </aside>

      <main className="workspace">
        <header className="top-header glass-panel">
          <div>
            <p className="header-kicker">{views.find((v) => v.id === view)?.subtitle}</p>
            <h2>{views.find((v) => v.id === view)?.label}</h2>
          </div>
          <div className="header-actions">
            <label className="search-box">
              <span>⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти задачу" />
            </label>
            <label className="toggle-pill">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              <span>Показывать завершенные</span>
            </label>
            <button className="btn-primary" onClick={openCreate}>+ New Task</button>
          </div>
        </header>

        {(view === 'dashboard' || view === 'kanban' || view === 'list') && (
          <section className="filter-ribbon glass-panel">
            <Select label="Статус" value={filter.status} onChange={(v) => setFilter({ ...filter, status: v })} options={activeStatuses.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Отдел" value={filter.dep} onChange={(v) => setFilter({ ...filter, dep: v })} options={data.departments.filter((d) => !d.archived).map((d) => ({ value: d.id, label: d.name }))} />
            <Select label="Исполнитель" value={filter.assignee} onChange={(v) => setFilter({ ...filter, assignee: v })} options={data.assignees.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))} />
            <Select label="Приоритет" value={filter.priority} onChange={(v) => setFilter({ ...filter, priority: v })} options={priorities.map((p) => ({ value: p, label: p }))} />
            <Select label="Просрочка" value={filter.overdue} onChange={(v) => setFilter({ ...filter, overdue: v })} options={[{ value: 'yes', label: 'Только просроченные' }, { value: 'no', label: 'Без просрочки' }]} />
            <Select label="Срочно" value={filter.urgent} onChange={(v) => setFilter({ ...filter, urgent: v })} options={[{ value: 'yes', label: 'Только срочные' }, { value: 'no', label: 'Без срочных' }]} />
          </section>
        )}

        {view === 'dashboard' && (
          <section className="overview-layout">
            <div className="metric-row">
              <MetricCard label="Active" value={stats.active} tone="neutral" />
              <MetricCard label="Overdue" value={stats.overdue} tone="danger" />
              <MetricCard label="Urgent" value={stats.urgent} tone="warning" />
              <MetricCard label="Review" value={stats.review} tone="info" />
            </div>

            <div className="overview-main">
              <ListBlock title="Ближайшие дедлайны" tasks={[...filteredTasks].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 8)} data={data} onOpen={openEdit} />
              <ListBlock title="Critical lane" tasks={filteredTasks.filter((t) => t.urgent || isOverdue(t.deadline)).slice(0, 8)} data={data} onOpen={openEdit} />
              <section className="glass-panel team-density">
                <h3>Нагрузка по отделам</h3>
                <div className="density-list">
                  {data.departments.filter((d) => !d.archived).map((dep) => {
                    const value = data.tasks.filter((t) => t.departmentId === dep.id && !doneStatusIds.includes(t.statusId)).length;
                    return (
                      <div key={dep.id} className="density-row">
                        <div>
                          <strong>{dep.name}</strong>
                          <small>{value === 0 ? 'Свободно' : 'В работе'}</small>
                        </div>
                        <span>{value}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </section>
        )}

        {view === 'kanban' && (
          <section className="flow-board">
            {activeStatuses.map((status) => {
              const tasks = filteredTasks.filter((t) => t.statusId === status.id);
              return (
                <article
                  key={status.id}
                  className="flow-column glass-panel"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const taskId = e.dataTransfer.getData('text/plain');
                    setData((prev) =>
                      prev
                        ? {
                            ...prev,
                            tasks: prev.tasks.map((t) =>
                              t.id === taskId ? { ...t, statusId: status.id, updatedAt: new Date().toISOString() } : t
                            )
                          }
                        : prev
                    );
                  }}
                >
                  <header>
                    <h3>{status.name}</h3>
                    <span>{tasks.length}</span>
                  </header>

                  <div className="flow-stack">
                    {tasks.length === 0 && <div className="empty-state">Пусто</div>}
                    {tasks.map((task) => (
                      <TaskCard key={task.id} task={task} data={data} onOpen={() => openEdit(task)} drag />
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {view === 'list' && (
          <section className="list-surface glass-panel">
            <div className="list-head">
              <span>Задача</span>
              <span>Отдел</span>
              <span>Исполнитель</span>
              <span>Приоритет</span>
              <span>Статус</span>
              <span>Дедлайн</span>
              <span>Флаг</span>
            </div>

            {filteredTasks.map((task) => (
              <button key={task.id} className="list-line" onClick={() => openEdit(task)}>
                <strong>{task.title}</strong>
                <span>{data.departments.find((d) => d.id === task.departmentId)?.name ?? '—'}</span>
                <span>{data.assignees.find((a) => a.id === task.assigneeId)?.name ?? '—'}</span>
                <span className={`pill ${priorityColor[task.priority]}`}>{task.priority}</span>
                <span>{data.statuses.find((s) => s.id === task.statusId)?.name ?? '—'}</span>
                <span className={isOverdue(task.deadline) ? 'danger' : ''}>{formatDate(task.deadline)}</span>
                <span>{task.urgent ? 'Urgent' : '—'}</span>
              </button>
            ))}
          </section>
        )}

        {view === 'departments' && <EntityView title="Отделы" kind="departments" data={data} setData={setData} updateEntity={updateEntity} />}
        {view === 'assignees' && <EntityView title="Исполнители" kind="assignees" data={data} setData={setData} updateEntity={updateEntity} />}
        {view === 'statuses' && <EntityView title="Статусы" kind="statuses" data={data} setData={setData} updateEntity={updateEntity} moveStatus={moveStatus} />}
      </main>

      {taskPanelOpen && (
        <aside className="task-detail glass-panel">
          <header>
            <div>
              <p>Task editor</p>
              <h3>{selectedTask ? 'Редактирование' : 'Создание задачи'}</h3>
            </div>
            <button className="btn-ghost" onClick={() => setTaskPanelOpen(false)}>✕</button>
          </header>

          <label className="field-block">
            <span>Название</span>
            <input className="field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>

          <label className="field-block">
            <span>Описание</span>
            <textarea className="field" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>

          <div className="form-grid">
            <Select label="Отдел" value={draft.departmentId} onChange={(v) => setDraft({ ...draft, departmentId: v })} options={data.departments.filter((d) => !d.archived).map((d) => ({ value: d.id, label: d.name }))} />
            <Select label="Исполнитель" value={draft.assigneeId} onChange={(v) => setDraft({ ...draft, assigneeId: v })} options={data.assignees.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))} />
            <Select label="Статус" value={draft.statusId} onChange={(v) => setDraft({ ...draft, statusId: v })} options={activeStatuses.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Приоритет" value={draft.priority} onChange={(v) => setDraft({ ...draft, priority: v as Priority })} options={priorities.map((p) => ({ value: p, label: p }))} />
            <label className="field-block">
              <span>Дата старта</span>
              <input type="date" className="field" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: normalizeDate(e.target.value) })} />
              <small>{formatDate(draft.startDate)}</small>
            </label>
            <label className="field-block">
              <span>Дедлайн</span>
              <input type="date" className="field" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: normalizeDate(e.target.value) })} />
              <small className={isOverdue(draft.deadline) ? 'danger' : ''}>{formatDate(draft.deadline)}</small>
            </label>
          </div>

          <div className="quick-toolbar">
            <button className="btn-ghost" onClick={() => setDraft({ ...draft, deadline: dateTag('today') })}>Сегодня</button>
            <button className="btn-ghost" onClick={() => setDraft({ ...draft, deadline: dateTag('tomorrow') })}>Завтра</button>
            <button className="btn-ghost" onClick={() => setDraft({ ...draft, deadline: dateTag('plus3') })}>+3 дня</button>
            <button className="btn-ghost" onClick={() => setDraft({ ...draft, deadline: dateTag('week') })}>Конец недели</button>
          </div>

          <div className="meta-strip">
            <label className="toggle-pill">
              <input type="checkbox" checked={draft.urgent} onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })} />
              <span>Срочная задача</span>
            </label>
            <label className="field-block compact">
              <span>Акцент карточки</span>
              <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
            </label>
          </div>

          <footer>
            {selectedTask && <button className="btn-danger" onClick={deleteTask}>Удалить</button>}
            <button className="btn-primary" onClick={saveTask}>Сохранить</button>
          </footer>
        </aside>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'danger' | 'warning' | 'info' }) {
  return (
    <article className={`metric-tile ${tone} glass-panel`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ListBlock({ title, tasks, data, onOpen }: { title: string; tasks: Task[]; data: BoardData; onOpen: (task: Task) => void }) {
  return (
    <section className="glass-panel list-block">
      <header>
        <h3>{title}</h3>
      </header>

      <div className="list-block-items">
        {tasks.length === 0 ? (
          <div className="empty-state">Нет задач</div>
        ) : (
          tasks.map((task) => (
            <button key={task.id} className="mini-line" onClick={() => onOpen(task)}>
              <div>
                <strong>{task.title}</strong>
                <small>{data.assignees.find((a) => a.id === task.assigneeId)?.name ?? '—'}</small>
              </div>
              <span className={isOverdue(task.deadline) ? 'danger' : ''}>{formatDate(task.deadline)}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function TaskCard({ task, data, onOpen, drag }: { task: Task; data: BoardData; onOpen: () => void; drag?: boolean }) {
  const dep = data.departments.find((d) => d.id === task.departmentId);
  const assignee = data.assignees.find((a) => a.id === task.assigneeId);

  return (
    <article
      draggable={drag}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
      onClick={onOpen}
      className="task-card glass-panel"
      style={{ borderColor: `${task.color}88` }}
    >
      <div className="task-card-head">
        <h4>{task.title}</h4>
        <span className={`pill ${priorityColor[task.priority]}`}>{task.priority}</span>
      </div>
      {task.description && <p>{task.description}</p>}

      <div className="task-card-meta">
        <span>{dep?.name ?? '—'}</span>
        <span>{assignee?.name ?? assignee?.initials ?? '—'}</span>
        <span className={isOverdue(task.deadline) ? 'danger' : ''}>{formatDate(task.deadline)}</span>
      </div>
      {task.urgent && <div className="urgent-tag">Urgent</div>}
    </article>
  );
}

function EntityView({ title, kind, data, setData, updateEntity, moveStatus }: { title: string; kind: 'departments' | 'assignees' | 'statuses'; data: BoardData; setData: any; updateEntity: any; moveStatus?: (id: string, dir: -1 | 1) => void }) {
  const items = [...data[kind]].sort((a, b) => a.order - b.order);
  const taskCount = (id: string) => data.tasks.filter((t) => (kind === 'departments' ? t.departmentId : kind === 'assignees' ? t.assigneeId : t.statusId) === id).length;

  const addEntity = () => {
    const item =
      kind === 'departments'
        ? { id: crypto.randomUUID(), name: 'Новый отдел', color: '#64748b', order: items.length, archived: false }
        : kind === 'assignees'
          ? { id: crypto.randomUUID(), name: 'Новый исполнитель', initials: 'НИ', color: '#64748b', order: items.length, archived: false }
          : { id: crypto.randomUUID(), name: 'Новый статус', order: items.length, archived: false };
    setData((prev: BoardData | null) => (prev ? { ...prev, [kind]: [...prev[kind], item as any] } : prev));
  };

  return (
    <section className="entity-surface glass-panel">
      <header>
        <h3>{title}</h3>
        <button className="btn-primary" onClick={addEntity}>Добавить</button>
      </header>

      <div className="entity-grid">
        {items.map((item, index) => (
          <article key={item.id} className="entity-line">
            {'color' in item && <input type="color" value={item.color} onChange={(e) => updateEntity(kind, item.id, { color: e.target.value })} />}
            <input className="field" value={item.name} onChange={(e) => updateEntity(kind, item.id, { name: e.target.value })} />
            {'initials' in item && <input className="field initials" value={item.initials} onChange={(e) => updateEntity(kind, item.id, { initials: e.target.value.slice(0, 3).toUpperCase() })} />}
            <span className="counter">{taskCount(item.id)}</span>
            <button className="btn-ghost" onClick={() => updateEntity(kind, item.id, { archived: !item.archived })}>{item.archived ? 'Показать' : 'Скрыть'}</button>
            {kind === 'statuses' && (
              <>
                <button className="btn-ghost" onClick={() => moveStatus?.(item.id, -1)} disabled={index === 0}>↑</button>
                <button className="btn-ghost" onClick={() => moveStatus?.(item.id, 1)} disabled={index === items.length - 1}>↓</button>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="field-block compact">
      <span>{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Все</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default App;
