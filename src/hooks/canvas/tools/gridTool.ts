import type { Point } from '../../../types';
import { useCalibrationStore, MM_PER_PT } from '../../../stores/calibrationStore';
import { useGridStore } from '../../../stores/gridStore';
import { useDrawingStore } from '../../../stores/drawingStore';
import type { ToolHandler } from '../toolContext';
import { IDLE } from '../interactionState';

// 写植グリッド (grid / sampleGrid モード) の pointer handler。
// - 既存グリッドクリック: そのグリッドを pendingGrid 化して移動開始
// - pendingGrid 内クリック: 移動開始
// - pendingGrid 外クリック: 現在の pendingGrid を確定し、新規グリッド作成を開始
// - pendingGrid なし: 新規グリッド作成をドラッグで開始

type GridLike = {
  startPos: { x: number; y: number };
  lines: number;
  chars: number;
  ptSize: number;
  writingMode: 'horizontal' | 'vertical';
};

function isPointInsideGrid(point: Point, grid: GridLike, pixelsPerMm: number): boolean {
  const cellSize = grid.ptSize * MM_PER_PT * pixelsPerMm;
  const isHorizontal = grid.writingMode === 'horizontal';
  const cols = isHorizontal ? grid.chars : grid.lines;
  const rows = isHorizontal ? grid.lines : grid.chars;
  const width = cols * cellSize;
  const height = rows * cellSize;
  return (
    point.x >= grid.startPos.x &&
    point.x <= grid.startPos.x + width &&
    point.y >= grid.startPos.y &&
    point.y <= grid.startPos.y + height
  );
}

