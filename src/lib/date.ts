const tz = 'Europe/Moscow';

export const formatDate = (iso: string) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: tz
  }).format(new Date(iso));
};

export const toISODate = (value: Date) => {
  const moscow = new Date(value.toLocaleString('en-US', { timeZone: tz }));
  return new Date(moscow.getTime() - moscow.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const isOverdue = (deadline: string) => {
  const today = toISODate(new Date());
  return deadline < today;
};

export const dateTag = (key: 'today' | 'tomorrow' | 'plus3' | 'week') => {
  const now = new Date();
  if (key === 'today') return toISODate(now);
  if (key === 'tomorrow') return toISODate(new Date(now.getTime() + 86400000));
  if (key === 'plus3') return toISODate(new Date(now.getTime() + 86400000 * 3));
  const day = now.getDay() || 7;
  const diff = 7 - day;
  return toISODate(new Date(now.getTime() + diff * 86400000));
};
