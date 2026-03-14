import { useEffect, useState } from 'react';
import type { Assignee, BoardData, Department, Priority, Status, Task, ViewMode } from './types';
import { dateTag, formatDate, isOverdue, normalizeDate, toISODate } from './lib/date';
import { priorityColor, sortTasks } from './lib/task';
import { storageApi } from './lib/storage';

const priorities: Priority[] = ['Низкий', 'Средний', 'Высокий', 'Критический'];
const views: { id: ViewMode; label: string; desc: string; icon: string }[] = [
  { id: 'dashboard', label: 'Дашборд', desc: 'Ключевые сигналы по задачам', icon: '◈' },
  { id: 'kanban', label: 'Канбан', desc: 'Основной рабочий экран', icon: '▦' },
  { id: 'list', label: 'Список', desc: 'Плотный список и быстрый отбор', icon: '☰' },
  { id: 'departments', label: 'Отделы', desc: 'Структура команды', icon: '⌂' },
  { id: 'assignees', label: 'Исполнители', desc: 'Люди и загрузка', icon: '◉' },
  { id: 'statuses', label: 'Статусы', desc: 'Поток и порядок этапов', icon: '↹' }
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

  if (!data) return <div className="loading-state">Загрузка операционной доски…</div>;

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

  const stats = {
    active: data.tasks.filter((t) => !doneStatusIds.includes(t.statusId)).length,
    overdue: data.tasks.filter((t) => isOverdue(t.deadline) && !doneStatusIds.includes(t.statusId)).length,
    urgent: data.tasks.filter((t) => t.urgent && !doneStatusIds.includes(t.statusId)).length,
    review: data.tasks.filter((t) => /провер/i.test(data.statuses.find((s) => s.id === t.statusId)?.name ?? '')).length
  };

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
      const target = index + dir;
      if (index < 0 || target < 0 || target >= sorted.length) return prev;
      [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
      return { ...prev, statuses: sorted.map((s, i) => ({ ...s, order: i })) };
    });
  };

  const updateEntity = <T extends Department | Assignee | Status>(key: 'departments' | 'assignees' | 'statuses', id: string, patch: Partial<T>) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: (prev[key] as T[]).map((entity) => (entity.id === id ? { ...entity, ...patch } : entity)) };
    });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar glass">
        <div className="brand">
          <div className="brand-logo">◎</div>
          <div>
            <h1>Операционная доска</h1>
            <p>Executive local-first tracker</p>
          </div>
        </div>
        <nav>
          {views.map((item) => {
            const count = item.id === 'kanban' || item.id === 'list' ? stats.active : item.id === 'dashboard' ? stats.overdue : undefined;
            return (
              <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
                <span className="icon">{item.icon}</span>
                <span className="label-wrap"><span>{item.label}</span><small>{item.desc}</small></span>
                {count !== undefined && <span className="counter">{count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-meta">Хранилище: {dataPath}</div>
      </aside>

      <main className="workspace">
        <header className="page-header glass">
          <div>
            <h2>{views.find((v) => v.id === view)?.label}</h2>
            <p>{views.find((v) => v.id === view)?.desc}</p>
          </div>
          <div className="header-actions">
            <input className="field" placeholder="Поиск по задачам" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Скрыть готово' : 'Показать готово'}</button>
            <button className="btn primary" onClick={openCreate}>Новая задача</button>
          </div>
        </header>

        {(view === 'kanban' || view === 'list' || view === 'dashboard') && (
          <section className="filters glass">
            <Select label="Статус" value={filter.status} onChange={(v) => setFilter({ ...filter, status: v })} options={activeStatuses.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Отдел" value={filter.dep} onChange={(v) => setFilter({ ...filter, dep: v })} options={data.departments.filter((d) => !d.archived).map((d) => ({ value: d.id, label: d.name }))} />
            <Select label="Исполнитель" value={filter.assignee} onChange={(v) => setFilter({ ...filter, assignee: v })} options={data.assignees.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))} />
            <Select label="Приоритет" value={filter.priority} onChange={(v) => setFilter({ ...filter, priority: v })} options={priorities.map((p) => ({ value: p, label: p }))} />
            <Select label="Просрочка" value={filter.overdue} onChange={(v) => setFilter({ ...filter, overdue: v })} options={[{ value: 'yes', label: 'Только просроченные' }, { value: 'no', label: 'Без просрочки' }]} />
            <Select label="Срочно" value={filter.urgent} onChange={(v) => setFilter({ ...filter, urgent: v })} options={[{ value: 'yes', label: 'Только срочные' }, { value: 'no', label: 'Без срочных' }]} />
          </section>
        )}

        {view === 'dashboard' && (
          <section className="dashboard-grid">
            <MetricCard label="Активные задачи" value={stats.active} tone="neutral" />
            <MetricCard label="Просроченные" value={stats.overdue} tone="danger" />
            <MetricCard label="Критические / срочные" value={stats.urgent} tone="warning" />
            <MetricCard label="На проверке" value={stats.review} tone="info" />

            <ListBlock title="Ближайшие дедлайны" tasks={[...filteredTasks].sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 6)} data={data} onOpen={openEdit} />
            <ListBlock title="Горящие задачи" tasks={filteredTasks.filter((t) => t.urgent || isOverdue(t.deadline)).slice(0, 6)} data={data} onOpen={openEdit} />
            <div className="panel glass">
              <h3>Нагрузка по отделам</h3>
              <div className="stack">
                {data.departments.filter((d) => !d.archived).map((dep) => (
                  <div key={dep.id} className="stat-row">
                    <span>{dep.name}</span>
                    <strong>{data.tasks.filter((t) => t.departmentId === dep.id && !doneStatusIds.includes(t.statusId)).length}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {view === 'kanban' && (
          <section className="kanban-grid">
            {activeStatuses.map((status) => {
              const tasks = filteredTasks.filter((t) => t.statusId === status.id);
              return (
                <article key={status.id} className="kanban-column glass" onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                  const taskId = e.dataTransfer.getData('text/plain');
                  setData((prev) => prev ? { ...prev, tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, statusId: status.id, updatedAt: new Date().toISOString() } : t) } : prev);
                }}>
                  <header><h3>{status.name}</h3><span>{tasks.length}</span></header>
                  <div className="task-stack">
                    {tasks.length === 0 && <div className="empty-col">Пока пусто</div>}
                    {tasks.map((task) => <TaskCard key={task.id} task={task} data={data} onOpen={() => openEdit(task)} drag />)}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {view === 'list' && (
          <section className="panel glass list-view">
            <div className="list-head"><span>Название</span><span>Отдел</span><span>Исполнитель</span><span>Приоритет</span><span>Статус</span><span>Дедлайн</span><span>Срочно</span></div>
            {filteredTasks.map((task) => (
              <button key={task.id} className="list-row" onClick={() => openEdit(task)}>
                <strong>{task.title}</strong>
                <span>{data.departments.find((d) => d.id === task.departmentId)?.name}</span>
                <span>{data.assignees.find((a) => a.id === task.assigneeId)?.name}</span>
                <span className={`pill ${priorityColor[task.priority]}`}>{task.priority}</span>
                <span>{data.statuses.find((s) => s.id === task.statusId)?.name}</span>
                <span className={isOverdue(task.deadline) ? 'danger' : ''}>{formatDate(task.deadline)}</span>
                <span>{task.urgent ? 'Да' : '—'}</span>
              </button>
            ))}
          </section>
        )}

        {view === 'departments' && <EntityView title="Отделы" kind="departments" data={data} setData={setData} updateEntity={updateEntity} />}
        {view === 'assignees' && <EntityView title="Исполнители" kind="assignees" data={data} setData={setData} updateEntity={updateEntity} />}
        {view === 'statuses' && <EntityView title="Статусы" kind="statuses" data={data} setData={setData} updateEntity={updateEntity} moveStatus={moveStatus} />}
      </main>

      {taskPanelOpen && (
        <aside className="detail-panel glass">
          <header>
            <h3>{selectedTask ? 'Редактирование задачи' : 'Новая задача'}</h3>
            <button className="btn" onClick={() => setTaskPanelOpen(false)}>Закрыть</button>
          </header>
          <label>Название<input className="field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label>Описание<textarea className="field" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
          <div className="grid2">
            <Select label="Отдел" value={draft.departmentId} onChange={(v) => setDraft({ ...draft, departmentId: v })} options={data.departments.filter((d) => !d.archived).map((d) => ({ value: d.id, label: d.name }))} />
            <Select label="Исполнитель" value={draft.assigneeId} onChange={(v) => setDraft({ ...draft, assigneeId: v })} options={data.assignees.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))} />
            <Select label="Статус" value={draft.statusId} onChange={(v) => setDraft({ ...draft, statusId: v })} options={activeStatuses.map((s) => ({ value: s.id, label: s.name }))} />
            <Select label="Приоритет" value={draft.priority} onChange={(v) => setDraft({ ...draft, priority: v as Priority })} options={priorities.map((p) => ({ value: p, label: p }))} />
            <label>Дата старта<input type="date" className="field" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: normalizeDate(e.target.value) })} /><small>{formatDate(draft.startDate)}</small></label>
            <label>Дедлайн<input type="date" className="field" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: normalizeDate(e.target.value) })} /><small className={isOverdue(draft.deadline) ? 'danger' : ''}>{formatDate(draft.deadline)}</small></label>
          </div>
          <div className="quick-dates">
            <button className="btn" onClick={() => setDraft({ ...draft, deadline: dateTag('today') })}>Сегодня</button>
            <button className="btn" onClick={() => setDraft({ ...draft, deadline: dateTag('tomorrow') })}>Завтра</button>
            <button className="btn" onClick={() => setDraft({ ...draft, deadline: dateTag('plus3') })}>+3 дня</button>
            <button className="btn" onClick={() => setDraft({ ...draft, deadline: dateTag('week') })}>Конец недели</button>
          </div>
          <div className="meta-row">
            <label className="checkbox"><input type="checkbox" checked={draft.urgent} onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })} />Срочно</label>
            <label>Цвет<input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></label>
          </div>
          <footer>
            {selectedTask && <button className="btn danger" onClick={deleteTask}>Удалить</button>}
            <button className="btn primary" onClick={saveTask}>Сохранить</button>
          </footer>
        </aside>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'danger' | 'warning' | 'info' }) {
  return <div className={`metric-card ${tone} glass`}><span>{label}</span><strong>{value}</strong></div>;
}

