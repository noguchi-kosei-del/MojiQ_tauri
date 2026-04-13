import type { Point, ToolType, StampType } from '../../types';

// 本 PR (Phase 1) で扱う InteractionState の kind のみ列挙する。
// polyline / labeledRect / dragging-* / resizing / rotating 等は後続 PR で追加する。
export type InteractionState =
  | { kind: 'idle' }
  | { kind: 'drawing-stroke'; points: Point[] }
  | {
      kind: 'drawing-shape';
      tool: ToolType;
      start: Point;
      end: Point;
      isAnnotated: boolean;
    }
  | {
      kind: 'drawing-stamp-leader';
      stampType: StampType;
      start: Point;
      end: Point;
    }
  | { kind: 'calibrating'; start: Point; end: Point }
  | { kind: 'drawing-grid'; start: Point; end: Point }
  | {
      kind: 'dragging-grid';
      gridStartPos: Point;
      mousePos: Point;
    };

export type InteractionKind = InteractionState['kind'];

export const IDLE: InteractionState = { kind: 'idle' };

// 将来、各 tool handler の transition を reducer 経由に統一する際の骨組み。
// 本 PR では documenting 用途のみで、呼び出しは任意 (各 ToolHandler が直接 setState しても良い)。
export type InteractionAction =
  | { type: 'pointer-down'; point: Point; tool: ToolType }
  | { type: 'pointer-move'; point: Point }
  | { type: 'pointer-up'; point: Point }
  | { type: 'escape' }
  | { type: 'tool-change'; next: ToolType }
  | { type: 'reset' };

export function reduceInteraction(
  state: InteractionState,
  action: InteractionAction,
): InteractionState {
  if (action.type === 'reset' || action.type === 'tool-change') {
    return IDLE;
  }
  if (action.type === 'escape') {
    // Escape は基本的に全ての状態から idle に戻す。個別ツールの例外は
    // 各 ToolHandler の onKeyDown で処理する。
    return IDLE;
  }
  // pointer-* は ToolHandler 側で個別に遷移させるため、ここでは no-op。
  return state;
}
