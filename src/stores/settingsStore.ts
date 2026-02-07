// src/stores/settingsStore.ts - MojiQ 3.0 設定管理

import { create } from 'zustand';

// localStorage キー
const STORAGE_KEY = 'mojiq_settings';

// ショートカット設定の型
export interface ShortcutConfig {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt')[];
  description: string;
}

// 設定の型
export interface MojiQSettings {
  version: number;
  shortcuts: Record<string, ShortcutConfig>;
  scroll: {
    direction: 'normal' | 'inverted';
  };
  panel: {
    closeOnSelect: boolean;
  };
  arrowKey: {
    inverted: boolean;
  };
}

// デフォルト設定
export const DEFAULT_SETTINGS: MojiQSettings = {
  version: 1,
  shortcuts: {
    // ズーム操作
    zoomIn: { key: '=', modifiers: ['ctrl'], description: '拡大' },
    zoomOut: { key: '-', modifiers: ['ctrl'], description: '縮小' },
    zoomReset: { key: '0', modifiers: ['ctrl'], description: '100%' },
    // 履歴操作
    undo: { key: 'z', modifiers: ['ctrl'], description: '元に戻す' },
    redo: { key: 'z', modifiers: ['ctrl', 'shift'], description: 'やり直し' },
    // ファイル操作
    save: { key: 's', modifiers: ['ctrl'], description: '保存' },
    open: { key: 'o', modifiers: ['ctrl'], description: '開く' },
    // ページ移動
    pageNext: { key: 'ArrowRight', modifiers: [], description: '次ページ' },
    pagePrev: { key: 'ArrowLeft', modifiers: [], description: '前ページ' },
    pageFirst: { key: 'ArrowRight', modifiers: ['ctrl'], description: '最初のページ' },
    pageLast: { key: 'ArrowLeft', modifiers: ['ctrl'], description: '最後のページ' },
    // 線幅
    lineWidthUp: { key: ']', modifiers: ['ctrl'], description: '線を太く' },
    lineWidthDown: { key: '[', modifiers: ['ctrl'], description: '線を細く' },
    // その他
    clearAll: { key: 'Delete', modifiers: ['ctrl'], description: '全消去' },
    viewerMode: { key: 'F1', modifiers: [], description: '閲覧モード' },
    // ツール切り替え
    toolSelect: { key: 'v', modifiers: [], description: '選択ツール' },
    toolDraw: { key: 'p', modifiers: [], description: 'ペン' },
    toolMarker: { key: 'm', modifiers: [], description: 'マーカー' },
    toolEraser: { key: 'e', modifiers: [], description: '消しゴム' },
    toolText: { key: 't', modifiers: [], description: 'テキスト' },
    toolRect: { key: 'r', modifiers: [], description: '矩形' },
    toolEllipse: { key: 'o', modifiers: [], description: '楕円' },
    toolLine: { key: 'l', modifiers: [], description: '直線' },
    toolArrow: { key: 'a', modifiers: [], description: '矢印' },
    toolDoubleArrow: { key: 'd', modifiers: [], description: '両矢印' },
    toolPolyline: { key: 'y', modifiers: [], description: '折れ線' },
    toolImage: { key: 'i', modifiers: [], description: '画像' },
  },
  scroll: {
    direction: 'normal',
  },
  panel: {
    closeOnSelect: false,
  },
  arrowKey: {
    inverted: false,
  },
};

interface SettingsState {
  settings: MojiQSettings;
  isModalOpen: boolean;

  // モーダル操作
  openModal: () => void;
  closeModal: () => void;

  // ショートカット操作
  getShortcut: (id: string) => ShortcutConfig | null;
  setShortcut: (id: string, key: string, modifiers: ('ctrl' | 'shift' | 'alt')[]) => void;
  resetShortcutsToDefault: () => void;
  checkConflict: (id: string, key: string, modifiers: ('ctrl' | 'shift' | 'alt')[]) => { conflict: boolean; with?: string; description?: string };

  // スクロール方向
  getScrollDirection: () => 'normal' | 'inverted';
  setScrollDirection: (direction: 'normal' | 'inverted') => void;

  // パネル動作
  getPanelCloseOnSelect: () => boolean;
  setPanelCloseOnSelect: (closeOnSelect: boolean) => void;

  // 方向キー
  getArrowKeyInverted: () => boolean;
  setArrowKeyInverted: (inverted: boolean) => void;

  // リセット
  resetToDefault: () => void;