function ListBlock({ title, tasks, data, onOpen }: { title: string; tasks: Task[]; data: BoardData; onOpen: (task: Task) => void }) {
  return <div className="panel glass"><h3>{title}</h3><div className="stack">{tasks.length === 0 ? <div className="empty">Нет задач</div> : tasks.map((task) => <button key={task.id} className="mini-task" onClick={() => onOpen(task)}><b>{task.title}</b><span>{data.assignees.find((a) => a.id === task.assigneeId)?.name}</span><span className={isOverdue(task.deadline) ? 'danger' : ''}>{formatDate(task.deadline)}</span></button>)}</div></div>;
}

function TaskCard({ task, data, onOpen, drag }: { task: Task; data: BoardData; onOpen: () => void; drag?: boolean }) {
  const dep = data.departments.find((d) => d.id === task.departmentId);
  const assignee = data.assignees.find((a) => a.id === task.assigneeId);
  return (
    <article draggable={drag} onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)} onClick={onOpen} className="task-card" style={{ borderColor: `${task.color}66` }}>
      <div className="task-head"><h4>{task.title}</h4><span className={`pill ${priorityColor[task.priority]}`}>{task.priority}</span></div>
      {task.description && <p>{task.description}</p>}
      <div className="task-meta">
        <span>{dep?.name}</span><span>{assignee?.initials}</span><span className={isOverdue(task.deadline) ? 'danger' : ''}>{formatDate(task.deadline)}</span>
        {task.urgent && <span className="pill urgent">Срочно</span>}
      </div>
    </article>
  );
}

