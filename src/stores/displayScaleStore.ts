import { create } from 'zustand';

interface DisplayScaleState {
  // 現在の表示スケール（baseScale * zoom）
  displayScale: number;
  // ベーススケール（キャンバス内部解像度→CSS表示サイズの比率、ズーム非依存）
  baseScale: number;
  setDisplayScale: (scale: number) => void;
  setBaseScale: (scale: number) => void;
}

export const useDisplayScaleStore = create<DisplayScaleState>((set) => ({
  displayScale: 1,
  baseScale: 1,
  setDisplayScale: (scale) => set({ displayScale: scale }),
  setBaseScale: (scale) => set({ baseScale: scale }),
}));
