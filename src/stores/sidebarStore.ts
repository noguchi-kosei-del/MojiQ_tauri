import { create } from 'zustand';

interface SidebarStore {
  /** ツールバー（DrawingToolbar）が折りたたまれているか */
  isToolbarCollapsed: boolean;
  /** 設定バー（DrawingSettingsBar）が折りたたまれているか */
  isSettingsBarCollapsed: boolean;
  /** 右サイドバー（RightToolbar）が折りたたまれているか */
  isRightCollapsed: boolean;
  /** ツールバーを折りたたむ/展開する */
  toggleToolbar: () => void;
  /** 設定バーを折りたたむ/展開する */
  toggleSettingsBar: () => void;
  /** 右サイドバーを折りたたむ/展開する */
  toggleRightSidebar: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isToolbarCollapsed: false,
  isSettingsBarCollapsed: false,
  isRightCollapsed: false,

  toggleToolbar: () => {
    set((state) => ({ isToolbarCollapsed: !state.isToolbarCollapsed }));
  },

  toggleSettingsBar: () => {
    set((state) => ({ isSettingsBarCollapsed: !state.isSettingsBarCollapsed }));
  },

  toggleRightSidebar: () => {
    set((state) => ({ isRightCollapsed: !state.isRightCollapsed }));
  },
}));
