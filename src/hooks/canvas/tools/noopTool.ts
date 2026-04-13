import type { ToolHandler } from '../toolContext';

// pan ツール用の空ハンドラ。pan 自体の挙動は DrawingCanvas コンポーネント側で
// 処理されるため、useCanvas 内の pointer handler は何もしない。
export const noopTool: ToolHandler = {
  onPointerDown() {
    // no-op
  },
  onPointerMove() {
    // no-op
  },
  onPointerUp() {
    // no-op
  },
};
