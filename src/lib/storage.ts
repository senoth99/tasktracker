import type { BoardData } from '../types';

const STORAGE_KEY = 'oper-board-data';

const createDefaultData = (): BoardData => ({
  departments: [
    { id: crypto.randomUUID(), name: 'ОПЕРАЦИОННЫЙ БЛОК', color: '#0ea5e9', order: 0, archived: false },
    { id: crypto.randomUUID(), name: 'СКЛАД / ПРОИЗВОДСТВО', color: '#8b5cf6', order: 1, archived: false },
    { id: crypto.randomUUID(), name: 'МАРКЕТИНГ', color: '#10b981', order: 2, archived: false }
  ],
  assignees: [
    { id: crypto.randomUUID(), name: 'Иван Петров', initials: 'ИП', color: '#3b82f6', order: 0, archived: false },
    { id: crypto.randomUUID(), name: 'Анна Смирнова', initials: 'АС', color: '#ec4899', order: 1, archived: false }
  ],
  statuses: [
    { id: crypto.randomUUID(), name: 'Беклог', order: 0, archived: false },
    { id: crypto.randomUUID(), name: 'Задача поставлена', order: 1, archived: false },
    { id: crypto.randomUUID(), name: 'В процессе', order: 2, archived: false },
    { id: crypto.randomUUID(), name: 'На проверке', order: 3, archived: false },
    { id: crypto.randomUUID(), name: 'Готово', order: 4, archived: false }
  ],
  tasks: []
});

const browserStorage = {
  async readData(): Promise<BoardData> {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    try {
      return JSON.parse(raw) as BoardData;
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
