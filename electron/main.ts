import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

const APP_FILENAME = 'oper-board-data.json';

const defaultData = {
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
};

const dataPath = () => path.join(app.getPath('userData'), APP_FILENAME);

const ensureDataFile = async () => {
  const file = dataPath();
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
};

const createWindow = async () => {
  await ensureDataFile();

  const win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    title: 'ОПЕРАЦИОННАЯ ДОСКА',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await win.loadURL(devServerUrl);
  } else {
    await win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

ipcMain.handle('data:read', async () => {
  const content = await fs.readFile(dataPath(), 'utf-8');
  return JSON.parse(content);
});

ipcMain.handle('data:write', async (_event, payload) => {
  await fs.writeFile(dataPath(), JSON.stringify(payload, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('data:path', async () => dataPath());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
