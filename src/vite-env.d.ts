/// <reference types="vite/client" />

import type { BoardData } from './types';

declare global {
  interface Window {
    operBoardApi: {
      readData: () => Promise<BoardData>;
      writeData: (payload: BoardData) => Promise<boolean>;
      dataPath: () => Promise<string>;
    }
  }
}
