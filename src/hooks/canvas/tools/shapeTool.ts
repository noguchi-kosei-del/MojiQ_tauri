import type { Point, ShapeType, Shape, ToolType } from '../../../types';
import { useDrawingStore } from '../../../stores/drawingStore';
import { usePresetStore } from '../../../stores/presetStore';
import type { ToolHandler, ToolContext } from '../toolContext';
import { IDLE } from '../interactionState';

// shapeTool: plain + annotated 14 種の図形ツールを統合して扱う。
//   plain: rect / ellipse / line / arrow / doubleArrow / semicircle / chevron / lshape / zshape / bracket
//   annotated: rectAnnotated / ellipseAnnotated / lineAnnotated / doubleArrowAnnotated
//
// annotated 変種は pointerup で旧ハンドラの「引出線フェーズ 2」に引き継ぐため、
// legacySetters + phase2Refs を経由して annotationState=2 / isDrawingLeader=true /
// pendingAnnotatedShapeRef / leaderStartRef / leaderEndRef をセットする。
//
// 共有 ref (shapeStartRef / currentShapeEndRef) は旧 redrawCanvas もプレビュー描画に
// 参照しているため、新ハンドラでも dual-write する。

const LINE_TYPES: ReadonlySet<ToolType> = new Set<ToolType>([
  'line',
  'lineAnnotated',
  'arrow',
  'doubleArrow',
  'doubleArrowAnnotated',
]);

const ANNOTATED_TYPES: ReadonlySet<ToolType> = new Set<ToolType>([
  'rectAnnotated',
  'ellipseAnnotated',
  'lineAnnotated',
  'doubleArrowAnnotated',
]);

function isLineType(tool: ToolType): boolean {
  return LINE_TYPES.has(tool);
}

function isAnnotatedType(tool: ToolType): boolean {
  return ANNOTATED_TYPES.has(tool);
}

// フォント指定の場合に使う fontLabel の位置計算
function calcFontLabel(
  tool: ToolType,
  startPoint: Point,
  endPoint: Point,
): Shape['fontLabel'] | undefined {
  if (tool !== 'rect') return undefined;
  const presetState = usePresetStore.getState();
  const selectedFont = presetState.selectedFont;
  if (!selectedFont) return undefined;

  const padding = 5;
  let textAlign: 'left' | 'right' = 'left';
  let textX = 0;
  let textY = 0;

  if (endPoint.x > startPoint.x) {
    textAlign = 'left';
    textX = endPoint.x + padding;
  } else {
    textAlign = 'right';
    textX = endPoint.x - padding;
  }

  if (endPoint.y > startPoint.y) {
    textY = endPoint.y + padding;
  } else {
    textY = endPoint.y - padding;
  }

  return {
    fontName: selectedFont.name,
    textX,
    textY,
    textAlign,
  };
}

// 校正記号ツールの追加プロパティを計算
function calcSymbolProps(
  tool: ToolType,
  startPoint: Point,
  endPoint: Point,
  ctrlKey: boolean,
): {
  orientation?: 'vertical' | 'horizontal';
  direction?: 0 | 1 | 2 | 3;
  flipped?: boolean;
  rotated?: boolean;
} {
  const w = Math.abs(endPoint.x - startPoint.x);
  const h = Math.abs(endPoint.y - startPoint.y);

  if (tool === 'semicircle') {
    return { orientation: h > w ? 'vertical' : 'horizontal' };
  }
  if (tool === 'chevron') {
    return { orientation: ctrlKey ? 'horizontal' : 'vertical' };
  }
  if (tool === 'lshape') {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    let direction: 0 | 1 | 2 | 3;
    if (dx >= 0 && dy >= 0) direction = 0;
    else if (dx < 0 && dy >= 0) direction = 1;
    else if (dx >= 0 && dy < 0) direction = 2;
    else direction = 3;
    return { direction };
  }
  if (tool === 'zshape') {
    return { rotated: ctrlKey };
  }
  if (tool === 'bracket') {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const orientation: 'vertical' | 'horizontal' = h > w ? 'vertical' : 'horizontal';
    const flipped = orientation === 'vertical' ? dx < 0 : dy >= 0;
    return { orientation, flipped };
  }
  return {};
}

