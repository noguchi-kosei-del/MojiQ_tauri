import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppMode = 'instruction' | 'proofreading';

interface ModeState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set, get) => ({
      mode: 'instruction',
      setMode: (mode) => set({ mode }),
      toggleMode: () => set({ mode: get().mode === 'instruction' ? 'proofreading' : 'instruction' }),
    }),
    { name: 'mojiq-app-mode' }
  )
);
