// src/stores/recentFilesStore.ts - 最近開いたファイル一覧の管理

import { create } from 'zustand';

const STORAGE_KEY = 'mojiq_recent_files';
const MAX_RECENT_FILES = 5;

export interface RecentFile {
  path: string;
  name: string;
  openedAt: number; // timestamp
}

interface RecentFilesState {
  recentFiles: RecentFile[];
  addRecentFile: (path: string) => void;
  removeRecentFile: (path: string) => void;
  clearRecentFiles: () => void;
}

function loadRecentFiles(): RecentFile[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveRecentFiles(files: RecentFile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export const useRecentFilesStore = create<RecentFilesState>((set, get) => ({
  recentFiles: loadRecentFiles(),

  addRecentFile: (path: string) => {
    const name = path.split(/[/\\]/).pop() || path;
    const existing = get().recentFiles.filter(f => f.path !== path);
    const updated = [{ path, name, openedAt: Date.now() }, ...existing].slice(0, MAX_RECENT_FILES);
    saveRecentFiles(updated);
    set({ recentFiles: updated });
  },

  removeRecentFile: (path: string) => {
    const updated = get().recentFiles.filter(f => f.path !== path);
    saveRecentFiles(updated);
    set({ recentFiles: updated });
  },

  clearRecentFiles: () => {
    saveRecentFiles([]);
    set({ recentFiles: [] });
  },
}));
