// src/stores/settingsStore.ts - MojiQ Pro 1.0 設定管理

import { create } from 'zustand';

// localStorage キー
const STORAGE_KEY = 'mojiq_settings';

// ショートカット設定の型
export interface ShortcutConfig {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt')[];
  description: string;
}

// ツール別線幅の型
export interface ToolLineWidths {
  pen: number;
  marker: number;
  eraser: number;
  line: number;
  arrow: number;
  doubleArrow: number;
  rect: number;
  ellipse: number;
  polyline: number;
  semicircle: number;
  chevron: number;
  lshape: number;
  zshape: number;
  bracket: number;
  [key: string]: number;  // Annotated系など動的アクセス用
}

// 設定の型
export interface MojiQSettings {
  version: number;
  shortcuts: Record<string, ShortcutConfig>;
  toolLineWidths: ToolLineWidths;
  scroll: {
    direction: 'normal' | 'inverted';
  };
  panel: {
    closeOnSelect: boolean;
  };
  arrowKey: {
    inverted: boolean;
  };
  exportDrawing: {
    withPdf: boolean;  // PDF保存時に描画データJSONも自動保存
  };
}

// デフォルトツール別線幅
export const DEFAULT_TOOL_LINE_WIDTHS: ToolLineWidths = {
  pen: 2,
  marker: 8,
  eraser: 5,
  line: 2,
  arrow: 2,
  doubleArrow: 2,
  rect: 2,
  ellipse: 2,
  polyline: 2,
  semicircle: 2,
  chevron: 2,
  lshape: 2,
  zshape: 2,
  bracket: 2,
};

// デフォルト設定
export const DEFAULT_SETTINGS: MojiQSettings = {
  version: 1,
  toolLineWidths: { ...DEFAULT_TOOL_LINE_WIDTHS },
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
    pasteInPlace: { key: 'v', modifiers: ['ctrl', 'shift'], description: '同じ位置にペースト' },
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
  exportDrawing: {
    withPdf: false,  // デフォルトは無効
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

  // ツール別線幅
  getToolLineWidth: (toolName: string) => number;
  setToolLineWidth: (toolName: string, width: number) => void;

  // 描画データ自動エクスポート
  getExportDrawingWithPdf: () => boolean;
  setExportDrawingWithPdf: (withPdf: boolean) => void;

  // リセット
  resetToDefault: () => void;

  // ユーティリティ
  formatShortcutDisplay: (shortcut: ShortcutConfig | null) => string;
}

// マイグレーション処理
function migrate(oldSettings: Partial<MojiQSettings>): MojiQSettings {
  const settings: MojiQSettings = {
    version: oldSettings.version || 1,
    toolLineWidths: { ...DEFAULT_TOOL_LINE_WIDTHS },
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts },
    scroll: oldSettings.scroll || { direction: 'normal' },
    panel: oldSettings.panel || { closeOnSelect: false },
    arrowKey: oldSettings.arrowKey || { inverted: false },
    exportDrawing: oldSettings.exportDrawing || { withPdf: false },
  };

  // 既存のツール別線幅をマージ
  if (oldSettings.toolLineWidths) {
    for (const [tool, width] of Object.entries(oldSettings.toolLineWidths)) {
      settings.toolLineWidths[tool] = width;
    }
  }

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

  getToolLineWidth: (toolName: string) => {
    const { settings } = get();
    // Annotated系は基本ツールと同じ線幅を共有
    const baseName = toolName.replace('Annotated', '');
    if (settings.toolLineWidths && settings.toolLineWidths[baseName] !== undefined) {
      return settings.toolLineWidths[baseName];
    }
    return DEFAULT_TOOL_LINE_WIDTHS[baseName] ?? 2;
  },

  setToolLineWidth: (toolName: string, width: number) => {
    const baseName = toolName.replace('Annotated', '');
    set((state) => {
      const newSettings = {
        ...state.settings,
        toolLineWidths: {
          ...state.settings.toolLineWidths,
          [baseName]: width,
        },
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  getExportDrawingWithPdf: () => {
    return get().settings.exportDrawing?.withPdf ?? false;
  },

  setExportDrawingWithPdf: (withPdf: boolean) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        exportDrawing: { withPdf },
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
