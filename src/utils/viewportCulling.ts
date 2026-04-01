/**
 * ビューポートカリング — 画面外オブジェクトの描画スキップ（パフォーマンス最適化）
 * 旧MojiQ ver_2.11 の drawing-renderer.js より移植
 */
import { Point, Stroke, Shape, TextElement, ImageElement } from '../types';

/** ビューポート矩形（キャンバス座標系） */
export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** オブジェクトのバウンディングボックス */
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** カリング設定 */
const CULLING_MARGIN = 100; // ビューポート外マージン（px）

/**
 * スクロール領域とdisplayScaleからビューポート矩形を取得
 * キャンバス内部座標系に変換済み
 */
export function getVisibleViewport(
  scrollArea: HTMLDivElement,
  displayScale: number
): ViewportRect {
  const scrollLeft = scrollArea.scrollLeft;
  const scrollTop = scrollArea.scrollTop;
  const viewWidth = scrollArea.clientWidth;
  const viewHeight = scrollArea.clientHeight;

  // CSS座標からキャンバス内部座標に変換
  const scale = displayScale > 0 ? displayScale : 1;
  return {
    x: scrollLeft / scale,
    y: scrollTop / scale,
    width: viewWidth / scale,
    height: viewHeight / scale,
  };
}

/**
 * バウンディングボックスがビューポート（マージン込み）と交差するか
 */
function intersectsViewport(bounds: Bounds, viewport: ViewportRect): boolean {
  const margin = CULLING_MARGIN;
  const vx = viewport.x - margin;
  const vy = viewport.y - margin;
  const vw = viewport.width + margin * 2;
  const vh = viewport.height + margin * 2;

  return !(
    bounds.x + bounds.width < vx ||
    bounds.x > vx + vw ||
    bounds.y + bounds.height < vy ||
    bounds.y > vy + vh
  );
}

// ---- バウンディングボックス計算 ----

function getStrokeBounds(stroke: Stroke | { points: Point[]; width: number }): Bounds {
  const points = stroke.points;
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const padding = (stroke.width || 2) / 2 + 2;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

function getShapeBounds(shape: Shape): Bounds {
  let minX: number, minY: number, maxX: number, maxY: number;

  if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
    // 折れ線: すべてのpointsを考慮
    minX = maxX = shape.points[0].x;
    minY = maxY = shape.points[0].y;
    for (const p of shape.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  } else {
    minX = Math.min(shape.startPos.x, shape.endPos.x);
    minY = Math.min(shape.startPos.y, shape.endPos.y);
    maxX = Math.max(shape.startPos.x, shape.endPos.x);
    maxY = Math.max(shape.startPos.y, shape.endPos.y);
  }

  // アノテーション（引出線+テキスト）のバウンドも含める
  if (shape.annotation) {
    const ann = shape.annotation;
    if (ann.leaderLine) {
      minX = Math.min(minX, ann.leaderLine.start.x, ann.leaderLine.end.x);
      minY = Math.min(minY, ann.leaderLine.start.y, ann.leaderLine.end.y);
      maxX = Math.max(maxX, ann.leaderLine.start.x, ann.leaderLine.end.x);
      maxY = Math.max(maxY, ann.leaderLine.start.y, ann.leaderLine.end.y);
    }
    // テキスト位置も考慮（おおよそ200px程度の余裕を持たせる）
    minX = Math.min(minX, ann.x - 200);
    minY = Math.min(minY, ann.y - 50);
    maxX = Math.max(maxX, ann.x + 200);
    maxY = Math.max(maxY, ann.y + 50);
  }

  // フォントラベルのバウンドも含める
  if (shape.fontLabel) {
    minX = Math.min(minX, shape.fontLabel.textX - 100);
    minY = Math.min(minY, shape.fontLabel.textY - 20);
    maxX = Math.max(maxX, shape.fontLabel.textX + 100);
    maxY = Math.max(maxY, shape.fontLabel.textY + 20);
  }

  // ラベル付き枠線の引出線
  if (shape.leaderLine) {
    minX = Math.min(minX, shape.leaderLine.start.x, shape.leaderLine.end.x);
    minY = Math.min(minY, shape.leaderLine.start.y, shape.leaderLine.end.y);
    maxX = Math.max(maxX, shape.leaderLine.start.x, shape.leaderLine.end.x);
    maxY = Math.max(maxY, shape.leaderLine.start.y, shape.leaderLine.end.y);
  }

  const padding = (shape.width || 2) / 2 + 5;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

function getTextBounds(text: TextElement): Bounds {
  // テキストのバウンドはフォントサイズを元に概算
  const fontSize = text.fontSize || 14;
  const lines = text.text.split('\n');
  const maxLineLen = Math.max(...lines.map(l => l.length));

  let width: number, height: number;
  if (text.isVertical) {
    width = fontSize * lines.length * 1.2;
    height = fontSize * maxLineLen * 1.2;
  } else {
    width = fontSize * maxLineLen * 0.7;
    height = fontSize * lines.length * 1.5;
  }

  // 引出線があればそのバウンドも含める
  let minX = text.x - 10;
  let minY = text.y - fontSize - 10;
  let maxX = text.x + width + 10;
  let maxY = text.y + height + 10;

  if (text.leaderLine) {
    minX = Math.min(minX, text.leaderLine.start.x, text.leaderLine.end.x);
    minY = Math.min(minY, text.leaderLine.start.y, text.leaderLine.end.y);
    maxX = Math.max(maxX, text.leaderLine.start.x, text.leaderLine.end.x);
    maxY = Math.max(maxY, text.leaderLine.start.y, text.leaderLine.end.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getImageBounds(image: ImageElement): Bounds {
  const minX = Math.min(image.startPos.x, image.endPos.x);
  const minY = Math.min(image.startPos.y, image.endPos.y);
  const maxX = Math.max(image.startPos.x, image.endPos.x);
  const maxY = Math.max(image.startPos.y, image.endPos.y);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ---- 公開API: ビューポート内のオブジェクトのみフィルタリング ----

export function isStrokeVisible(
  stroke: Stroke | { points: Point[]; width: number },
  viewport: ViewportRect
): boolean {
  return intersectsViewport(getStrokeBounds(stroke), viewport);
}

export function isShapeVisible(shape: Shape, viewport: ViewportRect): boolean {
  return intersectsViewport(getShapeBounds(shape), viewport);
}

export function isTextVisible(text: TextElement, viewport: ViewportRect): boolean {
  return intersectsViewport(getTextBounds(text), viewport);
}

export function isImageVisible(image: ImageElement, viewport: ViewportRect): boolean {
  return intersectsViewport(getImageBounds(image), viewport);
}
