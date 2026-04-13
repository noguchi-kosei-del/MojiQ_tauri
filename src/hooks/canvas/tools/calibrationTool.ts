import type { Point } from '../../../types';
import { useCalibrationStore } from '../../../stores/calibrationStore';
import type { ToolHandler, ToolContext } from '../toolContext';
import { IDLE } from '../interactionState';

// 縮尺合わせ (calibration) モードの pointer handler。
// - 1 回目 pointerdown: 開始点を設定してドラッグ開始
// - pointermove: プレビュー終点を更新 (Shift で 45 度スナップ)
// - pointerup: 十分な距離 (>10px) があれば終点を確定、短すぎるとリセット
// - 2 回目 pointerdown (pointerup で確定せず pending 中): 終点を確定
const applyEnd = (ctx: ToolContext, point: Point): void => {
  const calibState = useCalibrationStore.getState();
  const start = calibState.calibrationStart;
  if (!start) return;

  const distance = Math.sqrt(
    Math.pow(point.x - start.x, 2) + Math.pow(point.y - start.y, 2),
  );
  if (distance > 10) {
    calibState.setCalibrationEnd(point);
  } else {
    // 短すぎる場合はリセット
    calibState.setCalibrationStart(null);
    calibState.setCalibrationEnd(null);
  }
  ctx.legacySetters.setIsCalibrating(false);
  ctx.legacyRefs.calibrationPreviewEndRef.current = null;
  ctx.setInteractionState(IDLE);
  ctx.redraw();
};

export const calibrationTool: ToolHandler = {
  onPointerDown(ctx, point) {
    const calibState = useCalibrationStore.getState();
    const state = ctx.getInteractionState();

    if (state.kind !== 'calibrating') {
      // 最初のクリック: 開始点を設定してドラッグ開始
      calibState.setCalibrationStart(point);
      ctx.legacyRefs.calibrationPreviewEndRef.current = point;
      ctx.legacySetters.setIsCalibrating(true);
      ctx.setInteractionState({
        kind: 'calibrating',
        start: point,
        end: point,
      });
      ctx.redraw();
      return;
    }

    // 2 回目のクリック: 終点を確定
    const end = ctx.legacyRefs.calibrationPreviewEndRef.current ?? point;
    applyEnd(ctx, end);
  },

  onPointerMove(ctx, point, e) {
    const state = ctx.getInteractionState();
    if (state.kind !== 'calibrating') return;

    const calibState = useCalibrationStore.getState();
    if (!calibState.calibrationStart) return;

    // Shift スナップ
    const end = e.shiftKey
      ? ctx.snapLineEndpoint(calibState.calibrationStart, point)
      : point;

    ctx.legacyRefs.calibrationPreviewEndRef.current = end;
    ctx.setInteractionState({
      kind: 'calibrating',
      start: calibState.calibrationStart,
      end,
    });
    ctx.redraw();
  },

  onPointerUp(ctx) {
    const state = ctx.getInteractionState();
    if (state.kind !== 'calibrating') return;

    const end = ctx.legacyRefs.calibrationPreviewEndRef.current;
    if (!end) return;
    applyEnd(ctx, end);
  },

  onToolDeactivate(ctx) {
    // ツール切替や calibration モード終了時: 進行中の状態をクリア
    ctx.legacyRefs.calibrationPreviewEndRef.current = null;
    ctx.legacySetters.setIsCalibrating(false);
    ctx.setInteractionState(IDLE);
  },
};
