import { create } from 'zustand';

interface BgOpacityStore {
  /** 背景透過度 (0-100, 100=不透明, 0=完全透明) */
  bgOpacity: number;
  /** 背景透過度を設定 */
  setBgOpacity: (opacity: number) => void;
  /** 背景透過度をリセット（100=不透明に戻す） */
  resetBgOpacity: () => void;
}

export const useBgOpacityStore = create<BgOpacityStore>((set) => ({
  bgOpacity: 100,

  setBgOpacity: (opacity: number) => {
    // 0-100の範囲に制限
    const clampedOpacity = Math.max(0, Math.min(100, opacity));
    set({ bgOpacity: clampedOpacity });
  },

  resetBgOpacity: () => {
    set({ bgOpacity: 100 });
  },
}));