export const gridTool: ToolHandler = {
  onPointerDown(ctx, point) {
    const gState = useGridStore.getState();
    const { pixelsPerMm } = useCalibrationStore.getState();
    const drawingPage = useDrawingStore.getState().currentPage;

    // ページに配置済みのグリッド内部をクリックした場合、そのグリッドを選択して移動開始
    const pageGrids = gState.getPageGrids(drawingPage);
    for (let i = pageGrids.length - 1; i >= 0; i--) {
      const grid = pageGrids[i];
      if (isPointInsideGrid(point, grid, pixelsPerMm)) {
        gState.removeGrid(drawingPage, i);
        gState.setPendingGrid(grid);
        gState.setGridAdjusting(true);
        ctx.legacyRefs.gridDragStartRef.current = {
          gridStartPos: { ...grid.startPos },
          mousePos: point,
        };
        (document.activeElement as HTMLElement)?.blur?.();
        ctx.legacySetters.setIsDraggingGrid(true);
        ctx.setInteractionState({
          kind: 'dragging-grid',
          gridStartPos: { ...grid.startPos },
          mousePos: point,
        });
        ctx.redraw();
        return;
      }
    }

    if (gState.pendingGrid) {
      const isInside = isPointInsideGrid(point, gState.pendingGrid, pixelsPerMm);
      if (isInside) {
        // グリッド内クリック: 移動開始
        ctx.legacyRefs.gridDragStartRef.current = {
          gridStartPos: { ...gState.pendingGrid.startPos },
          mousePos: point,
        };
        (document.activeElement as HTMLElement)?.blur?.();
        ctx.legacySetters.setIsDraggingGrid(true);
        ctx.setInteractionState({
          kind: 'dragging-grid',
          gridStartPos: { ...gState.pendingGrid.startPos },
          mousePos: point,
        });
        return;
      }
      // グリッド外クリック: グリッドを確定して新規作成開始
      gState.saveStateForUndo(drawingPage);
      gState.addGrid(drawingPage, gState.pendingGrid);
      gState.setPendingGrid(null);
      ctx.legacyRefs.gridDrawStartRef.current = point;
      ctx.legacyRefs.gridDrawEndRef.current = point;
      (document.activeElement as HTMLElement)?.blur?.();
      ctx.legacySetters.setIsDrawingGrid(true);
      ctx.setInteractionState({ kind: 'drawing-grid', start: point, end: point });
      ctx.redraw();
      return;
    }

    // pendingGrid なし: 新規グリッドをドラッグで作成開始
    ctx.legacyRefs.gridDrawStartRef.current = point;
    ctx.legacyRefs.gridDrawEndRef.current = point;
    (document.activeElement as HTMLElement)?.blur?.();
    ctx.legacySetters.setIsDrawingGrid(true);
    ctx.setInteractionState({ kind: 'drawing-grid', start: point, end: point });
  },

  onPointerMove(ctx, point) {
    const state = ctx.getInteractionState();

    if (state.kind === 'drawing-grid') {
      ctx.legacyRefs.gridDrawEndRef.current = point;
      ctx.setInteractionState({ ...state, end: point });
      ctx.redraw();
      return;
    }

    if (state.kind === 'dragging-grid') {
      const gState = useGridStore.getState();
      if (!gState.pendingGrid) return;
      const dragStart = ctx.legacyRefs.gridDragStartRef.current;
      if (!dragStart) return;

      const dx = point.x - dragStart.mousePos.x;
      const dy = point.y - dragStart.mousePos.y;
      const newStartX = dragStart.gridStartPos.x + dx;
      const newStartY = dragStart.gridStartPos.y + dy;
      const { pixelsPerMm } = useCalibrationStore.getState();
      const grid = gState.pendingGrid;
      const cellSize = grid.ptSize * MM_PER_PT * pixelsPerMm;
      const isHorizontal = grid.writingMode === 'horizontal';
      const w = (isHorizontal ? grid.chars : grid.lines) * cellSize;
      const h = (isHorizontal ? grid.lines : grid.chars) * cellSize;
      gState.updatePendingGrid({
        startPos: { x: newStartX, y: newStartY },
        centerPos: { x: newStartX + w / 2, y: newStartY + h / 2 },
      });
      ctx.redraw();
      return;
    }
  },

  onPointerUp(ctx, point) {
    const state = ctx.getInteractionState();

    if (state.kind === 'drawing-grid') {
      const gState = useGridStore.getState();
      const startPoint = ctx.legacyRefs.gridDrawStartRef.current;
      if (!startPoint) {
        ctx.legacySetters.setIsDrawingGrid(false);
        ctx.setInteractionState(IDLE);
        return;
      }

      const x = Math.min(startPoint.x, point.x);
      const y = Math.min(startPoint.y, point.y);
      const width = Math.abs(point.x - startPoint.x);
      const height = Math.abs(point.y - startPoint.y);

      // 最小サイズ (5px 以上) でグリッド作成
      if (width > 5 && height > 5) {
        const { pixelsPerMm } = useCalibrationStore.getState();
        const drawingPage = useDrawingStore.getState().currentPage;

        let numLines: number;
        let numChars: number;
        let textData: string;
        if (gState.gridMode === 'grid') {
          numLines = 1;
          numChars = 1;
          textData = '';
        } else {
          const { lines, chars } = gState.calculateGridFromText(gState.sampleText);
          numLines = Math.max(1, lines);
          numChars = Math.max(1, chars);
          textData = gState.sampleText;
        }

        const isHorizontal = gState.writingMode === 'horizontal';
        const cols = isHorizontal ? numChars : numLines;
        const rows = isHorizontal ? numLines : numChars;
        const cellSize = Math.min(width / cols, height / rows);
        const ptSize = Math.round((cellSize / pixelsPerMm / MM_PER_PT) * 10) / 10;

        const actualWidth = cols * cellSize;
        const actualHeight = rows * cellSize;

        gState.saveStateForUndo(drawingPage);

        const grid = {
          id: `grid-${Date.now()}`,
          startPos: { x, y },
          centerPos: { x: x + actualWidth / 2, y: y + actualHeight / 2 },
          lines: numLines,
          chars: numChars,
          ptSize: Math.max(1, ptSize),
          textData,
          writingMode: gState.writingMode,
          isLocked: false,
          constraint: {
            w: width * 0.75,
            h: height * 0.75,
            rawW: width,
            rawH: height,
          },
        };
        gState.setPendingGrid(grid);
        gState.setGridAdjusting(true);
      }

      ctx.legacySetters.setIsDrawingGrid(false);
      ctx.legacyRefs.gridDrawStartRef.current = null;
      ctx.legacyRefs.gridDrawEndRef.current = null;
      ctx.setInteractionState(IDLE);
      ctx.redraw();
      return;
    }

    if (state.kind === 'dragging-grid') {
      ctx.legacySetters.setIsDraggingGrid(false);
      ctx.legacyRefs.gridDragStartRef.current = null;
      ctx.setInteractionState(IDLE);
      ctx.redraw();
      return;
    }
  },

  onToolDeactivate(ctx) {
    ctx.legacyRefs.gridDrawStartRef.current = null;
    ctx.legacyRefs.gridDrawEndRef.current = null;
    ctx.legacyRefs.gridDragStartRef.current = null;
    ctx.legacySetters.setIsDrawingGrid(false);
    ctx.legacySetters.setIsDraggingGrid(false);
    ctx.setInteractionState(IDLE);
  },
};
