import { STROKE_LIMITS } from '../../../constants/loadingLimits';
import type { ToolHandler } from '../toolContext';
import { IDLE } from '../interactionState';

// pen / marker / eraser ツール。
// - pen / marker: ストロークのポイントを貯めて pointerup で addStroke
// - eraser: pointerdown / pointermove でその場で eraseAt を呼ぶ (ストロークは作らない)
// ストロークポイント数が STROKE_LIMITS.MAX_POINTS に達したら自動終了する。
//
// 注意: 旧 useCanvas の redrawCanvas は isDrawing フラグ + currentStrokeRef.current を
// 読んで in-progress ストロークをプレビュー描画している。Phase 1 では両者を dual-write する
// (legacySetters.setIsDrawing + legacyRefs.currentStrokeRef を書く) ことでプレビューを維持する。
export const strokeTool: ToolHandler = {
  onPointerDown(ctx, point) {
    const tool = ctx.getTool();

    ctx.legacySetters.setIsDrawing(true);
    ctx.legacyRefs.currentStrokeRef.current = [point];
    ctx.setInteractionState({ kind: 'drawing-stroke', points: [point] });

    if (tool === 'eraser') {
      ctx.eraseAt(point, ctx.getStrokeWidth() * 2);
      ctx.redraw();
    }
  },

  onPointerMove(ctx, point) {
    const state = ctx.getInteractionState();
    if (state.kind !== 'drawing-stroke') return;

    const tool = ctx.getTool();

    if (tool === 'eraser') {
      ctx.eraseAt(point, ctx.getStrokeWidth() * 2);
      ctx.redraw();
      return;
    }

    // ストロークポイント数制限チェック
    if (ctx.legacyRefs.currentStrokeRef.current.length >= STROKE_LIMITS.MAX_POINTS) {
      console.warn('[MojiQ] ストロークポイント数が上限に達しました。自動終了します。');
      const finalPoints = ctx.legacyRefs.currentStrokeRef.current;
      if (finalPoints.length > 1) {
        ctx.addStroke({
          points: [...finalPoints],
          color: ctx.getColor(),
          width: ctx.getStrokeWidth(),
          isMarker: tool === 'marker',
          opacity: tool === 'marker' ? 0.3 : undefined,
        });
      }
      ctx.legacyRefs.currentStrokeRef.current = [];
      ctx.legacySetters.setIsDrawing(false);
      ctx.setInteractionState(IDLE);
      ctx.redraw();
      return;
    }

    ctx.legacyRefs.currentStrokeRef.current.push(point);
    ctx.redraw();
  },

  onPointerUp(ctx) {
    const state = ctx.getInteractionState();
    if (state.kind !== 'drawing-stroke') return;

    const tool = ctx.getTool();
    ctx.legacySetters.setIsDrawing(false);

    // pen / marker のみストロークを addStroke で確定 (eraser は確定不要)
    const points = ctx.legacyRefs.currentStrokeRef.current;
    if ((tool === 'pen' || tool === 'marker') && points.length > 1) {
      ctx.addStroke({
        points: [...points],
        color: ctx.getColor(),
        width: ctx.getStrokeWidth(),
        isMarker: tool === 'marker',
        opacity: tool === 'marker' ? 0.3 : undefined,
      });
    }

    ctx.legacyRefs.currentStrokeRef.current = [];
    ctx.setInteractionState(IDLE);
    ctx.redraw();
  },

  onToolDeactivate(ctx) {
    // ツール切替中にストローク描画中だった場合、破棄する (確定しない)。
    // 旧挙動は「暗黙に上書きされて消える」だったが、新挙動は明示的に破棄。
    ctx.legacyRefs.currentStrokeRef.current = [];
    ctx.legacySetters.setIsDrawing(false);
    ctx.setInteractionState(IDLE);
  },
};
