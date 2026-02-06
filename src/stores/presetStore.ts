import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// フォントプリセット
export interface FontPreset {
  id: string;
  name: string;
  color: string;
}

// 作品仕様（JSONから読み込んだプリセット）
export interface WorkSpec {
  fontSizes: number[];
  fonts: FontPreset[];
}

// 自動割り当て色のパレット
const AUTO_COLORS = [
  '#FF0000', '#FF00FF', '#00C400', '#FF6A00',
  '#0066FF', '#AA00FF', '#FF0070', '#0099E0'
];

interface PresetState {
  // 文字サイズ
  fontSizes: number[];
  selectedFontSize: number | null;

  // フォント指定
  fonts: FontPreset[];
  selectedFont: FontPreset | null;

  // 自動色割り当て用カウンター
  fontColorIndex: number;

  // 文字サイズ操作
  addFontSize: (size: number) => void;
  removeFontSize: (size: number) => void;
  selectFontSize: (size: number | null) => void;

  // フォント操作
  addFont: (name: string, color?: string) => void;
  removeFont: (id: string) => void;
  updateFont: (id: string, updates: Partial<Omit<FontPreset, 'id'>>) => void;
  selectFont: (font: FontPreset | null) => void;

  // 作品仕様読み込み
  loadWorkSpec: (spec: WorkSpec) => void;
  appendWorkSpec: (spec: WorkSpec) => void;

  // 選択解除
  clearSelection: () => void;

  // フォントのみクリア
  clearFonts: () => void;

  // リセット
  reset: () => void;
}

// デフォルトの文字サイズ
const DEFAULT_FONT_SIZES = [11, 12, 13, 14, 15, 16, 18, 20, 24];

export const usePresetStore = create<PresetState>()(
  persist(
    (set, get) => ({
      fontSizes: DEFAULT_FONT_SIZES,
      selectedFontSize: null,
      fonts: [],
      selectedFont: null,
      fontColorIndex: 0,

      addFontSize: (size) => {
        const { fontSizes } = get();
        if (!fontSizes.includes(size)) {
          set({ fontSizes: [...fontSizes, size].sort((a, b) => a - b) });
        }
      },

      removeFontSize: (size) => {
        const { fontSizes, selectedFontSize } = get();
        set({
          fontSizes: fontSizes.filter(s => s !== size),
          selectedFontSize: selectedFontSize === size ? null : selectedFontSize,
        });
      },

      selectFontSize: (size) => {
        set({ selectedFontSize: size, selectedFont: null });
      },

      addFont: (name, color) => {
        const { fonts, fontColorIndex } = get();
        const newFont: FontPreset = {
          id: `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
          color: color || AUTO_COLORS[fontColorIndex % AUTO_COLORS.length],
        };
        set({
          fonts: [...fonts, newFont],
          fontColorIndex: color ? fontColorIndex : fontColorIndex + 1,
        });
      },

      removeFont: (id) => {
        const { fonts, selectedFont } = get();
        set({
          fonts: fonts.filter(f => f.id !== id),
          selectedFont: selectedFont?.id === id ? null : selectedFont,
        });
      },

      updateFont: (id, updates) => {
        const { fonts, selectedFont } = get();
        const updatedFonts = fonts.map(f =>
          f.id === id ? { ...f, ...updates } : f
        );
        set({
          fonts: updatedFonts,
          selectedFont: selectedFont?.id === id
            ? { ...selectedFont, ...updates }
            : selectedFont,
        });
      },

      selectFont: (font) => {
        set({ selectedFont: font, selectedFontSize: null });
      },

      loadWorkSpec: (spec) => {
        let colorIndex = 0;
        const fonts = spec.fonts.map(f => {
          const font: FontPreset = {
            id: `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: f.name,
            color: f.color || AUTO_COLORS[colorIndex % AUTO_COLORS.length],
          };
          if (!f.color) colorIndex++;
          return font;
        });

        set({
          fontSizes: spec.fontSizes.length > 0 ? spec.fontSizes.sort((a, b) => a - b) : DEFAULT_FONT_SIZES,
          fonts,
          fontColorIndex: colorIndex,
          selectedFontSize: null,
          selectedFont: null,
        });
      },

      appendWorkSpec: (spec) => {
        const { fontSizes, fonts, fontColorIndex } = get();

        // 重複を除いて文字サイズを追加
        const newSizes = spec.fontSizes.filter(s => !fontSizes.includes(s));
        const allSizes = [...fontSizes, ...newSizes].sort((a, b) => a - b);

        // 重複を除いてフォントを追加
        const existingNames = new Set(fonts.map(f => f.name));
        let colorIndex = fontColorIndex;
        const newFonts = spec.fonts
          .filter(f => !existingNames.has(f.name))
          .map(f => {
            const font: FontPreset = {
              id: `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: f.name,
              color: f.color || AUTO_COLORS[colorIndex % AUTO_COLORS.length],
            };
            if (!f.color) colorIndex++;
            return font;
          });

        set({
          fontSizes: allSizes,
          fonts: [...fonts, ...newFonts],
          fontColorIndex: colorIndex,
        });
      },

      clearSelection: () => {
        set({ selectedFontSize: null, selectedFont: null });
      },

      clearFonts: () => {
        set({ fonts: [], selectedFont: null, fontColorIndex: 0 });
      },

      reset: () => {
        set({
          fontSizes: DEFAULT_FONT_SIZES,
          fonts: [],
          selectedFontSize: null,
          selectedFont: null,
          fontColorIndex: 0,
        });
      },
    }),
    {
      name: 'mojiq-presets',
    }
  )
);
