import type { MutableRefObject } from 'react';
import type { Point, ToolType, StampType, Shape } from '../../types';
import { useDrawingStore } from '../../stores/drawingStore';
import type { InteractionState } from './interactionState';

// 旧 useCanvas.ts の useState/useRef と共存するためのブリッジ。
// Phase 1 では新ハンドラと旧ハンドラが共存するため、ref を双方から読み書きできるように
// MutableRefObject をそのまま借りる。将来 InteractionState へ完全吸収した段階で削除する。
export interface LegacyRefs {
  shapeStartRef: MutableRefObject<Point | null>;
  currentShapeEndRef: MutableRefObject<Point | null>;
  currentStrokeRef: MutableRefObject<Point[]>;
  stampStartRef: MutableRefObject<Point | null>;
  currentStampEndRef: MutableRefObject<Point | null>;
  gridDrawStartRef: MutableRefObject<Point | null>;
  gridDrawEndRef: MutableRefObject<Point | null>;
  gridDragStartRef: MutableRefObject<{ gridStartPos: Point; mousePos: Point } | null>;
  calibrationPreviewEndRef: MutableRefObject<Point | null>;
}

// 新ハンドラ (ToolHandler) が旧 useCanvas の useState setter を叩くためのブリッジ。
// Phase 1 では旧 handler との整合性を保つため、setter を ToolContext 経由で借りる。
export interface LegacySetters {
  setIsDrawing: (v: boolean) => void;
  setIsDrawingShape: (v: boolean) => void;
  setIsDrawingStampLeader: (v: boolean) => void;
  setIsCalibrating: (v: boolean) => void;
  setIsDrawingGrid: (v: boolean) => void;
  setIsDraggingGrid: (v: boolean) => void;
  // annotated shape の phase 2 遷移用
  setAnnotationState: (v: 0 | 1 | 2) => void;
  setIsDrawingLeader: (v: boolean) => void;
  setShowAnnotationModal: (v: boolean) => void;
}

// 旧 handler 側が保持している「phase 2 遷移に必要な ref」。shapeTool から書き込むだけなので
// write-only で良い。
export interface Phase2Refs {
  pendingAnnotatedShapeRef: MutableRefObject<{
    shapeId: string;
    shapeType: 'rect' | 'ellipse' | 'line' | 'doubleArrow';
    startPos: Point;
    endPos: Point;
  } | null>;
  leaderStartRef: MutableRefObject<Point | null>;
  leaderEndRef: MutableRefObject<Point | null>;
}

// 各 ToolHandler が受け取る実行環境。getter ベースで最新のストア値を取得するため、
// useCallback のクロージャが古くても stale closure にならないのが利点。
export interface ToolContext {
  // ===== Interaction State =====
  getInteractionState: () => InteractionState;
  setInteractionState: (next: InteractionState) => void;

  // ===== Store actions (遅延取得: 呼び出しのたびに useDrawingStore.getState() を叩く) =====
  addStroke: (
    stroke: Parameters<ReturnType<typeof useDrawingStore.getState>['addStroke']>[0],
  ) => void;
  addShape: (
    shape: Parameters<ReturnType<typeof useDrawingStore.getState>['addShape']>[0],
  ) => Shape | void;
  addStamp: (point: Point, leaderLine?: { start: Point; end: Point }) => void;
  eraseAt: (point: Point, radius: number) => void;
  saveToHistory: () => void;
  getAllShapes: () => Shape[];

  // ===== 副作用 =====
  redraw: () => void;
  getPointerPosition: (e: PointerEvent) => Point;

  // ===== 描画設定 (呼び出しのたびに取得) =====
  getTool: () => ToolType;
  getColor: () => string;
  getStrokeWidth: () => number;
  getCurrentStampType: () => StampType | null;

  // ===== スケール系 =====
  getDisplayScale: () => number;
  getBaseScale: () => number;

  // ===== 図形ヘルパー (useCanvas 側の実装を借りる) =====
  snapLineEndpoint: (start: Point, end: Point) => Point;
  getLeaderStartPos: (
    shapeType: string,
    startPos: Point,
    endPos: Point,
    targetPos: Point,
  ) => Point;

  // ===== Legacy bridging (Phase 1 のみ) =====
  legacyRefs: LegacyRefs;
  legacySetters: LegacySetters;
  phase2Refs: Phase2Refs;
}

// ToolContext の builder。useCanvas.ts の hook 内で 1 度だけ呼ぶ想定。
// 返り値は useRef に載せて不変参照として保持する。
export interface ToolContextBuilderArgs {
  interactionStateRef: MutableRefObject<InteractionState>;
  setInteractionKind: (kind: InteractionState['kind']) => void;
  redraw: () => void;
  getPointerPosition: (e: PointerEvent) => Point;
  snapLineEndpoint: (start: Point, end: Point) => Point;
  getLeaderStartPos: (
    shapeType: string,
    startPos: Point,
    endPos: Point,
    targetPos: Point,
  ) => Point;
  getDisplayScale: () => number;
  getBaseScale: () => number;
  legacyRefs: LegacyRefs;
  legacySetters: LegacySetters;
  phase2Refs: Phase2Refs;
}

export function createToolContext(args: ToolContextBuilderArgs): ToolContext {
  return {
    getInteractionState: () => args.interactionStateRef.current,
    setInteractionState: (next) => {
      args.interactionStateRef.current = next;
      args.setInteractionKind(next.kind);
    },

    // Store アクション: 呼び出しのたびに最新の store を取得する
    addStroke: (stroke) => useDrawingStore.getState().addStroke(stroke),
    addShape: (shape) => useDrawingStore.getState().addShape(shape),
    addStamp: (point, leaderLine) =>
      useDrawingStore.getState().addStamp(point, leaderLine),
    eraseAt: (point, radius) => useDrawingStore.getState().eraseAt(point, radius),
    saveToHistory: () => useDrawingStore.getState().saveToHistory(),
    getAllShapes: () => useDrawingStore.getState().getAllShapes(),

    redraw: args.redraw,
    getPointerPosition: args.getPointerPosition,

    // 描画設定
    getTool: () => useDrawingStore.getState().tool,
    getColor: () => useDrawingStore.getState().color,
    getStrokeWidth: () => useDrawingStore.getState().strokeWidth,
    getCurrentStampType: () => useDrawingStore.getState().currentStampType,

    getDisplayScale: args.getDisplayScale,
    getBaseScale: args.getBaseScale,

    snapLineEndpoint: args.snapLineEndpoint,
    getLeaderStartPos: args.getLeaderStartPos,

    legacyRefs: args.legacyRefs,
    legacySetters: args.legacySetters,
    phase2Refs: args.phase2Refs,
  };
}

// ToolHandler: 各ツールの pointer ハンドラのインターフェース。
export interface ToolHandler {
  onPointerDown(ctx: ToolContext, point: Point, e: PointerEvent): void;
  onPointerMove(ctx: ToolContext, point: Point, e: PointerEvent): void;
  onPointerUp(ctx: ToolContext, point: Point, e: PointerEvent): void;
  onPointerCancel?(ctx: ToolContext, e: PointerEvent): void;
  onKeyDown?(ctx: ToolContext, e: KeyboardEvent): void;
  // ツール切替時やアンマウント時のクリーンアップ。冪等であること。
  onToolDeactivate?(ctx: ToolContext): void;
}
