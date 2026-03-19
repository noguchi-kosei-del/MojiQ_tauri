import { create } from 'zustand';

interface DisplayScaleState {
  // 現在の表示スケール（baseScale * zoom）
  displayScale: number;
  setDisplayScale: (scale: number) => void;
}

export const useDisplayScaleStore = create<DisplayScaleState>((set) => ({
  displayScale: 1,
  setDisplayScale: (scale) => set({ displayScale: scale }),
}));
