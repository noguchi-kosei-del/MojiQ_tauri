import { create } from 'zustand';
import { MM_PER_PT } from './calibrationStore';

// 書き方向
export type WritingMode = 'horizontal' | 'vertical';

// 余白密度
export type DensityMode = 'loose' | 'standard' | 'tight' | 'none';

// グリッドの状態
export interface GridState {
  id: string;
  startPos: { x: number; y: number };
  centerPos: { x: number; y: number };
  lines: number;
  chars: number;
  ptSize: number;
  textData: string;
  writingMode: WritingMode;
  isLocked: boolean;
  constraint?: {
    w: number;
    h: number;
    rawW: number;
    rawH: number;
  };
}

// ページごとのグリッド管理
interface PageGrids {
  grids: GridState[];
  selectedIndex: number;
}

interface GridStoreState {
  // グリッドモード
  isGridMode: boolean;
  isGridAdjusting: boolean;

  // 作成中のグリッド
  pendingGrid: GridState | null;

  // ページごとのグリッド
  pageGrids: Map<number, PageGrids>;

  // 設定
  writingMode: WritingMode;
  density: DensityMode;
  sampleText: string;

  // ダッシュボード表示
  showDashboard: boolean;
}

interface GridStoreActions {
  // モード
  enterGridMode: () => void;
  exitGridMode: () => void;
  setGridAdjusting: (value: boolean) => void;

  // 作成中のグリッド
  setPendingGrid: (grid: GridState | null) => void;
  updatePendingGrid: (updates: Partial<GridState>) => void;

  // グリッド管理
  addGrid: (pageNumber: number, grid: GridState) => void;
  updateGrid: (pageNumber: number, gridIndex: number, updates: Partial<GridState>) => void;
  removeGrid: (pageNumber: number, gridIndex: number) => void;
  selectGrid: (pageNumber: number, gridIndex: number) => void;
  getPageGrids: (pageNumber: number) => GridState[];
  getSelectedGrid: (pageNumber: number) => GridState | null;
  clearPageGrids: (pageNumber: number) => void;

  // 設定
  setWritingMode: (mode: WritingMode) => void;
  setDensity: (density: DensityMode) => void;
  setSampleText: (text: string) => void;

  // ダッシュボード
  setShowDashboard: (show: boolean) => void;

  // グリッド計算
  calculateGridFromText: (text: string) => { lines: number; chars: number };
  calculateCellSize: (ptSize: number, pixelsPerMm: number) => number;
  calculateGridDimensions: (
    lines: number,
    chars: number,
    cellSize: number,
    writingMode: WritingMode
  ) => { width: number; height: number };

  // グリッドの再計算
  recalculateGrid: (
    grid: GridState,
    pixelsPerMm: number,
    density: DensityMode
  ) => GridState;
}

