import { useEffect, useMemo, useState } from 'react';
import type { Assignee, BoardData, Department, Priority, Status, Task, ViewMode } from './types';
import { dateTag, formatDate, isOverdue, toISODate } from './lib/date';
import { priorityColor, sortTasks } from './lib/task';
import { storageApi } from './lib/storage';

const priorities: Priority[] = ['Низкий', 'Средний', 'Высокий', 'Критический'];

const emptyTask = (): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  description: '',
  departmentId: '',
  assigneeId: '',
  priority: 'Средний',
  statusId: '',
  startDate: toISODate(new Date()),
  deadline: toISODate(new Date()),
  color: '#e2e8f0',
  urgent: false
});

function App() {
  const [data, setData] = useState<BoardData | null>(null);
  const [view, setView] = useState<ViewMode>('kanban');
  const [showDone, setShowDone] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState(emptyTask());
  const [modalOpen, setModalOpen] = useState(false);
  const [dataPath, setDataPath] = useState('');
  const [filter, setFilter] = useState({ status: '', dep: '', assignee: '', priority: '', overdue: '', urgent: '', deadline: '' });

  useEffect(() => {
    Promise.all([storageApi.readData(), storageApi.dataPath()]).then(([loaded, path]) => {
      setData(loaded);
      setDataPath(path);
      setDraft((s) => ({ ...s, departmentId: loaded.departments[0]?.id ?? '', assigneeId: loaded.assignees[0]?.id ?? '', statusId: loaded.statuses[0]?.id ?? '' }));
    });
  }, []);

  useEffect(() => {
    if (!data) return;
    void storageApi.writeData(data);
  }, [data]);

  if (!data) return <div className="p-10 text-slate-500">Загрузка доски…</div>;

  const activeStatuses = data.statuses.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  const doneStatusIds = activeStatuses.filter((s) => s.name.toLowerCase().includes('готов')).map((s) => s.id);

  const tasksPrepared = sortTasks(data.tasks, activeStatuses).filter((t) => {
    if (!showDone && doneStatusIds.includes(t.statusId)) return false;
    if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter.status && t.statusId !== filter.status) return false;
    if (filter.dep && t.departmentId !== filter.dep) return false;
    if (filter.assignee && t.assigneeId !== filter.assignee) return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.urgent === 'yes' && !t.urgent) return false;
    if (filter.urgent === 'no' && t.urgent) return false;
    if (filter.overdue === 'yes' && !isOverdue(t.deadline)) return false;
    if (filter.overdue === 'no' && isOverdue(t.deadline)) return false;
    if (filter.deadline === 'today' && t.deadline !== dateTag('today')) return false;
    if (filter.deadline === 'tomorrow' && t.deadline !== dateTag('tomorrow')) return false;
    if (filter.deadline === 'week' && !(t.deadline >= dateTag('today') && t.deadline <= dateTag('week'))) return false;
    return true;
  });

  const stats = {
    active: data.tasks.filter((t) => !doneStatusIds.includes(t.statusId)).length,
    overdue: data.tasks.filter((t) => isOverdue(t.deadline) && !doneStatusIds.includes(t.statusId)).length,
    review: data.tasks.filter((t) => activeStatuses.find((s) => s.id === t.statusId)?.name === 'На проверке').length,
    critical: data.tasks.filter((t) => t.priority === 'Критический' && !doneStatusIds.includes(t.statusId)).length
  };

  const quickFire = useMemo(() => tasksPrepared.filter((t) => t.priority === 'Критический' || isOverdue(t.deadline)).slice(0, 5), [tasksPrepared]);

  const saveTask = () => {
    if (!draft.title.trim()) return;
    setData((prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();
      const task: Task = {
        ...draft,
        id: selectedTask?.id ?? crypto.randomUUID(),
        completedAt: doneStatusIds.includes(draft.statusId) ? now : undefined,
        createdAt: selectedTask?.createdAt ?? now,
        updatedAt: now
      };
      const tasks = selectedTask ? prev.tasks.map((t) => (t.id === selectedTask.id ? task : t)) : [...prev.tasks, task];
      return { ...prev, tasks };
    });
    setSelectedTask(null);
    setDraft(emptyTask());
    setModalOpen(false);
  };

  const removeTask = () => {
    if (!selectedTask) return;
    if (!confirm('Удалить задачу без возможности восстановления?')) return;
    setData((prev) => (prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== selectedTask.id) } : prev));
    setSelectedTask(null);
    setDraft(emptyTask());
    setModalOpen(false);
  };

  const startEdit = (task?: Task) => {
    if (!task) {
      setSelectedTask(null);
      setDraft({ ...emptyTask(), departmentId: data.departments[0]?.id ?? '', assigneeId: data.assignees[0]?.id ?? '', statusId: data.statuses[0]?.id ?? '' });
      setModalOpen(true);
      return;
    }
    setSelectedTask(task);
    setDraft({ ...task });
    setModalOpen(true);
  };

  const updateEntity = <T extends Department | Assignee | Status>(key: 'departments' | 'assignees' | 'statuses', id: string, patch: Partial<T>) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: (prev[key] as T[]).map((e) => (e.id === id ? { ...e, ...patch } : e)) };
    });
  };

  const Header = (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">ОПЕРАЦИОННАЯ ДОСКА</h1>
        <p className="text-xs text-slate-500">Локальный офлайн-тасктрекер руководителя</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setView('kanban')} className={`btn ${view === 'kanban' ? 'btn-active' : ''}`}>Канбан</button>
        <button onClick={() => setView('list')} className={`btn ${view === 'list' ? 'btn-active' : ''}`}>Список</button>
        <button onClick={() => setView('settings')} className={`btn ${view === 'settings' ? 'btn-active' : ''}`}>Справочники</button>
        <button onClick={() => startEdit()} className="btn btn-active">+ Новая задача</button>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen text-slate-900">
      {Header}
      <main className="p-6 space-y-5">
        <section className="grid grid-cols-5 gap-3">
          {[['Активных', stats.active], ['Просрочено', stats.overdue], ['На проверке', stats.review], ['Критических', stats.critical], ['Хранилище', dataPath.split('/').slice(-2).join('/')]].map(([k, v]) => (
            <div key={String(k)} className="bg-white rounded-xl shadow-soft p-4 border border-slate-200">
              <div className="text-xs text-slate-500">{k}</div>
              <div className="text-2xl font-semibold mt-1">{v}</div>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-xl shadow-soft border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию" className="inp w-56" />
          <Sel label="Статус" value={filter.status} onChange={(v) => setFilter({ ...filter, status: v })} options={activeStatuses.map((s) => ({ value: s.id, label: s.name }))} />
          <Sel label="Отдел" value={filter.dep} onChange={(v) => setFilter({ ...filter, dep: v })} options={data.departments.filter((d) => !d.archived).map((d) => ({ value: d.id, label: d.name }))} />
          <Sel label="Исполнитель" value={filter.assignee} onChange={(v) => setFilter({ ...filter, assignee: v })} options={data.assignees.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))} />
          <Sel label="Приоритет" value={filter.priority} onChange={(v) => setFilter({ ...filter, priority: v })} options={priorities.map((p) => ({ value: p, label: p }))} />
          <Sel label="Дедлайн" value={filter.deadline} onChange={(v) => setFilter({ ...filter, deadline: v })} options={[{ value: 'today', label: 'Сегодня' }, { value: 'tomorrow', label: 'Завтра' }, { value: 'week', label: 'На этой неделе' }]} />
          <button className="btn" onClick={() => setShowDone((s) => !s)}>{showDone ? 'Скрыть завершённые' : 'Показать завершённые'}</button>
        </section>

        {quickFire.length > 0 && (
          <section className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <h3 className="font-semibold mb-2">Что горит сейчас</h3>
            <div className="grid grid-cols-3 gap-3">
              {quickFire.map((t) => <TaskCard key={t.id} task={t} data={data} onOpen={() => startEdit(t)} />)}
            </div>
          </section>
        )}

        {view === 'kanban' && (
          <section className="grid grid-cols-5 gap-3 items-start">
            {activeStatuses.map((status) => {
              const tasks = tasksPrepared.filter((t) => t.statusId === status.id);
              return (
                <div key={status.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 min-h-96"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const taskId = e.dataTransfer.getData('text/plain');
                    setData((prev) => prev ? { ...prev, tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, statusId: status.id, completedAt: doneStatusIds.includes(status.id) ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() } : t) } : prev);
                  }}>
                  <div className="flex justify-between mb-2"><h3 className="font-semibold">{status.name}</h3><span className="text-xs text-slate-500">{tasks.length}</span></div>
                  <div className="space-y-2">{tasks.map((t) => <TaskCard key={t.id} task={t} data={data} onOpen={() => startEdit(t)} drag />)}</div>
                </div>
              );
            })}
          </section>
        )}

        {view === 'list' && (
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr>{['Название', 'Отдел', 'Исполнитель', 'Приоритет', 'Статус', 'Старт', 'Дедлайн', 'Срочно', 'Просрочка'].map((h) => <th key={h} className="text-left p-3">{h}</th>)}</tr></thead>
              <tbody>{tasksPrepared.map((t) => (
                <tr key={t.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => startEdit(t)}>
                  <td className="p-3">{t.title}</td>
                  <td className="p-3">{data.departments.find((d) => d.id === t.departmentId)?.name}</td>
                  <td className="p-3">{data.assignees.find((a) => a.id === t.assigneeId)?.name}</td>
                  <td className="p-3"><span className={`tag ${priorityColor[t.priority]}`}>{t.priority}</span></td>
                  <td className="p-3">{data.statuses.find((s) => s.id === t.statusId)?.name}</td>
                  <td className="p-3">{formatDate(t.startDate)}</td>
                  <td className={`p-3 ${isOverdue(t.deadline) ? 'text-rose-600 font-semibold' : ''}`}>{formatDate(t.deadline)}</td>
                  <td className="p-3">{t.urgent ? 'Да' : 'Нет'}</td>
                  <td className="p-3">{isOverdue(t.deadline) ? 'Да' : 'Нет'}</td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        )}

        {view === 'settings' && (
          <section className="grid grid-cols-3 gap-4">
            <Directory title="Отделы" items={data.departments} setData={setData} updateEntity={updateEntity} newItem={() => ({ id: crypto.randomUUID(), name: 'Новый отдел', color: '#64748b', order: data.departments.length, archived: false })} />
            <Directory title="Исполнители" items={data.assignees} setData={setData} updateEntity={updateEntity} newItem={() => ({ id: crypto.randomUUID(), name: 'Новый исполнитель', initials: 'НИ', color: '#64748b', order: data.assignees.length, archived: false })} />
            <Directory title="Статусы" items={data.statuses} setData={setData} updateEntity={updateEntity} newItem={() => ({ id: crypto.randomUUID(), name: 'Новый статус', order: data.statuses.length, archived: false })} />
          </section>
        )}
      </main>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/30 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-soft w-full max-w-2xl p-6 space-y-3">
            <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">{selectedTask ? 'Редактирование задачи' : 'Новая задача'}</h2><button className="btn" onClick={() => { setSelectedTask(null); setDraft(emptyTask()); setModalOpen(false); }}>Закрыть</button></div>
            <input className="inp w-full" placeholder="Название" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <textarea className="inp w-full min-h-28" placeholder="Описание" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Sel label="Отдел" value={draft.departmentId} onChange={(v) => setDraft({ ...draft, departmentId: v })} options={data.departments.filter((d) => !d.archived).map((d) => ({ value: d.id, label: d.name }))} />
              <Sel label="Исполнитель" value={draft.assigneeId} onChange={(v) => setDraft({ ...draft, assigneeId: v })} options={data.assignees.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name }))} />
              <Sel label="Приоритет" value={draft.priority} onChange={(v) => setDraft({ ...draft, priority: v as Priority })} options={priorities.map((p) => ({ value: p, label: p }))} />
              <Sel label="Статус" value={draft.statusId} onChange={(v) => setDraft({ ...draft, statusId: v })} options={activeStatuses.map((s) => ({ value: s.id, label: s.name }))} />
              <label className="text-xs text-slate-600">Дата старта<input type="date" className="inp w-full mt-1" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
              <label className="text-xs text-slate-600">Дедлайн<input type="date" className="inp w-full mt-1" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} /></label>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={() => setDraft({ ...draft, deadline: dateTag('today') })}>Сегодня</button>
              <button className="btn" onClick={() => setDraft({ ...draft, deadline: dateTag('tomorrow') })}>Завтра</button>
              <button className="btn" onClick={() => setDraft({ ...draft, deadline: dateTag('plus3') })}>Через 3 дня</button>
              <button className="btn" onClick={() => setDraft({ ...draft, deadline: dateTag('week') })}>На этой неделе</button>
            </div>
            <div className="flex justify-between"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.urgent} onChange={(e) => setDraft({ ...draft, urgent: e.target.checked })} />Срочно</label><input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></div>
            <div className="flex justify-between pt-2"><button className="btn text-rose-600" onClick={removeTask}>Удалить</button><button className="btn btn-active" onClick={saveTask}>Сохранить</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, data, onOpen, drag }: { task: Task; data: BoardData; onOpen: () => void; drag?: boolean }) {
  const dep = data.departments.find((d) => d.id === task.departmentId);
  const assignee = data.assignees.find((a) => a.id === task.assigneeId);
  return (
    <article draggable={drag} onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)} onClick={onOpen} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-soft transition cursor-pointer">
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-medium leading-tight">{task.title}</h4>
        <span className={`tag ${priorityColor[task.priority]}`}>{task.priority}</span>
      </div>
      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{task.description || 'Без описания'}</p>
      <div className="flex gap-2 mt-2 text-xs">
        <span className="tag" style={{ background: `${dep?.color}20`, color: dep?.color }}>{dep?.name}</span>
        <span className="tag" style={{ background: `${assignee?.color}20`, color: assignee?.color }}>{assignee?.initials}</span>
        <span className={`tag ${isOverdue(task.deadline) ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>{formatDate(task.deadline)}</span>
        {task.urgent && <span className="tag bg-rose-100 text-rose-700">Срочно</span>}
      </div>
    </article>
  );
}

function Directory({ title, items, setData, updateEntity, newItem }: { title: string; items: any[]; setData: any; updateEntity: any; newItem: () => any; }) {
  const key = title === 'Отделы' ? 'departments' : title === 'Исполнители' ? 'assignees' : 'statuses';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
      <div className="flex justify-between"><h3 className="font-semibold">{title}</h3><button className="btn" onClick={() => setData((prev: BoardData) => ({ ...prev, [key]: [...(prev as any)[key], newItem()] }))}>+ Добавить</button></div>
      {items.sort((a, b) => a.order - b.order).map((item) => (
        <div key={item.id} className="border border-slate-200 rounded-lg p-2 space-y-1">
          <input className="inp w-full" value={item.name} onChange={(e) => updateEntity(key, item.id, { name: e.target.value })} />
          {'initials' in item && <input className="inp w-full" value={item.initials} onChange={(e) => updateEntity(key, item.id, { initials: e.target.value.slice(0, 3) })} />}
          {'color' in item && <input type="color" value={item.color} onChange={(e) => updateEntity(key, item.id, { color: e.target.value })} />}
          <div className="flex gap-2"><button className="btn" onClick={() => updateEntity(key, item.id, { order: Math.max(0, item.order - 1) })}>↑</button><button className="btn" onClick={() => updateEntity(key, item.id, { order: item.order + 1 })}>↓</button><button className="btn" onClick={() => updateEntity(key, item.id, { archived: !item.archived })}>{item.archived ? 'Восстановить' : 'Архив'}</button></div>
        </div>
      ))}
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <label className="text-xs text-slate-600">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="inp ml-1"><option value="">Все</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

export default App;
