import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceState {
  isFlipped: boolean;
  toggleFlipped: () => void;
  setFlipped: (flipped: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      isFlipped: false,

      toggleFlipped: () => {
        set({ isFlipped: !get().isFlipped });
      },

      setFlipped: (flipped) => {
        set({ isFlipped: flipped });
      },
    }),
    {
      name: 'mojiq-workspace',
    }
  )
);