// ユニークIDを生成
const generateGridId = () => `grid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// デフォルトのグリッド状態を作成
export const createDefaultGrid = (
  centerPos: { x: number; y: number },
  lines: number,
  chars: number,
  ptSize: number,
  writingMode: WritingMode,
  textData: string = ''
): GridState => {
  const id = generateGridId();
  return {
    id,
    startPos: { x: centerPos.x, y: centerPos.y },
    centerPos,
    lines,
    chars,
    ptSize,
    textData,
    writingMode,
    isLocked: false,
  };
};

export const useGridStore = create<GridStoreState & GridStoreActions>()((set, get) => ({
  // 初期状態
  isGridMode: false,
  isGridAdjusting: false,
  pendingGrid: null,
  pageGrids: new Map(),
  writingMode: 'vertical',
  density: 'standard',
  sampleText: '',
  showDashboard: false,

  // モード
  enterGridMode: () => {
    set({ isGridMode: true });
  },

  exitGridMode: () => {
    set({
      isGridMode: false,
      isGridAdjusting: false,
      pendingGrid: null,
      showDashboard: false,
    });
  },

  setGridAdjusting: (value) => {
    set({ isGridAdjusting: value, showDashboard: value });
  },

  // 作成中のグリッド
  setPendingGrid: (grid) => {
    set({ pendingGrid: grid, showDashboard: grid !== null });
  },

  updatePendingGrid: (updates) => {
    const { pendingGrid } = get();
    if (pendingGrid) {
      set({ pendingGrid: { ...pendingGrid, ...updates } });
    }
  },

  // グリッド管理
  addGrid: (pageNumber, grid) => {
    const { pageGrids } = get();
    const newPageGrids = new Map(pageGrids);
    const pageData = newPageGrids.get(pageNumber) || { grids: [], selectedIndex: -1 };
    pageData.grids.push(grid);
    pageData.selectedIndex = pageData.grids.length - 1;
    newPageGrids.set(pageNumber, pageData);
    set({ pageGrids: newPageGrids });
  },

  updateGrid: (pageNumber, gridIndex, updates) => {
    const { pageGrids } = get();
    const newPageGrids = new Map(pageGrids);
    const pageData = newPageGrids.get(pageNumber);
    if (pageData && pageData.grids[gridIndex]) {
      pageData.grids[gridIndex] = { ...pageData.grids[gridIndex], ...updates };
      newPageGrids.set(pageNumber, { ...pageData });
      set({ pageGrids: newPageGrids });
    }
  },

  removeGrid: (pageNumber, gridIndex) => {
    const { pageGrids } = get();
    const newPageGrids = new Map(pageGrids);
    const pageData = newPageGrids.get(pageNumber);
    if (pageData) {
      pageData.grids.splice(gridIndex, 1);
      if (pageData.selectedIndex >= pageData.grids.length) {
        pageData.selectedIndex = pageData.grids.length - 1;
      }
      newPageGrids.set(pageNumber, { ...pageData });
      set({ pageGrids: newPageGrids });
    }
  },

  selectGrid: (pageNumber, gridIndex) => {
    const { pageGrids } = get();
    const newPageGrids = new Map(pageGrids);
    const pageData = newPageGrids.get(pageNumber);
    if (pageData) {
      pageData.selectedIndex = gridIndex;
      newPageGrids.set(pageNumber, { ...pageData });
      set({ pageGrids: newPageGrids });
    }
  },

  getPageGrids: (pageNumber) => {
    const { pageGrids } = get();
    return pageGrids.get(pageNumber)?.grids || [];
  },

  getSelectedGrid: (pageNumber) => {
    const { pageGrids } = get();
    const pageData = pageGrids.get(pageNumber);
    if (pageData && pageData.selectedIndex >= 0) {
      return pageData.grids[pageData.selectedIndex] || null;
    }
    return null;
  },

  clearPageGrids: (pageNumber) => {
    const { pageGrids } = get();
    const newPageGrids = new Map(pageGrids);
    newPageGrids.delete(pageNumber);
    set({ pageGrids: newPageGrids });
  },

  // 設定
  setWritingMode: (mode) => {
    set({ writingMode: mode });
    // 作成中のグリッドがあれば更新
    const { pendingGrid } = get();
    if (pendingGrid) {
      set({ pendingGrid: { ...pendingGrid, writingMode: mode } });
    }
  },

  setDensity: (density) => {
    set({ density });
  },

  setSampleText: (text) => {
    set({ sampleText: text });
  },

  // ダッシュボード
  setShowDashboard: (show) => {
    set({ showDashboard: show });
  },

  // グリッド計算
  calculateGridFromText: (text) => {
    if (!text || text.trim().length === 0) {
      return { lines: 1, chars: 1 };
    }

    const halfWidthSymbols = ['!', '?', '？', '！'];
    const textLines = text.split(/\r\n|\n/);
    const lines = textLines.length;
    let maxChars = 1;

    for (const line of textLines) {
      let tokenCount = 0;
      let i = 0;

      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        // 半角記号ペア（!!など）を1トークンとして計算
        if (halfWidthSymbols.includes(char) && nextChar && halfWidthSymbols.includes(nextChar)) {
          tokenCount++;
          i += 2;
        } else {
          tokenCount++;
          i++;
        }
      }
      if (tokenCount > maxChars) maxChars = tokenCount;
    }

    return { lines, chars: maxChars };
  },

  calculateCellSize: (ptSize, pixelsPerMm) => {
    return ptSize * MM_PER_PT * pixelsPerMm;
  },

  calculateGridDimensions: (lines, chars, cellSize, writingMode) => {
    const isHorizontal = writingMode === 'horizontal';
    const width = (isHorizontal ? chars : lines) * cellSize;
    const height = (isHorizontal ? lines : chars) * cellSize;
    return { width, height };
  },

  recalculateGrid: (grid, pixelsPerMm, density) => {
    if (!grid.constraint) return grid;

    const { rawW, rawH } = grid.constraint;

    // 密度に基づいて余白比を設定
    let marginRatio = 0.25;
    if (density === 'loose') marginRatio = 0.35;
    if (density === 'tight') marginRatio = 0.15;
    if (density === 'none') marginRatio = 0.0;

    const safeW = rawW * (1 - marginRatio);
    const safeH = rawH * (1 - marginRatio);

    const isHorizontal = grid.writingMode === 'horizontal';
    const mainCount = isHorizontal ? grid.lines : grid.chars;
    const crossCount = isHorizontal ? grid.chars : grid.lines;
    const mainDim = isHorizontal ? safeH : safeW;
    const crossDim = isHorizontal ? safeW : safeH;

    // 両方向に収まるセルサイズを計算
    const newCellSize = Math.min(mainDim / mainCount, crossDim / crossCount);

    // ピクセルからptサイズに変換
    const computedPt = newCellSize / pixelsPerMm / MM_PER_PT;
    const ptSize = Math.round(computedPt * 10) / 10;

    // グリッド位置を中央に調整
    const w = (isHorizontal ? grid.chars : grid.lines) * newCellSize;
    const h = (isHorizontal ? grid.lines : grid.chars) * newCellSize;
    const startPos = {
      x: grid.centerPos.x - w / 2,
      y: grid.centerPos.y - h / 2,
    };

    return {
      ...grid,
      ptSize,
      startPos,
    };
  },
}));