function EntityView({ title, kind, data, setData, updateEntity, moveStatus }: { title: string; kind: 'departments' | 'assignees' | 'statuses'; data: BoardData; setData: any; updateEntity: any; moveStatus?: (id: string, dir: -1 | 1) => void }) {
  const items = [...data[kind]].sort((a, b) => a.order - b.order);
  const taskCount = (id: string) => data.tasks.filter((t) => (kind === 'departments' ? t.departmentId : kind === 'assignees' ? t.assigneeId : t.statusId) === id).length;

  const addEntity = () => {
    const item = kind === 'departments' ? { id: crypto.randomUUID(), name: 'Новый отдел', color: '#64748b', order: items.length, archived: false } :
      kind === 'assignees' ? { id: crypto.randomUUID(), name: 'Новый исполнитель', initials: 'НИ', color: '#64748b', order: items.length, archived: false } :
        { id: crypto.randomUUID(), name: 'Новый статус', order: items.length, archived: false };
    setData((prev: BoardData | null) => prev ? { ...prev, [kind]: [...prev[kind], item as any] } : prev);
  };

  return (
    <section className="panel glass entity-view">
      <div className="entity-head"><h3>{title}</h3><button className="btn" onClick={addEntity}>Добавить</button></div>
      {items.map((item, index) => (
        <article key={item.id} className="entity-row">
          {'color' in item && <input type="color" value={item.color} onChange={(e) => updateEntity(kind, item.id, { color: e.target.value })} />}
          <input className="field" value={item.name} onChange={(e) => updateEntity(kind, item.id, { name: e.target.value })} />
          {'initials' in item && <input className="field initials" value={item.initials} onChange={(e) => updateEntity(kind, item.id, { initials: e.target.value.slice(0, 3).toUpperCase() })} />}
          <span className="counter">{taskCount(item.id)}</span>
          <button className="btn" onClick={() => updateEntity(kind, item.id, { archived: !item.archived })}>{item.archived ? 'Показать' : 'Скрыть'}</button>
          {kind === 'statuses' && <><button className="btn" onClick={() => moveStatus?.(item.id, -1)} disabled={index === 0}>↑</button><button className="btn" onClick={() => moveStatus?.(item.id, 1)} disabled={index === items.length - 1}>↓</button></>}
        </article>
      ))}
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <label>{label}<select className="field" value={value} onChange={(e) => onChange(e.target.value)}><option value="">Все</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

export default App;