  // ユーティリティ
  formatShortcutDisplay: (shortcut: ShortcutConfig | null) => string;
}

// マイグレーション処理
function migrate(oldSettings: Partial<MojiQSettings>): MojiQSettings {
  const settings: MojiQSettings = {
    version: oldSettings.version || 1,
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts },
    scroll: oldSettings.scroll || { direction: 'normal' },
    panel: oldSettings.panel || { closeOnSelect: false },
    arrowKey: oldSettings.arrowKey || { inverted: false },
  };

  // 既存のショートカット設定をマージ
  if (oldSettings.shortcuts) {
    for (const [key, value] of Object.entries(oldSettings.shortcuts)) {
      if (settings.shortcuts[key]) {
        settings.shortcuts[key] = {
          ...settings.shortcuts[key],
          key: value.key,
          modifiers: value.modifiers,
        };
      }
    }
  }

  return settings;
}

// localStorageから読み込み
function loadSettings(): MojiQSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return migrate(parsed);
    }
  } catch (e) {
    console.warn('[SettingsStore] Failed to parse settings, using defaults');
  }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

// localStorageに保存
function saveSettings(settings: MojiQSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: loadSettings(),
  isModalOpen: false,

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  getShortcut: (id: string) => {
    const { settings } = get();
    return settings.shortcuts[id] || null;
  },

  setShortcut: (id: string, key: string, modifiers: ('ctrl' | 'shift' | 'alt')[]) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        shortcuts: {
          ...state.settings.shortcuts,
          [id]: {
            ...state.settings.shortcuts[id],
            key,
            modifiers,
          },
        },
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  resetShortcutsToDefault: () => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        shortcuts: JSON.parse(JSON.stringify(DEFAULT_SETTINGS.shortcuts)),
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  checkConflict: (id: string, key: string, modifiers: ('ctrl' | 'shift' | 'alt')[]) => {
    const { settings } = get();
    const sortedModifiers = [...modifiers].sort();

    for (const [shortcutId, shortcut] of Object.entries(settings.shortcuts)) {
      if (shortcutId === id) continue;
      const shortcutModifiers = [...(shortcut.modifiers || [])].sort();
      if (
        shortcut.key === key &&
        JSON.stringify(shortcutModifiers) === JSON.stringify(sortedModifiers)
      ) {
        return {
          conflict: true,
          with: shortcutId,
          description: shortcut.description,
        };
      }
    }
    return { conflict: false };
  },

  getScrollDirection: () => {
    return get().settings.scroll.direction;
  },

  setScrollDirection: (direction: 'normal' | 'inverted') => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        scroll: { direction },
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  getPanelCloseOnSelect: () => {
    return get().settings.panel.closeOnSelect;
  },

  setPanelCloseOnSelect: (closeOnSelect: boolean) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        panel: { closeOnSelect },
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  getArrowKeyInverted: () => {
    return get().settings.arrowKey.inverted;
  },

  setArrowKeyInverted: (inverted: boolean) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        arrowKey: { inverted },
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  resetToDefault: () => {
    const newSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    saveSettings(newSettings);
    set({ settings: newSettings });
  },

  formatShortcutDisplay: (shortcut: ShortcutConfig | null) => {
    if (!shortcut) return '';
    const parts: string[] = [];
    const modifiers = shortcut.modifiers || [];

    if (modifiers.includes('ctrl')) parts.push('Ctrl');
    if (modifiers.includes('shift')) parts.push('Shift');
    if (modifiers.includes('alt')) parts.push('Alt');

    let keyDisplay = shortcut.key;
    if (keyDisplay === 'ArrowLeft') keyDisplay = '←';
    else if (keyDisplay === 'ArrowRight') keyDisplay = '→';
    else if (keyDisplay === 'ArrowUp') keyDisplay = '↑';
    else if (keyDisplay === 'ArrowDown') keyDisplay = '↓';
    else if (keyDisplay === ' ' || keyDisplay === 'Space') keyDisplay = 'Space';
    else if (keyDisplay === 'Delete') keyDisplay = 'Delete';
    else if (keyDisplay === 'Backspace') keyDisplay = 'Backspace';
    else if (keyDisplay.startsWith('F') && !isNaN(Number(keyDisplay.slice(1)))) {
      // F1-F12 はそのまま
    } else {
      keyDisplay = keyDisplay.toUpperCase();
    }

    parts.push(keyDisplay);
    return parts.join(' + ');
  },
}));