// pointerup 時に annotated 変種なら phase 2 に引き継ぐ
function triggerAnnotationPhase2(
  ctx: ToolContext,
  tool: ToolType,
  startPoint: Point,
  endPoint: Point,
  mousePos: Point,
): void {
  const baseType = tool.replace('Annotated', '') as
    | 'rect'
    | 'ellipse'
    | 'line'
    | 'doubleArrow';

  // 最後に追加された図形の ID を取得 (旧実装と同じロジック)
  const state = useDrawingStore.getState();
  const currentPageState = state.pages[state.currentPage];
  const allShapes = currentPageState?.layers.flatMap((l) => l.shapes) || [];
  const lastShape = allShapes[allShapes.length - 1];

  ctx.phase2Refs.pendingAnnotatedShapeRef.current = {
    shapeId: lastShape?.id || '',
    shapeType: baseType,
    startPos: { x: startPoint.x, y: startPoint.y },
    endPos: { x: endPoint.x, y: endPoint.y },
  };
  ctx.legacySetters.setAnnotationState(2);
  ctx.legacySetters.setIsDrawingLeader(true);

  // 引出線の初期位置をマウス位置から設定
  const leaderStart = ctx.getLeaderStartPos(
    baseType,
    startPoint,
    endPoint,
    mousePos,
  );
  ctx.phase2Refs.leaderStartRef.current = leaderStart;
  ctx.phase2Refs.leaderEndRef.current = mousePos;
}

export const shapeTool: ToolHandler = {
  onPointerDown(ctx, point) {
    const tool = ctx.getTool();

    ctx.legacySetters.setIsDrawingShape(true);
    ctx.legacyRefs.shapeStartRef.current = point;
    ctx.legacyRefs.currentShapeEndRef.current = point;

    // annotated 変種は phase 1 フラグを立てる (pointerup で phase 2 に遷移)
    if (isAnnotatedType(tool)) {
      ctx.legacySetters.setAnnotationState(1);
    }

    ctx.setInteractionState({
      kind: 'drawing-shape',
      tool,
      start: point,
      end: point,
      isAnnotated: isAnnotatedType(tool),
    });
  },

  onPointerMove(ctx, point, e) {
    const state = ctx.getInteractionState();
    if (state.kind !== 'drawing-shape') return;

    const tool = ctx.getTool();
    const startRef = ctx.legacyRefs.shapeStartRef.current;
    if (!startRef) return;

    // line 系ツールでは Shift で 45 度スナップ
    const end =
      isLineType(tool) && e.shiftKey
        ? ctx.snapLineEndpoint(startRef, point)
        : point;

    ctx.legacyRefs.currentShapeEndRef.current = end;
    ctx.setInteractionState({ ...state, end });
    ctx.redraw();
  },

  onPointerUp(ctx, point, e) {
    const state = ctx.getInteractionState();
    if (state.kind !== 'drawing-shape') return;

    const tool = ctx.getTool();
    const startPoint = ctx.legacyRefs.shapeStartRef.current;
    const endPointRaw = ctx.legacyRefs.currentShapeEndRef.current;
    if (!startPoint || !endPointRaw) {
      ctx.legacySetters.setIsDrawingShape(false);
      ctx.legacyRefs.shapeStartRef.current = null;
      ctx.legacyRefs.currentShapeEndRef.current = null;
      ctx.setInteractionState(IDLE);
      ctx.redraw();
      return;
    }

    // line 系は pointerup 時点でも shift スナップ
    const endPoint =
      isLineType(tool) && e.shiftKey
        ? ctx.snapLineEndpoint(startPoint, endPointRaw)
        : endPointRaw;

    const w = Math.abs(endPoint.x - startPoint.x);
    const h = Math.abs(endPoint.y - startPoint.y);

    // 最小サイズチェック: 直線系は w または h が 2px 以上、それ以外は w と h が 5px 以上
    const isValidSize = isLineType(tool) ? w > 2 || h > 2 : w > 5 && h > 5;

    if (isValidSize) {
      const fontLabel = calcFontLabel(tool, startPoint, endPoint);
      const symbolProps = calcSymbolProps(tool, startPoint, endPoint, e.ctrlKey);

      ctx.addShape({
        type: tool as ShapeType,
        startPos: { x: startPoint.x, y: startPoint.y },
        endPos: { x: endPoint.x, y: endPoint.y },
        color: ctx.getColor(),
        width: ctx.getStrokeWidth(),
        fontLabel,
        orientation: symbolProps.orientation,
        direction: symbolProps.direction,
        flipped: symbolProps.flipped,
        rotated: symbolProps.rotated,
      });

      if (isAnnotatedType(tool)) {
        triggerAnnotationPhase2(ctx, tool, startPoint, endPoint, point);
      }
    }

    ctx.legacySetters.setIsDrawingShape(false);
    ctx.legacyRefs.shapeStartRef.current = null;
    ctx.legacyRefs.currentShapeEndRef.current = null;
    ctx.setInteractionState(IDLE);
    ctx.redraw();
  },

  onToolDeactivate(ctx) {
    // ツール切替中に図形描画中だった場合、破棄する
    ctx.legacyRefs.shapeStartRef.current = null;
    ctx.legacyRefs.currentShapeEndRef.current = null;
    ctx.legacySetters.setIsDrawingShape(false);
    // annotationState = 1 (描画中) の場合のみ 0 にリセット。
    // 2 (引出線フェーズ) は旧ハンドラ側で処理中なので触らない。
    ctx.setInteractionState(IDLE);
  },
};
