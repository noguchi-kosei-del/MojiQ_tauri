import { create } from 'zustand';

interface ViewerModeState {
  isActive: boolean;
  previousZoom: number;
  wasLightTheme: boolean;
  showHint: boolean;
  showCloseButton: boolean;

  // Actions
  enter: (currentZoom: number, isLightTheme: boolean) => void;
  exit: () => { previousZoom: number; wasLightTheme: boolean };
  setShowHint: (show: boolean) => void;
  setShowCloseButton: (show: boolean) => void;
}

export const useViewerModeStore = create<ViewerModeState>((set, get) => ({
  isActive: false,
  previousZoom: 1,
  wasLightTheme: false,
  showHint: false,
  showCloseButton: false,

  enter: (currentZoom, isLightTheme) => {
    set({
      isActive: true,
      previousZoom: currentZoom,
      wasLightTheme: isLightTheme,
      showHint: true,
      showCloseButton: true,
    });
  },

  exit: () => {
    const state = get();
    const { previousZoom, wasLightTheme } = state;
    set({
      isActive: false,
      showHint: false,
      showCloseButton: false,
    });
    return { previousZoom, wasLightTheme };
  },

  setShowHint: (show) => set({ showHint: show }),
  setShowCloseButton: (show) => set({ showCloseButton: show }),
}));
