import type { StampType } from '../../../types';
import type { ToolHandler } from '../toolContext';
import { IDLE } from '../interactionState';

// 引出線対応スタンプ (ドラッグで引出線付き配置可能)
const LEADER_LINE_STAMPS: ReadonlySet<StampType> = new Set<StampType>([
  'toruStamp',
  'torutsumeStamp',
  'torumamaStamp',
  'zenkakuakiStamp',
  'hankakuakiStamp',
  'yonbunakiStamp',
  'kaigyouStamp',
  'tojiruStamp',
  'hirakuStamp',
]);

// 引出線の最小距離。これより短い場合は引出線なしで配置する。
const MIN_LEADER_DISTANCE = 10;

// stamp ツール: currentStampType に応じて 12 種のスタンプを配置する。
// - 引出線対応スタンプ: ドラッグで引出線付き、ドラッグなし (クリック) で引出線なし
// - 非対応スタンプ (doneStamp / rubyStamp / komojiStamp): クリックで即配置
export const stampTool: ToolHandler = {
  onPointerDown(ctx, point) {
    const stampType = ctx.getCurrentStampType();
    if (!stampType) return;

    if (LEADER_LINE_STAMPS.has(stampType)) {
      // 引出線描画モードを開始
      ctx.legacySetters.setIsDrawingStampLeader(true);
      ctx.legacyRefs.stampStartRef.current = point;
      ctx.legacyRefs.currentStampEndRef.current = point;
      ctx.setInteractionState({
        kind: 'drawing-stamp-leader',
        stampType,
        start: point,
        end: point,
      });
      return;
    }

    // 引出線非対応スタンプはクリックで即配置
    ctx.addStamp(point);
    ctx.redraw();
  },

  onPointerMove(ctx, point) {
    const state = ctx.getInteractionState();
    if (state.kind !== 'drawing-stamp-leader') return;

    ctx.legacyRefs.currentStampEndRef.current = point;
    ctx.setInteractionState({ ...state, end: point });
    ctx.redraw();
  },

  onPointerUp(ctx) {
    const state = ctx.getInteractionState();
    if (state.kind !== 'drawing-stamp-leader') return;

    const start = ctx.legacyRefs.stampStartRef.current;
    const end = ctx.legacyRefs.currentStampEndRef.current;
    if (!start || !end) {
      ctx.legacySetters.setIsDrawingStampLeader(false);
      ctx.legacyRefs.stampStartRef.current = null;
      ctx.legacyRefs.currentStampEndRef.current = null;
      ctx.setInteractionState(IDLE);
      return;
    }

    const distance = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2),
    );

    if (distance > MIN_LEADER_DISTANCE) {
      // 引出線付きでスタンプを配置 (終点がスタンプ位置、始点が引出線先端)
      ctx.addStamp(end, { start, end });
    } else {
      // 引出線なしでスタンプを配置 (クリックと同じ)
      ctx.addStamp(start);
    }

    ctx.legacySetters.setIsDrawingStampLeader(false);
    ctx.legacyRefs.stampStartRef.current = null;
    ctx.legacyRefs.currentStampEndRef.current = null;
    ctx.setInteractionState(IDLE);
    ctx.redraw();
  },

  onToolDeactivate(ctx) {
    ctx.legacyRefs.stampStartRef.current = null;
    ctx.legacyRefs.currentStampEndRef.current = null;
    ctx.legacySetters.setIsDrawingStampLeader(false);
    ctx.setInteractionState(IDLE);
  },
};
