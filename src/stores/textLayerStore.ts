/**
 * PDFテキストレイヤー表示状態の管理
 * Ctrl+T でPDF元テキストのオーバーレイ表示を切り替え
 */
import { create } from 'zustand';

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  fontSize: number;
  // transform行列から取得した回転角度（ラジアン）
  angle: number;
}

interface TextLayerState {
  /** テキストレイヤーが表示中かどうか */
  isVisible: boolean;
  /** ページごとのテキストアイテムキャッシュ（0-indexed page → items） */
  pageTextItems: Map<number, PdfTextItem[]>;
  /** 現在抽出中のページ（ローディング表示用） */
  isExtracting: boolean;
}

interface TextLayerActions {
  toggle: () => void;
  show: () => void;
  hide: () => void;
  setPageTextItems: (pageIndex: number, items: PdfTextItem[]) => void;
  getPageTextItems: (pageIndex: number) => PdfTextItem[] | undefined;
  setExtracting: (extracting: boolean) => void;
  clearCache: () => void;
}

export const useTextLayerStore = create<TextLayerState & TextLayerActions>()((set, get) => ({
  isVisible: false,
  pageTextItems: new Map(),
  isExtracting: false,

  toggle: () => set(state => ({ isVisible: !state.isVisible })),
  show: () => set({ isVisible: true }),
  hide: () => set({ isVisible: false }),

  setPageTextItems: (pageIndex, items) => {
    const { pageTextItems } = get();
    const next = new Map(pageTextItems);
    next.set(pageIndex, items);
    set({ pageTextItems: next });
  },

  getPageTextItems: (pageIndex) => {
    return get().pageTextItems.get(pageIndex);
  },

  setExtracting: (extracting) => set({ isExtracting: extracting }),

  clearCache: () => set({ pageTextItems: new Map() }),
}));
