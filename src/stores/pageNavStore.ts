import { create } from 'zustand';

interface PageNavState {
  isPageNavHidden: boolean;
  togglePageNavHidden: () => void;
  setPageNavHidden: (hidden: boolean) => void;
}

export const usePageNavStore = create<PageNavState>()((set, get) => ({
  isPageNavHidden: false,

  togglePageNavHidden: () => {
    set({ isPageNavHidden: !get().isPageNavHidden });
  },

  setPageNavHidden: (hidden) => {
    set({ isPageNavHidden: hidden });
  },
}));
