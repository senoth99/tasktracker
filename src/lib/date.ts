const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RU_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

const pad = (v: number) => String(v).padStart(2, '0');

const toIsoFromParts = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

export const toISODate = (value: Date) => {
  const year = value.getFullYear();
  const month = value.getMonth() + 1;
  const day = value.getDate();
  return toIsoFromParts(year, month, day);
};

export const formatDate = (input?: string | null) => {
  const iso = normalizeDate(input);
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
};

export const normalizeDate = (input?: string | null) => {
  if (!input) return '';
  const value = String(input).trim();

  if (DATE_RE.test(value)) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return value;
  }

  const ruMatch = value.match(RU_RE);
  if (ruMatch) {
    const [, day, month, year] = ruMatch;
    const iso = `${year}-${month}-${day}`;
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return iso;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toISODate(date);
};

export const isOverdue = (deadline: string) => {
  const normalized = normalizeDate(deadline);
  if (!normalized) return false;
  return normalized < toISODate(new Date());
};

export const dateTag = (key: 'today' | 'tomorrow' | 'plus3' | 'week') => {
  const now = new Date();
  const seed = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (key === 'today') return toISODate(seed);
  if (key === 'tomorrow') return toISODate(new Date(seed.getTime() + 86400000));
  if (key === 'plus3') return toISODate(new Date(seed.getTime() + 86400000 * 3));

  const day = seed.getDay() || 7;
  const diff = 7 - day;
  return toISODate(new Date(seed.getTime() + diff * 86400000));
};
