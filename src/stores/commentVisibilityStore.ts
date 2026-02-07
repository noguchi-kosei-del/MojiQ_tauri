import { create } from 'zustand';

interface CommentVisibilityState {
  // PDF注釈テキストを非表示にしているかどうか
  isHidden: boolean;
  // 表示/非表示を切り替え
  toggle: () => void;
  // 表示
  show: () => void;
  // 非表示
  hide: () => void;
}

export const useCommentVisibilityStore = create<CommentVisibilityState>((set, get) => ({
  isHidden: false,

  toggle: () => {
    const { isHidden } = get();
    if (isHidden) {
      get().show();
    } else {
      get().hide();
    }
  },

  show: () => {
    set({ isHidden: false });
  },

  hide: () => {
    set({ isHidden: true });
  },
}));
