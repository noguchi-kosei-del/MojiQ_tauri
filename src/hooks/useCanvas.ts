import { useRef, useEffect, useCallback, useState } from 'react';
import { Point, Stroke, Shape, ShapeType, SelectionBounds, Annotation, TextElement, ImageElement, StampType } from '../types';
import { useDrawingStore } from '../stores/drawingStore';
import { usePresetStore } from '../stores/presetStore';

// アノテーションモード: 0=通常, 1=図形描画中, 2=引出線描画中
type AnnotationState = 0 | 1 | 2;

// アノテーション付き図形情報
interface PendingAnnotatedShape {
  shapeId: string;
  shapeType: 'rect' | 'ellipse' | 'line';
  startPos: Point;
  endPos: Point;
}

export const useCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false);
  const [isDraggingLeaderEnd, setIsDraggingLeaderEnd] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [annotationState, setAnnotationState] = useState<AnnotationState>(0);
  const [isDrawingLeader, setIsDrawingLeader] = useState(false);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [hoverAnnotationType, setHoverAnnotationType] = useState<'text' | 'leaderEnd' | null>(null);
  const [showTextModal, setShowTextModal] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isDrawingPolyline, setIsDrawingPolyline] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDrawingImage, setIsDrawingImage] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [isDraggingFontLabel, setIsDraggingFontLabel] = useState(false);
  const [selectedFontLabelShapeId, setSelectedFontLabelShapeId] = useState<string | null>(null);
  // labeledRect（小文字指定）用state
  const [labeledRectPhase, setLabeledRectPhase] = useState<0 | 1 | 2>(0); // 0=通常, 1=引出線描画中, 2=枠線描画中
  const [showLabelInputModal, setShowLabelInputModal] = useState(false);
  const [pendingLabeledRect, setPendingLabeledRect] = useState<{
    leaderStart: Point;
    leaderEnd: Point;
    rectStart: Point;
    rectEnd: Point;
  } | null>(null);
  const labeledRectLeaderStartRef = useRef<Point | null>(null);
  const labeledRectLeaderEndRef = useRef<Point | null>(null);
  const labeledRectStartRef = useRef<Point | null>(null);
  const polylinePointsRef = useRef<Point[]>([]);
  const currentPolylineEndRef = useRef<Point | null>(null);
  const pendingTextPosRef = useRef<Point | null>(null);
  const pendingImageRef = useRef<HTMLImageElement | null>(null);
  const imageStartRef = useRef<Point | null>(null);
  const currentImageEndRef = useRef<Point | null>(null);
  // 画像キャッシュ（imageData URLからHTMLImageElementへのマッピング）
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const currentStrokeRef = useRef<Point[]>([]);
  const selectionStartRef = useRef<Point | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const lastDragPointRef = useRef<Point | null>(null);
  const shapeStartRef = useRef<Point | null>(null);
  const currentShapeEndRef = useRef<Point | null>(null);
  const pendingAnnotatedShapeRef = useRef<PendingAnnotatedShape | null>(null);
  const leaderStartRef = useRef<Point | null>(null);
  const leaderEndRef = useRef<Point | null>(null);
  // ダブルクリック検出用
  const lastClickTimeRef = useRef<number>(0);
  const lastClickPosRef = useRef<Point | null>(null);
  const DOUBLE_CLICK_THRESHOLD = 300; // ms
  const DOUBLE_CLICK_DISTANCE = 10; // px

  const {
    tool,
    color,
    strokeWidth,
    addStroke,
    addShape,
    eraseAt,
    currentPage,
    pages,
    selectedStrokeIds,
    selectedShapeIds,
    selectionBounds,
    selectStrokesInRect,
    selectStrokeAtPoint,
    selectShapeAtPoint,
    selectShapesInRect,
    clearSelection,
    moveSelectedStrokes,
    moveSelectedShapes,
    updateShapeAnnotation,
    selectAnnotationAtPoint,
    moveAnnotationOnly,
    moveLeaderEnd,
    calculateAnnotationTextBounds,
    addText,
    updateText,
    selectTextAtPoint,
    moveSelectedTexts,
    selectedTextIds,
    calculateTextBounds,
    selectedAnnotationShapeId,
    setSelectedAnnotationShapeId,
    addImage,
    selectImageAtPoint,
    moveSelectedImages,
    currentStampType,
    addStamp,
    updateShape,
  } = useDrawingStore();

  const getCurrentPageState = useCallback(() => {
    return pages[currentPage];
  }, [pages, currentPage]);

  const getAllStrokes = useCallback(() => {
    const pageState = pages[currentPage];
    if (!pageState) return [];
    return pageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.strokes);
  }, [pages, currentPage]);

  const getAllShapes = useCallback(() => {
    const pageState = pages[currentPage];
    if (!pageState) return [];
    return pageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.shapes);
  }, [pages, currentPage]);

  const getAllTexts = useCallback(() => {
    const pageState = pages[currentPage];
    if (!pageState) return [];
    return pageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.texts);
  }, [pages, currentPage]);

  const getLocalAllImages = useCallback(() => {
    const pageState = pages[currentPage];
    if (!pageState) return [];
    return pageState.layers
      .filter((l) => l.visible)
      .flatMap((l) => l.images);
  }, [pages, currentPage]);

  const getPointerPosition = useCallback(
    (e: PointerEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0, pressure: 0.5 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        pressure: e.pressure || 0.5,
      };
    },
    []
  );

  // Snap line endpoint to 45-degree angles when Shift is pressed
  const snapLineEndpoint = useCallback((startPos: Point, endPos: Point): Point => {
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate angle in radians
    const angle = Math.atan2(dy, dx);

    // Snap to nearest 45 degrees (π/4 radians)
    const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

    // Calculate new endpoint
    return {
      x: startPos.x + distance * Math.cos(snapAngle),
      y: startPos.y + distance * Math.sin(snapAngle),
    };
  }, []);

  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke | { points: Point[]; color: string; width: number; isMarker?: boolean; opacity?: number }, isSelected = false) => {
      if (stroke.points.length < 2) return;

      ctx.save();

      // マーカーの場合は半透明で描画
      if ('isMarker' in stroke && stroke.isMarker) {
        ctx.globalAlpha = stroke.opacity || 0.3;
        ctx.globalCompositeOperation = 'multiply';
      }

      ctx.beginPath();
      ctx.strokeStyle = isSelected ? '#0078d4' : stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const points = stroke.points;

      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const pressure = point.pressure || 0.5;
        // マーカーは圧力で太さを変えない
        ctx.lineWidth = ('isMarker' in stroke && stroke.isMarker)
          ? stroke.width
          : stroke.width * (0.5 + pressure);
        ctx.lineTo(point.x, point.y);
      }

      ctx.stroke();
      ctx.restore();
    },
    []
  );

  // 矢頭を描画するヘルパー関数
  const drawArrowHead = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, headLen: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x - headLen * Math.cos(angle - Math.PI / 6),
        y - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(x, y);
      ctx.lineTo(
        x - headLen * Math.cos(angle + Math.PI / 6),
        y - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    },
    []
  );

  // スタンプ描画関数
  const drawStamp = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, stampType: StampType, size: number, stampColor: string) => {
      ctx.save();

      if (stampType === 'doneStamp') {
        // 済スタンプ（円形）
        const radius = size / 2;

        // 外側の円（白フチ）
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.stroke();

        // 外側の円（枠線）
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = stampColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 「済」の文字（白フチ）
        ctx.font = `bold ${size * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeText('済', x, y);

        // 「済」の文字
        ctx.fillStyle = stampColor;
        ctx.fillText('済', x, y);
      } else if (stampType === 'rubyStamp') {
        // ルビスタンプ（角丸長方形）
        const width = size * 1.8;
        const height = size * 0.9;
        const cornerRadius = size * 0.15;
        const rectX = x - width / 2;
        const rectY = y - height / 2;

        // 角丸長方形を描画
        const drawRoundedRect = (rx: number, ry: number, rw: number, rh: number, r: number) => {
          ctx.beginPath();
          ctx.moveTo(rx + r, ry);
          ctx.lineTo(rx + rw - r, ry);
          ctx.arcTo(rx + rw, ry, rx + rw, ry + r, r);
          ctx.lineTo(rx + rw, ry + rh - r);
          ctx.arcTo(rx + rw, ry + rh, rx + rw - r, ry + rh, r);
          ctx.lineTo(rx + r, ry + rh);
          ctx.arcTo(rx, ry + rh, rx, ry + rh - r, r);
          ctx.lineTo(rx, ry + r);
          ctx.arcTo(rx, ry, rx + r, ry, r);
          ctx.closePath();
        };

        // 外側の角丸長方形（白フチ）
        drawRoundedRect(rectX, rectY, width, height, cornerRadius);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 外側の角丸長方形（枠線）
        drawRoundedRect(rectX, rectY, width, height, cornerRadius);
        ctx.strokeStyle = stampColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 「ルビ」の文字（白フチ）
        ctx.font = `bold ${size * 0.45}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeText('ルビ', x, y);

        // 「ルビ」の文字
        ctx.fillStyle = stampColor;
        ctx.fillText('ルビ', x, y);
      } else if (stampType === 'komojiStamp') {
        // 小文字スタンプ（○に小）
        const radius = size / 2;

        // 外側の円（白フチ）
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 外側の円（枠線）
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = stampColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 「小」の文字（白フチ）
        ctx.font = `bold ${size * 0.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeText('小', x, y);

        // 「小」の文字
        ctx.fillStyle = stampColor;
        ctx.fillText('小', x, y);
      } else {
        // その他のテキストスタンプ（トル、トルツメ、等）
        const stampTexts: Record<StampType, string> = {
          toruStamp: 'トル',
          torutsumeStamp: 'トルツメ',
          torumamaStamp: 'トルママ',
          zenkakuakiStamp: '全角アキ',
          hankakuakiStamp: '半角アキ',
          kaigyouStamp: '改行',
          doneStamp: '済',
          rubyStamp: 'ルビ',
          komojiStamp: '小',
        };

        const text = stampTexts[stampType] || '';

        // テキスト（白フチ）
        ctx.font = `bold ${size * 0.9}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeText(text, x, y);

        // テキスト
        ctx.fillStyle = stampColor;
        ctx.fillText(text, x, y);
      }

      ctx.restore();
    },
    []
  );

  const drawShape = useCallback(
    (ctx: CanvasRenderingContext2D, shape: Shape | { type: ShapeType; startPos: Point; endPos: Point; color: string; width: number; annotation?: Annotation; points?: Point[]; stampType?: StampType; size?: number }, isSelected = false) => {
      ctx.save();

      const { startPos, endPos, type } = shape;

      // スタンプの場合
      if (type === 'stamp' && 'stampType' in shape && shape.stampType) {
        const stampSize = 'size' in shape && shape.size ? shape.size : 20;
        drawStamp(ctx, startPos.x, startPos.y, shape.stampType, stampSize, isSelected ? '#0078d4' : shape.color);
        ctx.restore();
        return;
      }

      ctx.beginPath();
      ctx.strokeStyle = isSelected ? '#0078d4' : shape.color;
      ctx.lineWidth = shape.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const baseType = type.replace('Annotated', '') as 'rect' | 'ellipse' | 'line' | 'arrow' | 'doubleArrow' | 'polyline';

      if (baseType === 'rect') {
        const w = endPos.x - startPos.x;
        const h = endPos.y - startPos.y;
        ctx.rect(startPos.x, startPos.y, w, h);
        ctx.stroke();

        // フォントラベルを描画（フォント指定枠線の場合）
        if ('fontLabel' in shape && shape.fontLabel) {
          const { fontName, textX, textY, textAlign } = shape.fontLabel;
          const labelFontSize = 16;
          ctx.font = `bold ${labelFontSize}px sans-serif`;
          ctx.fillStyle = isSelected ? '#0078d4' : shape.color;
          ctx.textAlign = textAlign;
          ctx.textBaseline = endPos.y > startPos.y ? 'top' : 'bottom';

          // 白い縁取り
          ctx.save();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#ffffff';
          ctx.strokeText(fontName, textX, textY);
          ctx.restore();

          // テキスト本体
          ctx.fillText(fontName, textX, textY);
        }
      } else if (baseType === 'ellipse') {
        const w = Math.abs(endPos.x - startPos.x);
        const h = Math.abs(endPos.y - startPos.y);
        const cx = startPos.x + (endPos.x - startPos.x) / 2;
        const cy = startPos.y + (endPos.y - startPos.y) / 2;
        ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (baseType === 'line') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();
      } else if (baseType === 'arrow') {
        // 単方向矢印: 直線を描画して終端に矢頭
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();

        const headLen = Math.max(8, shape.width * 3);
        const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
        drawArrowHead(ctx, endPos.x, endPos.y, angle, headLen);
      } else if (baseType === 'doubleArrow') {
        // 両矢印: 直線を描画して両端に矢頭
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();

        const headLen = Math.max(8, shape.width * 3);
        const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
        // 終端側の矢頭
        drawArrowHead(ctx, endPos.x, endPos.y, angle, headLen);
        // 始端側の矢頭（角度を180度回転）
        drawArrowHead(ctx, startPos.x, startPos.y, angle + Math.PI, headLen);
      } else if (baseType === 'polyline') {
        // 折れ線: points配列を使用して描画
        const points = 'points' in shape && shape.points ? shape.points : [];
        if (points.length >= 2) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
      } else if (type === 'labeledRect') {
        // ラベル付き枠線（小文字指定）: 引出線 + 正方形 + ラベルを描画

        // 引出線を描画
        if ('leaderLine' in shape && shape.leaderLine) {
          ctx.beginPath();
          ctx.moveTo(shape.leaderLine.start.x, shape.leaderLine.start.y);
          ctx.lineTo(shape.leaderLine.end.x, shape.leaderLine.end.y);
          ctx.stroke();

          // 先端に●を描画
          const dotRadius = Math.max(shape.width, 2);
          ctx.beginPath();
          ctx.arc(shape.leaderLine.start.x, shape.leaderLine.start.y, dotRadius, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? '#0078d4' : shape.color;
          ctx.fill();
        }

        // 正方形の枠線を描画
        const minX = Math.min(startPos.x, endPos.x);
        const minY = Math.min(startPos.y, endPos.y);
        const w = Math.abs(endPos.x - startPos.x);
        const h = Math.abs(endPos.y - startPos.y);
        const size = Math.min(w, h);

        ctx.beginPath();
        ctx.rect(minX, minY, size, size);
        ctx.stroke();

        // ラベルを右下に描画
        const label = 'label' in shape && shape.label ? shape.label : '小';
        if (label) {
          const labelFontSize = Math.max(10, Math.min(16, size * 0.4));
          const padding = 3;
          const labelX = minX + size - padding;
          const labelY = minY + size - padding;

          ctx.font = `bold ${labelFontSize}px sans-serif`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';

          // 白フチを描画
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round';
          ctx.strokeText(label, labelX, labelY);
          ctx.restore();

          // テキスト本体を描画
          ctx.fillStyle = isSelected ? '#0078d4' : shape.color;
          ctx.fillText(label, labelX, labelY);
        }
      }

      ctx.restore();

      // アノテーション（引出線 + テキスト）を描画
      if ('annotation' in shape && shape.annotation) {
        drawAnnotation(ctx, shape.annotation, shape.color);
      }
    },
    [drawArrowHead, drawStamp]
  );

  // 引出線とアノテーションテキストを描画
  const drawAnnotation = useCallback(
    (ctx: CanvasRenderingContext2D, annotation: Annotation, shapeColor: string) => {
      const { leaderLine, text, x, y, fontSize, isVertical, align, color: annColor } = annotation;
      const color = annColor || shapeColor;

      // 引出線を描画
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.moveTo(leaderLine.start.x, leaderLine.start.y);
      ctx.lineTo(leaderLine.end.x, leaderLine.end.y);
      ctx.stroke();

      // 引出線の起点に●を描画
      ctx.beginPath();
      ctx.arc(leaderLine.start.x, leaderLine.start.y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();

      // テキストを描画
      if (text) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = `${fontSize}px sans-serif`;

        const lines = text.split('\n');
        const lineHeight = fontSize * 1.2;

        // 白い縁取り付きでテキストを描画
        const drawWithOutline = (char: string, px: number, py: number) => {
          ctx.save();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#ffffff';
          ctx.strokeText(char, px, py);
          ctx.restore();
          ctx.fillText(char, px, py);
        };

        if (isVertical) {
          // 縦書き
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const verticalLineHeight = fontSize * 1.1;

          // 句読点など右上に移動させる文字
          const punctuationChars = ['、', '。', '，', '．', '｡', '､'];

          lines.forEach((line, colIndex) => {
            const currentX = x - (colIndex * verticalLineHeight);
            let cursorY = 0;
            const chars = Array.from(line);

            chars.forEach((char) => {
              const currentY = y + cursorY + fontSize / 2;
              if (char === ' ') {
                cursorY += fontSize * 0.3;
                return;
              }

              const needsRotation = ['ー', '−', '―', '…', '(', ')', '（', '）', '[', ']', '「', '」', '～', '〜', '＝', '='].includes(char);
              const isPunctuation = punctuationChars.includes(char);

              if (needsRotation) {
                ctx.save();
                ctx.translate(currentX, currentY);
                ctx.rotate(Math.PI / 2);
                drawWithOutline(char, 0, 0);
                ctx.restore();
              } else if (isPunctuation) {
                // 句読点は右上に移動
                const offsetX = fontSize * 0.7;
                const offsetY = -fontSize * 0.55;
                drawWithOutline(char, currentX + offsetX, currentY + offsetY);
              } else {
                drawWithOutline(char, currentX, currentY);
              }

              cursorY += fontSize;
            });
          });
        } else {
          // 横書き
          ctx.textAlign = align || 'left';
          ctx.textBaseline = 'top';

          lines.forEach((line, index) => {
            const currentY = y + (index * lineHeight);
            drawWithOutline(line, x, currentY);
          });
        }

        ctx.restore();
      }
    },
    []
  );

  // テキスト要素を描画
  const drawText = useCallback(
    (ctx: CanvasRenderingContext2D, textElement: TextElement, isSelected = false) => {
      const { text, x, y, fontSize, isVertical, color: textColor } = textElement;

      if (!text) return;

      ctx.save();
      ctx.fillStyle = isSelected ? '#0078d4' : textColor;
      ctx.font = `${fontSize}px sans-serif`;

      const lines = text.split('\n');
      const lineHeight = fontSize * 1.2;

      // 白い縁取り付きでテキストを描画
      const drawWithOutline = (char: string, px: number, py: number) => {
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(char, px, py);
        ctx.restore();
        ctx.fillText(char, px, py);
      };

      if (isVertical) {
        // 縦書き
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const verticalLineHeight = fontSize * 1.1;

        // 句読点など右上に移動させる文字
        const punctuationChars = ['、', '。', '，', '．', '｡', '､'];

        lines.forEach((line, colIndex) => {
          const currentX = x - (colIndex * verticalLineHeight);
          let cursorY = 0;
          const chars = Array.from(line);

          chars.forEach((char) => {
            const currentY = y + cursorY + fontSize / 2;
            if (char === ' ') {
              cursorY += fontSize * 0.3;
              return;
            }

            const needsRotation = ['ー', '−', '―', '…', '(', ')', '（', '）', '[', ']', '「', '」', '～', '〜', '＝', '='].includes(char);
            const isPunctuation = punctuationChars.includes(char);

            if (needsRotation) {
              ctx.save();
              ctx.translate(currentX, currentY);
              ctx.rotate(Math.PI / 2);
              drawWithOutline(char, 0, 0);
              ctx.restore();
            } else if (isPunctuation) {
              // 句読点は右上に移動
              const offsetX = fontSize * 0.7;
              const offsetY = -fontSize * 0.55;
              drawWithOutline(char, currentX + offsetX, currentY + offsetY);
            } else {
              drawWithOutline(char, currentX, currentY);
            }

            cursorY += fontSize;
          });
        });
      } else {
        // 横書き
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        lines.forEach((line, index) => {
          const currentY = y + (index * lineHeight);
          drawWithOutline(line, x, currentY);
        });
      }

      ctx.restore();
    },
    []
  );

  // 画像を描画
  const drawImage = useCallback(
    (ctx: CanvasRenderingContext2D, imageElement: ImageElement, isSelected = false) => {
      const { startPos, endPos, imageData } = imageElement;

      // キャッシュからHTMLImageElementを取得、なければ作成
      let img = imageCache.current.get(imageData);
      if (!img) {
        img = new Image();
        img.src = imageData;
        imageCache.current.set(imageData, img);
        // 画像が読み込まれたら再描画
        img.onload = () => {
          redrawCanvas();
        };
        return; // 画像がまだ読み込まれていない場合は描画をスキップ
      }

      if (!img.complete) return;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const w = endPos.x - startPos.x;
      const h = endPos.y - startPos.y;
      ctx.drawImage(img, startPos.x, startPos.y, w, h);

      // 選択時は枠線を表示
      if (isSelected) {
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(startPos.x, startPos.y, w, h);
        ctx.setLineDash([]);
      }

      ctx.restore();
    },
    []
  );

  // 画像プレビューを描画（ドラッグ中）
  const drawImagePreview = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement, startPos: Point, currentPos: Point) => {
      // アスペクト比を保持して画像サイズを計算
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const dragW = currentPos.x - startPos.x;
      const dragH = currentPos.y - startPos.y;
      let w: number, h: number;

      if (Math.abs(dragW / dragH) > imgAspect) {
        h = dragH;
        w = dragH * imgAspect * Math.sign(dragW);
      } else {
        w = dragW;
        h = dragW / imgAspect * Math.sign(dragH);
      }

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, startPos.x, startPos.y, w, h);

      // 点線の枠を描画
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(startPos.x, startPos.y, w, h);
      ctx.setLineDash([]);
      ctx.restore();
    },
    []
  );

  // 引出線プレビューを描画
  const drawLeaderPreview = useCallback(
    (ctx: CanvasRenderingContext2D, startPos: Point, endPos: Point, shapeColor: string) => {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = shapeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(endPos.x, endPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 起点に●を描画
      ctx.beginPath();
      ctx.arc(startPos.x, startPos.y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = shapeColor;
      ctx.fill();
      ctx.restore();
    },
    []
  );

  // 図形から引出線の開始位置を計算
  const getLeaderStartPos = useCallback(
    (shapeType: 'rect' | 'ellipse' | 'line', startPos: Point, endPos: Point, targetPos: Point): Point => {
      if (shapeType === 'rect') {
        // 矩形: 4辺の中点から最も近い点を選択
        const minX = Math.min(startPos.x, endPos.x);
        const maxX = Math.max(startPos.x, endPos.x);
        const minY = Math.min(startPos.y, endPos.y);
        const maxY = Math.max(startPos.y, endPos.y);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const candidates = [
          { x: centerX, y: minY },  // 上
          { x: centerX, y: maxY },  // 下
          { x: minX, y: centerY },  // 左
          { x: maxX, y: centerY },  // 右
        ];

        let nearest = candidates[0];
        let minDist = Infinity;

        candidates.forEach(p => {
          const dist = Math.hypot(targetPos.x - p.x, targetPos.y - p.y);
          if (dist < minDist) {
            minDist = dist;
            nearest = p;
          }
        });

        return nearest;
      } else if (shapeType === 'ellipse') {
        // 楕円: 周辺上の点を計算
        const w = Math.abs(endPos.x - startPos.x);
        const h = Math.abs(endPos.y - startPos.y);
        const cx = startPos.x + (endPos.x - startPos.x) / 2;
        const cy = startPos.y + (endPos.y - startPos.y) / 2;
        const rx = w / 2;
        const ry = h / 2;
        const dx = targetPos.x - cx;
        const dy = targetPos.y - cy;
        const angle = Math.atan2(dy, dx);
        return {
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        };
      } else {
        // 直線: 中点
        return {
          x: (startPos.x + endPos.x) / 2,
          y: (startPos.y + endPos.y) / 2,
        };
      }
    },
    []
  );

  const drawSelectionRect = useCallback((startPoint: Point, endPoint: Point) => {
    const canvas = selectionCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = 'rgba(0, 120, 212, 0.1)';
    ctx.fillRect(x, y, width, height);
    ctx.setLineDash([]);
  }, []);

  const drawSelectionBounds = useCallback((bounds: SelectionBounds) => {
    const canvas = selectionCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 5;
    const x = bounds.x - padding;
    const y = bounds.y - padding;
    const width = bounds.width + padding * 2;
    const height = bounds.height + padding * 2;

    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, width, height);

    // Draw corner handles
    const handleSize = 8;
    ctx.fillStyle = '#0078d4';
    const corners = [
      { x: x, y: y },
      { x: x + width, y: y },
      { x: x, y: y + height },
      { x: x + width, y: y + height },
    ];
    corners.forEach(corner => {
      ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
    });
  }, []);

  const clearSelectionCanvas = useCallback(() => {
    const canvas = selectionCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // アノテーションテキストの選択ボックスを描画
  const drawAnnotationSelectionBox = useCallback((annotation: Annotation) => {
    const canvas = selectionCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const textBounds = calculateAnnotationTextBounds(annotation);
    if (!textBounds) return;

    const padding = 5;
    ctx.save();
    ctx.strokeStyle = '#ff8c00'; // オレンジ色
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(
      textBounds.x - padding,
      textBounds.y - padding,
      textBounds.width + padding * 2,
      textBounds.height + padding * 2
    );

    // 引出線終点にハンドルを描画
    const handleSize = 8;
    ctx.fillStyle = '#ff8c00';
    ctx.fillRect(
      annotation.leaderLine.end.x - handleSize / 2,
      annotation.leaderLine.end.y - handleSize / 2,
      handleSize,
      handleSize
    );
    ctx.restore();
  }, [calculateAnnotationTextBounds]);

  // テキスト選択ボックスを描画
  const drawTextSelectionBox = useCallback((textElement: TextElement) => {
    const canvas = selectionCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const textBounds = calculateTextBounds(textElement);
    if (!textBounds) return;

    const padding = 5;
    ctx.save();
    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(
      textBounds.x - padding,
      textBounds.y - padding,
      textBounds.width + padding * 2,
      textBounds.height + padding * 2
    );
    ctx.restore();
  }, [calculateTextBounds]);

  // fontLabelのテキスト部分のヒットテスト
  const hitTestFontLabelText = useCallback((point: Point, shape: Shape, tolerance: number = 5): boolean => {
    if (!shape.fontLabel) return false;

    const { fontName, textX, textY, textAlign } = shape.fontLabel;
    const fontSize = 16;
    const textWidth = fontName.length * fontSize * 0.7; // 概算

    let textMinX: number, textMaxX: number;
    if (textAlign === 'left') {
      textMinX = textX;
      textMaxX = textX + textWidth;
    } else {
      textMinX = textX - textWidth;
      textMaxX = textX;
    }

    const textMinY = textY - fontSize / 2;
    const textMaxY = textY + fontSize / 2;

    return (
      point.x >= textMinX - tolerance &&
      point.x <= textMaxX + tolerance &&
      point.y >= textMinY - tolerance &&
      point.y <= textMaxY + tolerance
    );
  }, []);

  // fontLabelのテキスト部分をポイントで選択
  const selectFontLabelTextAtPoint = useCallback((point: Point, tolerance: number): Shape | null => {
    const shapes = getAllShapes();
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      if (shape.fontLabel && hitTestFontLabelText(point, shape, tolerance)) {
        return shape;
      }
    }
    return null;
  }, [getAllShapes, hitTestFontLabelText]);

  // fontLabelテキストの選択ボックスを描画
  const drawFontLabelSelectionBox = useCallback((shape: Shape) => {
    const canvas = selectionCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !shape.fontLabel) return;

    const { fontName, textX, textY, textAlign } = shape.fontLabel;
    const fontSize = 16;
    const textWidth = fontName.length * fontSize * 0.7;
    const padding = 4;

    let boxX = textX;
    if (textAlign !== 'left') {
      boxX = textX - textWidth;
    }

    ctx.save();
    ctx.strokeStyle = '#ff8c00'; // オレンジ色
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(
      boxX - padding,
      textY - fontSize / 2 - padding,
      textWidth + padding * 2,
      fontSize + padding * 2
    );
    ctx.restore();
  }, []);

  const isPointInSelectionBounds = useCallback((point: Point, bounds: SelectionBounds): boolean => {
    const padding = 5;
    return (
      point.x >= bounds.x - padding &&
      point.x <= bounds.x + bounds.width + padding &&
      point.y >= bounds.y - padding &&
      point.y <= bounds.y + bounds.height + padding
    );
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw strokes
    const strokes = getAllStrokes();
    strokes.forEach((stroke) => {
      const isSelected = selectedStrokeIds.includes(stroke.id);
      drawStroke(ctx, stroke, isSelected);
    });

    // Draw shapes
    const shapes = getAllShapes();
    const state = useDrawingStore.getState();
    shapes.forEach((shape) => {
      const isSelected = state.selectedShapeIds.includes(shape.id);
      drawShape(ctx, shape, isSelected);
    });

    // Draw texts
    const texts = getAllTexts();
    texts.forEach((textElement) => {
      const isSelected = state.selectedTextIds.includes(textElement.id);
      drawText(ctx, textElement, isSelected);
    });

    // Draw images
    const images = getLocalAllImages();
    images.forEach((imageElement) => {
      const isSelected = state.selectedImageIds.includes(imageElement.id);
      drawImage(ctx, imageElement, isSelected);
    });

    // Draw current stroke if drawing
    if (isDrawing && currentStrokeRef.current.length > 1) {
      const currentTool = useDrawingStore.getState().tool;
      drawStroke(ctx, {
        points: currentStrokeRef.current,
        color,
        width: strokeWidth,
        isMarker: currentTool === 'marker',
        opacity: currentTool === 'marker' ? 0.3 : undefined,
      });
    }

    // Draw current shape preview if drawing shape
    if (isDrawingShape && shapeStartRef.current && currentShapeEndRef.current) {
      // フォント指定プレビュー用のfontLabelを生成
      const presetState = usePresetStore.getState();
      const selectedFont = presetState.selectedFont;
      let previewFontLabel: Shape['fontLabel'] = undefined;

      if (tool === 'rect' && selectedFont) {
        const startPos = shapeStartRef.current;
        const endPos = currentShapeEndRef.current;
        const padding = 5;
        let textAlign: 'left' | 'right' = 'left';
        let textX = 0;
        let textY = 0;

        if (endPos.x > startPos.x) {
          textAlign = 'left';
          textX = endPos.x + padding;
        } else {
          textAlign = 'right';
          textX = endPos.x - padding;
        }

        if (endPos.y > startPos.y) {
          textY = endPos.y + padding;
        } else {
          textY = endPos.y - padding;
        }

        previewFontLabel = {
          fontName: selectedFont.name,
          textX,
          textY,
          textAlign,
        };
      }

      drawShape(ctx, {
        type: tool as ShapeType,
        startPos: shapeStartRef.current,
        endPos: currentShapeEndRef.current,
        color,
        width: strokeWidth,
        fontLabel: previewFontLabel,
        label: tool === 'labeledRect' ? '小' : undefined,
      });
    }

    // Draw labeledRect preview (引出線フェーズ or 枠線フェーズ)
    if (labeledRectPhase > 0 && labeledRectLeaderStartRef.current && currentShapeEndRef.current) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const leaderStart = labeledRectLeaderStartRef.current;
      const currentPos = currentShapeEndRef.current;

      if (labeledRectPhase === 1) {
        // 引出線フェーズ: 引出線のプレビュー
        const dist = Math.hypot(currentPos.x - leaderStart.x, currentPos.y - leaderStart.y);
        if (dist >= 10) {
          ctx.beginPath();
          ctx.moveTo(leaderStart.x, leaderStart.y);
          ctx.lineTo(currentPos.x, currentPos.y);
          ctx.stroke();

          // 先端に●を描画
          const dotRadius = Math.max(strokeWidth, 2);
          ctx.beginPath();
          ctx.arc(leaderStart.x, leaderStart.y, dotRadius, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }
      } else if (labeledRectPhase === 2 && labeledRectLeaderEndRef.current && labeledRectStartRef.current) {
        // 枠線フェーズ: 引出線 + 枠線のプレビュー
        const leaderEnd = labeledRectLeaderEndRef.current;
        const rectStart = labeledRectStartRef.current;

        // 引出線を描画
        ctx.beginPath();
        ctx.moveTo(leaderStart.x, leaderStart.y);
        ctx.lineTo(leaderEnd.x, leaderEnd.y);
        ctx.stroke();

        // 先端に●を描画
        const dotRadius = Math.max(strokeWidth, 2);
        ctx.beginPath();
        ctx.arc(leaderStart.x, leaderStart.y, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // 正方形の枠線プレビューを描画
        const minX = Math.min(rectStart.x, currentPos.x);
        const minY = Math.min(rectStart.y, currentPos.y);
        const w = Math.abs(currentPos.x - rectStart.x);
        const h = Math.abs(currentPos.y - rectStart.y);
        const size = Math.min(w, h);
        if (size > 0) {
          ctx.beginPath();
          ctx.rect(minX, minY, size, size);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Draw leader line preview if in annotation mode (phase 2)
    if (isDrawingLeader && leaderStartRef.current && leaderEndRef.current) {
      drawLeaderPreview(ctx, leaderStartRef.current, leaderEndRef.current, color);
    }

    // Draw polyline preview if drawing polyline
    if (isDrawingPolyline && polylinePointsRef.current.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 確定済みの頂点を描画
      ctx.moveTo(polylinePointsRef.current[0].x, polylinePointsRef.current[0].y);
      for (let i = 1; i < polylinePointsRef.current.length; i++) {
        ctx.lineTo(polylinePointsRef.current[i].x, polylinePointsRef.current[i].y);
      }
      ctx.stroke();

      // 現在のマウス位置までのプレビュー線を描画
      if (currentPolylineEndRef.current) {
        const lastPoint = polylinePointsRef.current[polylinePointsRef.current.length - 1];
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(currentPolylineEndRef.current.x, currentPolylineEndRef.current.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 頂点にマーカーを描画
      ctx.fillStyle = color;
      polylinePointsRef.current.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.restore();
    }

    // Draw image preview if drawing image
    if (isDrawingImage && pendingImageRef.current && imageStartRef.current && currentImageEndRef.current) {
      drawImagePreview(ctx, pendingImageRef.current, imageStartRef.current, currentImageEndRef.current);
    }

    // Draw selection bounds
    if (selectionBounds && (selectedStrokeIds.length > 0 || state.selectedShapeIds.length > 0 || state.selectedTextIds.length > 0 || state.selectedImageIds.length > 0)) {
      drawSelectionBounds(selectionBounds);
    } else if (state.selectedTextIds.length > 0) {
      // テキストのみ選択されている場合
      clearSelectionCanvas();
      texts.forEach((textElement) => {
        if (state.selectedTextIds.includes(textElement.id)) {
          drawTextSelectionBox(textElement);
        }
      });
    } else if (selectedAnnotationShapeId) {
      // アノテーションのみ選択されている場合
      const shapes = getAllShapes();
      const shape = shapes.find(s => s.id === selectedAnnotationShapeId);
      if (shape?.annotation) {
        clearSelectionCanvas();
        drawAnnotationSelectionBox(shape.annotation);
      }
    } else if (selectedFontLabelShapeId) {
      // fontLabelのみ選択されている場合
      const shapes = getAllShapes();
      const shape = shapes.find(s => s.id === selectedFontLabelShapeId);
      if (shape) {
        clearSelectionCanvas();
        drawFontLabelSelectionBox(shape);
      }
    } else {
      clearSelectionCanvas();
    }
  }, [getAllStrokes, getAllShapes, getAllTexts, getLocalAllImages, drawStroke, drawShape, drawText, drawImage, drawImagePreview, isDrawing, isDrawingShape, isDrawingLeader, isDrawingPolyline, isDrawingImage, labeledRectPhase, tool, color, strokeWidth, selectedStrokeIds, selectionBounds, drawSelectionBounds, clearSelectionCanvas, drawLeaderPreview, selectedAnnotationShapeId, drawAnnotationSelectionBox, drawTextSelectionBox, selectedFontLabelShapeId, drawFontLabelSelectionBox]);

  const drawBackground = useCallback(() => {
    const canvas = backgroundCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const pageState = getCurrentPageState();
    if (!pageState?.backgroundImage) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = pageState.backgroundImage;
  }, [getCurrentPageState]);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.setPointerCapture(e.pointerId);
      const point = getPointerPosition(e);

      // Pan tool is handled by DrawingCanvas component
      if (tool === 'pan') {
        return;
      }

      // フェーズ2（引出線がマウスに追従中）の場合、クリックで引出線を確定してモーダル表示
      if (annotationState === 2 && isDrawingLeader && pendingAnnotatedShapeRef.current) {
        const pending = pendingAnnotatedShapeRef.current;
        const leaderStart = getLeaderStartPos(pending.shapeType, pending.startPos, pending.endPos, point);
        leaderStartRef.current = leaderStart;
        leaderEndRef.current = point;
        setIsDrawingLeader(false);
        setShowAnnotationModal(true);
        return;
      }

      if (tool === 'select') {
        // ダブルクリック検出
        const now = Date.now();
        const timeDiff = now - lastClickTimeRef.current;
        const isDoubleClick = timeDiff < DOUBLE_CLICK_THRESHOLD &&
          lastClickPosRef.current &&
          Math.hypot(point.x - lastClickPosRef.current.x, point.y - lastClickPosRef.current.y) < DOUBLE_CLICK_DISTANCE;

        lastClickTimeRef.current = now;
        lastClickPosRef.current = point;

        // ダブルクリックの場合は編集を試みる
        if (isDoubleClick) {
          // まずテキスト要素をチェック
          const clickedText = selectTextAtPoint(point, 10);
          if (clickedText) {
            setEditingTextId(clickedText.id);
            setShowTextModal(true);
            return;
          }

          // 次にアノテーションテキスト領域をチェック
          const annotationHit = selectAnnotationAtPoint(point, 10);
          if (annotationHit && annotationHit.hitType === 'text') {
            const shapes = getAllShapes();
            const shape = shapes.find(s => s.id === annotationHit.shapeId);
            if (shape && shape.annotation) {
              // アノテーション編集モードに入る
              setEditingShapeId(shape.id);
              pendingAnnotatedShapeRef.current = {
                shapeId: shape.id,
                shapeType: shape.type.replace('Annotated', '') as 'rect' | 'ellipse' | 'line',
                startPos: shape.startPos,
                endPos: shape.endPos,
              };
              leaderStartRef.current = shape.annotation.leaderLine.start;
              leaderEndRef.current = shape.annotation.leaderLine.end;
              setShowAnnotationModal(true);
              return;
            }
          }

          // 次に図形をチェック
          const clickedShape = selectShapeAtPoint(point, 10);
          if (clickedShape && clickedShape.annotation) {
            // アノテーション編集モードに入る
            setEditingShapeId(clickedShape.id);
            pendingAnnotatedShapeRef.current = {
              shapeId: clickedShape.id,
              shapeType: clickedShape.type.replace('Annotated', '') as 'rect' | 'ellipse' | 'line',
              startPos: clickedShape.startPos,
              endPos: clickedShape.endPos,
            };
            leaderStartRef.current = clickedShape.annotation.leaderLine.start;
            leaderEndRef.current = clickedShape.annotation.leaderLine.end;
            setShowAnnotationModal(true);
            return;
          }
        }

        // まずfontLabelのテキスト部分をチェック
        const fontLabelShape = selectFontLabelTextAtPoint(point, 10);
        if (fontLabelShape) {
          clearSelection();
          setSelectedFontLabelShapeId(fontLabelShape.id);
          setIsDraggingFontLabel(true);
          dragStartRef.current = point;
          lastDragPointRef.current = point;
          redrawCanvas();
          return;
        }

        // fontLabel以外をクリックした場合、fontLabel選択を解除
        if (selectedFontLabelShapeId) {
          setSelectedFontLabelShapeId(null);
        }

        // 次にアノテーション（テキスト・引出線終点）をチェック
        const annotationHit = selectAnnotationAtPoint(point, 10);
        if (annotationHit) {
          const shapes = getAllShapes();
          const shape = shapes.find(s => s.id === annotationHit.shapeId);
          if (shape) {
            // 先にclearSelectionを呼び、その後にsetSelectedAnnotationShapeIdを呼ぶ
            // （clearSelectionはselectedAnnotationShapeIdもnullにするため）
            clearSelection();
            setSelectedAnnotationShapeId(annotationHit.shapeId);

            if (annotationHit.hitType === 'leaderEnd') {
              setIsDraggingLeaderEnd(true);
            } else {
              setIsDraggingAnnotation(true);
            }
            dragStartRef.current = point;
            lastDragPointRef.current = point;
            pendingAnnotatedShapeRef.current = {
              shapeId: shape.id,
              shapeType: shape.type.replace('Annotated', '') as 'rect' | 'ellipse' | 'line',
              startPos: shape.startPos,
              endPos: shape.endPos,
            };
            redrawCanvas();
            return;
          }
        }

        // テキスト要素をチェック
        const clickedText = selectTextAtPoint(point, 10);
        if (clickedText) {
          // テキストが選択された
          const { setSelectedTextIds } = useDrawingStore.getState();
          setSelectedTextIds([clickedText.id]);
          setSelectedAnnotationShapeId(null);
          setIsDraggingText(true);
          dragStartRef.current = point;
          lastDragPointRef.current = point;
          redrawCanvas();
          return;
        }

        // 画像要素をチェック
        const clickedImage = selectImageAtPoint(point, 10);
        if (clickedImage) {
          // 画像が選択された
          setSelectedAnnotationShapeId(null);
          setIsDraggingImage(true);
          dragStartRef.current = point;
          lastDragPointRef.current = point;
          redrawCanvas();
          return;
        }

        // Check if clicking on existing selection (strokes, shapes, texts, or images)
        if (selectionBounds && isPointInSelectionBounds(point, selectionBounds)) {
          const state = useDrawingStore.getState();
          if (state.selectedImageIds.length > 0) {
            setIsDraggingImage(true);
          } else if (selectedTextIds.length > 0) {
            setIsDraggingText(true);
          } else if (selectedShapeIds.length > 0) {
            setIsDraggingShape(true);
          } else {
            setIsDragging(true);
          }
          dragStartRef.current = point;
          lastDragPointRef.current = point;
        } else {
          // Try to select an image first
          const clickedImg = selectImageAtPoint(point, 10);
          if (clickedImg) {
            setSelectedAnnotationShapeId(null);
            return;
          }
          // Try to select a shape
          const clickedShape = selectShapeAtPoint(point, 10);
          if (clickedShape) {
            // Shape selected, ready for dragging on next pointer down
            setSelectedAnnotationShapeId(null);
            return;
          }
          // Start new selection rectangle
          setIsSelecting(true);
          selectionStartRef.current = point;
          clearSelection();
          setSelectedAnnotationShapeId(null);
        }
      } else if (tool === 'text') {
        // テキストツール - クリック位置を記録してモーダル表示
        pendingTextPosRef.current = point;
        setEditingTextId(null);
        setShowTextModal(true);
      } else if (tool === 'rect' || tool === 'ellipse' || tool === 'line' || tool === 'arrow' || tool === 'doubleArrow') {
        // Start drawing shape
        setIsDrawingShape(true);
        shapeStartRef.current = point;
        currentShapeEndRef.current = point;
      } else if (tool === 'labeledRect') {
        // labeledRect（小文字指定）: 引出線フェーズを開始
        setLabeledRectPhase(1);
        labeledRectLeaderStartRef.current = point;
        shapeStartRef.current = point;
        currentShapeEndRef.current = point;
      } else if (tool === 'polyline') {
        // 折れ線ツール
        // ダブルクリック検出
        const now = Date.now();
        const timeDiff = now - lastClickTimeRef.current;
        const isDoubleClick = timeDiff < DOUBLE_CLICK_THRESHOLD &&
          lastClickPosRef.current &&
          Math.hypot(point.x - lastClickPosRef.current.x, point.y - lastClickPosRef.current.y) < DOUBLE_CLICK_DISTANCE;

        lastClickTimeRef.current = now;
        lastClickPosRef.current = point;

        if (isDoubleClick && isDrawingPolyline && polylinePointsRef.current.length >= 2) {
          // ダブルクリックで折れ線を確定
          // 始点を末尾に追加して閉じた図形にする
          const closedPoints = [...polylinePointsRef.current, { ...polylinePointsRef.current[0] }];
          addShape({
            type: 'polyline',
            startPos: polylinePointsRef.current[0],
            endPos: polylinePointsRef.current[polylinePointsRef.current.length - 1],
            color,
            width: strokeWidth,
            points: closedPoints,
          });
          // 状態をリセット
          polylinePointsRef.current = [];
          currentPolylineEndRef.current = null;
          setIsDrawingPolyline(false);
          redrawCanvas();
        } else if (isDrawingPolyline) {
          // 頂点を追加
          polylinePointsRef.current.push({ x: point.x, y: point.y });
          redrawCanvas();
        } else {
          // 折れ線の描画を開始
          setIsDrawingPolyline(true);
          polylinePointsRef.current = [{ x: point.x, y: point.y }];
          currentPolylineEndRef.current = point;
          redrawCanvas();
        }
        return;
      } else if (tool === 'image') {
        // 画像ツール - 画像が読み込まれている場合は配置を開始
        if (pendingImageRef.current) {
          setIsDrawingImage(true);
          imageStartRef.current = point;
          currentImageEndRef.current = point;
        } else {
          // 画像がまだ読み込まれていない場合はファイル選択を表示
          setShowImageInput(true);
        }
        return;
      } else if (tool === 'stamp') {
        // スタンプツール - クリックした位置にスタンプを配置
        if (currentStampType) {
          addStamp(point);
          redrawCanvas();
        }
        return;
      } else if (tool === 'rectAnnotated' || tool === 'ellipseAnnotated' || tool === 'lineAnnotated') {
        // アノテーション付き図形ツール - 図形の描画開始
        setIsDrawingShape(true);
        setAnnotationState(1);
        shapeStartRef.current = point;
        currentShapeEndRef.current = point;
      } else {
        setIsDrawing(true);
        currentStrokeRef.current = [point];

        if (tool === 'eraser') {
          eraseAt(point, strokeWidth * 2);
        }
      }
    },
    [getPointerPosition, tool, eraseAt, strokeWidth, selectionBounds, isPointInSelectionBounds, clearSelection, annotationState, isDrawingLeader, getLeaderStartPos, selectShapeAtPoint, selectedShapeIds, selectedTextIds, selectAnnotationAtPoint, selectTextAtPoint, selectImageAtPoint, getAllShapes, redrawCanvas, addShape, isDrawingPolyline, color, currentStampType, addStamp, selectFontLabelTextAtPoint, selectedFontLabelShapeId]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const point = getPointerPosition(e);

      if (tool === 'select') {
        // ホバー時のカーソル変更用
        if (!isSelecting && !isDragging && !isDraggingShape && !isDraggingAnnotation && !isDraggingLeaderEnd && !isDraggingText) {
          const annotationHit = selectAnnotationAtPoint(point, 10);
          if (annotationHit) {
            setHoverAnnotationType(annotationHit.hitType);
          } else {
            setHoverAnnotationType(null);
          }
        }

        if (isSelecting && selectionStartRef.current) {
          drawSelectionRect(selectionStartRef.current, point);
        } else if (isDraggingText && lastDragPointRef.current) {
          // テキストをドラッグ
          const dx = point.x - lastDragPointRef.current.x;
          const dy = point.y - lastDragPointRef.current.y;
          moveSelectedTexts(dx, dy);
          lastDragPointRef.current = point;
          redrawCanvas();
        } else if (isDragging && lastDragPointRef.current) {
          const dx = point.x - lastDragPointRef.current.x;
          const dy = point.y - lastDragPointRef.current.y;
          moveSelectedStrokes(dx, dy);
          lastDragPointRef.current = point;
          redrawCanvas();
        } else if (isDraggingShape && lastDragPointRef.current) {
          const dx = point.x - lastDragPointRef.current.x;
          const dy = point.y - lastDragPointRef.current.y;
          moveSelectedShapes(dx, dy);
          lastDragPointRef.current = point;
          redrawCanvas();
        } else if (isDraggingImage && lastDragPointRef.current) {
          // 画像をドラッグ
          const dx = point.x - lastDragPointRef.current.x;
          const dy = point.y - lastDragPointRef.current.y;
          moveSelectedImages(dx, dy);
          lastDragPointRef.current = point;
          redrawCanvas();
        } else if (isDraggingAnnotation && lastDragPointRef.current && pendingAnnotatedShapeRef.current) {
          // アノテーションのみを移動
          const dx = point.x - lastDragPointRef.current.x;
          const dy = point.y - lastDragPointRef.current.y;
          const pending = pendingAnnotatedShapeRef.current;
          moveAnnotationOnly(pending.shapeId, dx, dy, pending.startPos, pending.endPos, pending.shapeType);
          lastDragPointRef.current = point;
          redrawCanvas();
        } else if (isDraggingLeaderEnd && lastDragPointRef.current && pendingAnnotatedShapeRef.current) {
          // 引出線終点を移動
          const dx = point.x - lastDragPointRef.current.x;
          const dy = point.y - lastDragPointRef.current.y;
          const pending = pendingAnnotatedShapeRef.current;
          moveLeaderEnd(pending.shapeId, dx, dy, pending.startPos, pending.endPos, pending.shapeType);
          lastDragPointRef.current = point;
          redrawCanvas();
        } else if (isDraggingFontLabel && lastDragPointRef.current && selectedFontLabelShapeId) {
          // fontLabelテキストのみを移動
          const dx = point.x - lastDragPointRef.current.x;
          const dy = point.y - lastDragPointRef.current.y;
          const shapes = getAllShapes();
          const shape = shapes.find(s => s.id === selectedFontLabelShapeId);
          if (shape?.fontLabel) {
            updateShape(selectedFontLabelShapeId, {
              fontLabel: {
                ...shape.fontLabel,
                textX: shape.fontLabel.textX + dx,
                textY: shape.fontLabel.textY + dy,
              },
            });
          }
          lastDragPointRef.current = point;
          redrawCanvas();
        }
      } else if (labeledRectPhase === 1 && labeledRectLeaderStartRef.current) {
        // labeledRect: 引出線フェーズ
        const leaderStart = labeledRectLeaderStartRef.current;
        const dist = Math.hypot(point.x - leaderStart.x, point.y - leaderStart.y);
        const LEADER_LENGTH = 30;

        if (dist >= LEADER_LENGTH) {
          // 引出線が十分な長さになったら枠線フェーズに移行
          const dx = point.x - leaderStart.x;
          const dy = point.y - leaderStart.y;
          const leaderEndX = leaderStart.x + (dx / dist) * LEADER_LENGTH;
          const leaderEndY = leaderStart.y + (dy / dist) * LEADER_LENGTH;
          labeledRectLeaderEndRef.current = { x: leaderEndX, y: leaderEndY };

          // 枠線の開始点を設定（引出線終端から少し離す）
          const OFFSET_DISTANCE = 5;
          const rectStartX = leaderEndX + (dx / dist) * OFFSET_DISTANCE;
          const rectStartY = leaderEndY + (dy / dist) * OFFSET_DISTANCE;
          labeledRectStartRef.current = { x: rectStartX, y: rectStartY };
          shapeStartRef.current = { x: rectStartX, y: rectStartY };

          setLabeledRectPhase(2);
        }
        currentShapeEndRef.current = point;
        redrawCanvas();
      } else if (labeledRectPhase === 2 && labeledRectStartRef.current) {
        // labeledRect: 枠線フェーズ
        currentShapeEndRef.current = point;
        redrawCanvas();
      } else if (isDrawingShape && shapeStartRef.current) {
        // Update shape preview
        // For line/arrow tools, snap to 45-degree angles when Shift is pressed
        if ((tool === 'line' || tool === 'lineAnnotated' || tool === 'arrow' || tool === 'doubleArrow') && e.shiftKey) {
          currentShapeEndRef.current = snapLineEndpoint(shapeStartRef.current, point);
        } else {
          currentShapeEndRef.current = point;
        }
        redrawCanvas();
      } else if ((annotationState === 2 || isDrawingLeader) && pendingAnnotatedShapeRef.current) {
        // 引出線のプレビュー更新（フェーズ2またはドラッグ中）
        const pending = pendingAnnotatedShapeRef.current;
        const leaderStart = getLeaderStartPos(pending.shapeType, pending.startPos, pending.endPos, point);
        leaderStartRef.current = leaderStart;
        leaderEndRef.current = point;
        redrawCanvas();
      } else if (isDrawingPolyline && polylinePointsRef.current.length > 0) {
        // 折れ線のプレビュー更新
        currentPolylineEndRef.current = point;
        redrawCanvas();
      } else if (isDrawingImage && imageStartRef.current) {
        // 画像配置のプレビュー更新
        currentImageEndRef.current = point;
        redrawCanvas();
      } else if (isDrawing) {
        if (tool === 'eraser') {
          eraseAt(point, strokeWidth * 2);
          redrawCanvas();
        } else {
          currentStrokeRef.current.push(point);
          redrawCanvas();
        }
      }
    },
    [isDrawing, isDrawingShape, isDrawingLeader, isDrawingPolyline, isDrawingImage, isDragging, isDraggingShape, isDraggingImage, isDraggingAnnotation, isDraggingLeaderEnd, isDraggingText, isDraggingFontLabel, selectedFontLabelShapeId, isSelecting, annotationState, labeledRectPhase, getPointerPosition, tool, eraseAt, strokeWidth, redrawCanvas, drawSelectionRect, moveSelectedStrokes, moveSelectedShapes, moveSelectedImages, moveSelectedTexts, moveAnnotationOnly, moveLeaderEnd, snapLineEndpoint, getLeaderStartPos, selectAnnotationAtPoint, getAllShapes, updateShape]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (tool === 'select') {
        if (isSelecting && selectionStartRef.current) {
          const endPoint = getPointerPosition(e);
          const startPoint = selectionStartRef.current;

          const x = Math.min(startPoint.x, endPoint.x);
          const y = Math.min(startPoint.y, endPoint.y);
          const width = Math.abs(endPoint.x - startPoint.x);
          const height = Math.abs(endPoint.y - startPoint.y);

          if (width > 5 && height > 5) {
            // 矩形選択：ストロークと図形の両方を選択
            selectStrokesInRect({ x, y, width, height });
            selectShapesInRect({ x, y, width, height });
          } else {
            // 小さなクリック - まず図形を試し、なければストロークを選択
            const clickedShape = selectShapeAtPoint(endPoint, 10);
            if (!clickedShape) {
              selectStrokeAtPoint(endPoint, 10);
            }
          }

          clearSelectionCanvas();
          setIsSelecting(false);
          selectionStartRef.current = null;
        }

        if (isDragging) {
          // Save to history after drag
          const { saveToHistory } = useDrawingStore.getState();
          saveToHistory();
          setIsDragging(false);
          dragStartRef.current = null;
          lastDragPointRef.current = null;
        }

        if (isDraggingShape) {
          // Save to history after shape drag
          const { saveToHistory } = useDrawingStore.getState();
          saveToHistory();
          setIsDraggingShape(false);
          dragStartRef.current = null;
          lastDragPointRef.current = null;
        }

        if (isDraggingAnnotation) {
          // Save to history after annotation drag
          const { saveToHistory } = useDrawingStore.getState();
          saveToHistory();
          setIsDraggingAnnotation(false);
          dragStartRef.current = null;
          lastDragPointRef.current = null;
        }

        if (isDraggingLeaderEnd) {
          // Save to history after leader end drag
          const { saveToHistory } = useDrawingStore.getState();
          saveToHistory();
          setIsDraggingLeaderEnd(false);
          dragStartRef.current = null;
          lastDragPointRef.current = null;
        }

        if (isDraggingText) {
          // Save to history after text drag
          const { saveToHistory } = useDrawingStore.getState();
          saveToHistory();
          setIsDraggingText(false);
          dragStartRef.current = null;
          lastDragPointRef.current = null;
        }

        if (isDraggingImage) {
          // Save to history after image drag
          const { saveToHistory } = useDrawingStore.getState();
          saveToHistory();
          setIsDraggingImage(false);
          dragStartRef.current = null;
          lastDragPointRef.current = null;
        }

        if (isDraggingFontLabel) {
          // Save to history after fontLabel drag
          const { saveToHistory } = useDrawingStore.getState();
          saveToHistory();
          setIsDraggingFontLabel(false);
          // 選択は維持する（setSelectedFontLabelShapeId(null)を呼ばない）
          dragStartRef.current = null;
          lastDragPointRef.current = null;
        }
      } else if (labeledRectPhase === 1 && labeledRectLeaderStartRef.current) {
        // labeledRect: 引出線フェーズで離した場合（引出線が短すぎる）はキャンセル
        setLabeledRectPhase(0);
        labeledRectLeaderStartRef.current = null;
        labeledRectLeaderEndRef.current = null;
        labeledRectStartRef.current = null;
        shapeStartRef.current = null;
        currentShapeEndRef.current = null;
        redrawCanvas();
      } else if (labeledRectPhase === 2 && labeledRectStartRef.current && currentShapeEndRef.current && labeledRectLeaderStartRef.current && labeledRectLeaderEndRef.current) {
        // labeledRect: 枠線フェーズ完了 → 一文字入力モーダルを表示
        const rectStart = labeledRectStartRef.current;
        const rectEnd = currentShapeEndRef.current;
        const w = Math.abs(rectEnd.x - rectStart.x);
        const h = Math.abs(rectEnd.y - rectStart.y);

        if (w > 5 && h > 5) {
          // 正方形のサイズを計算（短い辺に合わせる）
          const minX = Math.min(rectStart.x, rectEnd.x);
          const minY = Math.min(rectStart.y, rectEnd.y);
          const size = Math.min(w, h);

          // 一文字入力モーダル用にデータを保存
          setPendingLabeledRect({
            leaderStart: { ...labeledRectLeaderStartRef.current },
            leaderEnd: { ...labeledRectLeaderEndRef.current },
            rectStart: { x: minX, y: minY },
            rectEnd: { x: minX + size, y: minY + size },
          });
          setShowLabelInputModal(true);
        }

        // フェーズをリセット
        setLabeledRectPhase(0);
        labeledRectLeaderStartRef.current = null;
        labeledRectLeaderEndRef.current = null;
        labeledRectStartRef.current = null;
        shapeStartRef.current = null;
        currentShapeEndRef.current = null;
        redrawCanvas();
      } else if (isDrawingImage && pendingImageRef.current && imageStartRef.current && currentImageEndRef.current) {
        // 画像配置を確定
        const img = pendingImageRef.current;
        const startPos = imageStartRef.current;
        const currentPos = currentImageEndRef.current;

        // アスペクト比を保持して画像サイズを計算
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const dragW = currentPos.x - startPos.x;
        const dragH = currentPos.y - startPos.y;
        let w: number, h: number;

        if (Math.abs(dragW / dragH) > imgAspect) {
          h = dragH;
          w = dragH * imgAspect * Math.sign(dragW);
        } else {
          w = dragW;
          h = dragW / imgAspect * Math.sign(dragH);
        }

        // 最小サイズチェック
        if (Math.abs(w) > 10 && Math.abs(h) > 10) {
          // 画像をBase64として保存
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.92);

            addImage({
              startPos: { x: startPos.x, y: startPos.y },
              endPos: { x: startPos.x + w, y: startPos.y + h },
              imageData,
            });
          }
        }

        // 状態をリセット
        setIsDrawingImage(false);
        imageStartRef.current = null;
        currentImageEndRef.current = null;
        pendingImageRef.current = null;
      } else if (isDrawingShape && shapeStartRef.current && currentShapeEndRef.current) {
        // Finalize shape
        const startPoint = shapeStartRef.current;
        const isLineType = tool === 'line' || tool === 'lineAnnotated' || tool === 'arrow' || tool === 'doubleArrow';
        const isAnnotated = tool === 'rectAnnotated' || tool === 'ellipseAnnotated' || tool === 'lineAnnotated';

        // For line/arrow tools, apply snap if Shift is pressed
        const endPoint = (isLineType && e.shiftKey)
          ? snapLineEndpoint(startPoint, currentShapeEndRef.current)
          : currentShapeEndRef.current;
        const w = Math.abs(endPoint.x - startPoint.x);
        const h = Math.abs(endPoint.y - startPoint.y);

        // Minimum size check (5px for rect/ellipse, any size for line)
        const isValidSize = isLineType
          ? (w > 2 || h > 2)
          : (w > 5 && h > 5);

        if (isValidSize) {
          // フォント指定の場合はfontLabelを追加
          const presetState = usePresetStore.getState();
          const selectedFont = presetState.selectedFont;
          let fontLabel: Shape['fontLabel'] = undefined;

          if (tool === 'rect' && selectedFont) {
            // フォント名ラベルの位置を計算
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

            fontLabel = {
              fontName: selectedFont.name,
              textX,
              textY,
              textAlign,
            };
          }

          // 図形を追加
          const shapeId = `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          addShape({
            type: tool as ShapeType,
            startPos: { x: startPoint.x, y: startPoint.y },
            endPos: { x: endPoint.x, y: endPoint.y },
            color,
            width: strokeWidth,
            fontLabel,
            label: tool === 'labeledRect' ? '小' : undefined,
          });

          if (isAnnotated) {
            // アノテーション付きの場合はフェーズ2へ移行（引出線が自動で追従）
            const baseType = tool.replace('Annotated', '') as 'rect' | 'ellipse' | 'line';

            // 最後に追加された図形のIDを取得
            const state = useDrawingStore.getState();
            const currentPageState = state.pages[state.currentPage];
            const allShapes = currentPageState?.layers.flatMap(l => l.shapes) || [];
            const lastShape = allShapes[allShapes.length - 1];

            pendingAnnotatedShapeRef.current = {
              shapeId: lastShape?.id || shapeId,
              shapeType: baseType,
              startPos: { x: startPoint.x, y: startPoint.y },
              endPos: { x: endPoint.x, y: endPoint.y },
            };
            setAnnotationState(2);
            setIsDrawingLeader(true); // すぐに引出線モードを開始

            // 引出線の初期位置を設定（マウス位置から）
            const mousePos = getPointerPosition(e);
            const leaderStart = getLeaderStartPos(baseType, startPoint, endPoint, mousePos);
            leaderStartRef.current = leaderStart;
            leaderEndRef.current = mousePos;
          }
        }

        setIsDrawingShape(false);
        shapeStartRef.current = null;
        currentShapeEndRef.current = null;
      } else {
        if (!isDrawing) return;

        setIsDrawing(false);

        if ((tool === 'pen' || tool === 'marker') && currentStrokeRef.current.length > 1) {
          addStroke({
            points: [...currentStrokeRef.current],
            color,
            width: strokeWidth,
            isMarker: tool === 'marker',
            opacity: tool === 'marker' ? 0.3 : undefined,
          });
        }

        currentStrokeRef.current = [];
      }

      redrawCanvas();
    },
    [tool, isDrawing, isDrawingShape, isDrawingImage, annotationState, labeledRectPhase, isDragging, isDraggingShape, isDraggingImage, isDraggingAnnotation, isDraggingLeaderEnd, isDraggingText, isDraggingFontLabel, isSelecting, addStroke, addShape, addImage, color, strokeWidth, redrawCanvas, getPointerPosition, selectStrokesInRect, selectStrokeAtPoint, selectShapeAtPoint, selectShapesInRect, clearSelectionCanvas, snapLineEndpoint, getLeaderStartPos]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  // Redraw when page changes or selection changes
  useEffect(() => {
    drawBackground();
    redrawCanvas();
  }, [currentPage, pages, drawBackground, redrawCanvas, selectedStrokeIds, selectionBounds]);

  // アノテーションテキスト入力完了時のコールバック
  const handleAnnotationSubmit = useCallback(
    (text: string, isVertical: boolean, fontSize: number) => {
      if (!pendingAnnotatedShapeRef.current || !leaderStartRef.current || !leaderEndRef.current) {
        return;
      }

      const pending = pendingAnnotatedShapeRef.current;
      const leaderStart = leaderStartRef.current;
      const leaderEnd = leaderEndRef.current;

      // テキストの位置を計算（引出線の終点からテキストを配置）
      const textX = leaderEnd.x;
      const textY = leaderEnd.y;

      // テキストの配置方向を決定（引出線の方向に基づく）
      const dx = leaderEnd.x - leaderStart.x;
      const align: 'left' | 'right' = dx >= 0 ? 'left' : 'right';

      const annotation: Annotation = {
        text,
        x: textX,
        y: textY,
        color,
        fontSize,
        isVertical,
        align,
        leaderLine: {
          start: { x: leaderStart.x, y: leaderStart.y },
          end: { x: leaderEnd.x, y: leaderEnd.y },
        },
      };

      // 図形にアノテーションを追加
      updateShapeAnnotation(pending.shapeId, annotation);

      // 状態をリセット
      setShowAnnotationModal(false);
      setAnnotationState(0);
      setEditingShapeId(null);
      pendingAnnotatedShapeRef.current = null;
      leaderStartRef.current = null;
      leaderEndRef.current = null;

      redrawCanvas();
    },
    [color, updateShapeAnnotation, redrawCanvas]
  );

  // アノテーションモーダルをキャンセル
  const handleAnnotationCancel = useCallback(() => {
    setShowAnnotationModal(false);
    setAnnotationState(0);
    setEditingShapeId(null);
    pendingAnnotatedShapeRef.current = null;
    leaderStartRef.current = null;
    leaderEndRef.current = null;
    redrawCanvas();
  }, [redrawCanvas]);

  // 編集中のアノテーション情報を取得
  const getEditingAnnotation = useCallback(() => {
    if (!editingShapeId) return null;
    const shapes = getAllShapes();
    const shape = shapes.find(s => s.id === editingShapeId);
    return shape?.annotation || null;
  }, [editingShapeId, getAllShapes]);

  // テキスト入力完了時のコールバック
  const handleTextSubmit = useCallback(
    (text: string, isVertical: boolean, fontSize: number) => {
      if (editingTextId) {
        // 編集モード
        updateText(editingTextId, { text, isVertical, fontSize });
      } else if (pendingTextPosRef.current) {
        // 新規作成モード
        addText({
          text,
          x: pendingTextPosRef.current.x,
          y: pendingTextPosRef.current.y,
          color,
          fontSize,
          isVertical,
        });
      }

      // 状態をリセット
      setShowTextModal(false);
      setEditingTextId(null);
      pendingTextPosRef.current = null;
      redrawCanvas();
    },
    [color, addText, updateText, editingTextId, redrawCanvas]
  );

  // テキストモーダルをキャンセル
  const handleTextCancel = useCallback(() => {
    setShowTextModal(false);
    setEditingTextId(null);
    pendingTextPosRef.current = null;
    redrawCanvas();
  }, [redrawCanvas]);

  // 編集中のテキスト情報を取得
  const getEditingText = useCallback(() => {
    if (!editingTextId) return null;
    const texts = getAllTexts();
    return texts.find(t => t.id === editingTextId) || null;
  }, [editingTextId, getAllTexts]);

  // 折れ線をキャンセル
  const cancelPolyline = useCallback(() => {
    polylinePointsRef.current = [];
    currentPolylineEndRef.current = null;
    setIsDrawingPolyline(false);
    redrawCanvas();
  }, [redrawCanvas]);

  // 折れ線を確定
  const finalizePolyline = useCallback(() => {
    if (polylinePointsRef.current.length >= 2) {
      // 始点を末尾に追加して閉じた図形にする
      const closedPoints = [...polylinePointsRef.current, { ...polylinePointsRef.current[0] }];
      addShape({
        type: 'polyline',
        startPos: polylinePointsRef.current[0],
        endPos: polylinePointsRef.current[polylinePointsRef.current.length - 1],
        color,
        width: strokeWidth,
        points: closedPoints,
      });
    }
    polylinePointsRef.current = [];
    currentPolylineEndRef.current = null;
    setIsDrawingPolyline(false);
    redrawCanvas();
  }, [addShape, color, strokeWidth, redrawCanvas]);

  // 折れ線の最後の頂点を削除
  const undoLastPolylinePoint = useCallback(() => {
    if (polylinePointsRef.current.length > 1) {
      polylinePointsRef.current.pop();
      redrawCanvas();
    } else if (polylinePointsRef.current.length === 1) {
      cancelPolyline();
    }
  }, [redrawCanvas, cancelPolyline]);

  // 画像ファイルを読み込む
  const loadImageFile = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          pendingImageRef.current = img;
          setShowImageInput(false);
          resolve();
        };
        img.onerror = () => {
          reject(new Error('画像の読み込みに失敗しました'));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('ファイルの読み込みに失敗しました'));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // 画像を中央に配置
  const placeImageAtCenter = useCallback(() => {
    const img = pendingImageRef.current;
    if (!img) return;

    const pageState = getCurrentPageState();
    if (!pageState) return;

    // 画像サイズを計算（最大幅200px、最大高さ300px）
    let imgWidth = Math.min(200, img.naturalWidth);
    let imgHeight = (img.naturalHeight / img.naturalWidth) * imgWidth;

    if (imgHeight > 300) {
      imgHeight = 300;
      imgWidth = (img.naturalWidth / img.naturalHeight) * imgHeight;
    }

    // 中央配置の座標を計算
    const centerX = pageState.width / 2;
    const centerY = pageState.height / 2;

    const startX = centerX - imgWidth / 2;
    const startY = centerY - imgHeight / 2;

    // 画像をBase64として保存
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.92);

      addImage({
        startPos: { x: startX, y: startY },
        endPos: { x: startX + imgWidth, y: startY + imgHeight },
        imageData,
      });
    }

    // 状態をリセット
    pendingImageRef.current = null;
    setShowImageInput(false);

    // 選択モードに切り替え
    const { setTool } = useDrawingStore.getState();
    setTool('select');

    redrawCanvas();
  }, [getCurrentPageState, addImage, redrawCanvas]);

  // 画像入力をキャンセル
  const cancelImageInput = useCallback(() => {
    setShowImageInput(false);
    pendingImageRef.current = null;
  }, []);

  return {
    canvasRef,
    backgroundCanvasRef,
    selectionCanvasRef,
    redrawCanvas,
    drawBackground,
    // アノテーションモーダル関連
    showAnnotationModal,
    handleAnnotationSubmit,
    handleAnnotationCancel,
    annotationState,
    editingShapeId,
    getEditingAnnotation,
    // アノテーション選択状態
    hoverAnnotationType,
    selectedAnnotationShapeId,
    isDraggingAnnotation,
    isDraggingLeaderEnd,
    // テキストモーダル関連
    showTextModal,
    handleTextSubmit,
    handleTextCancel,
    editingTextId,
    getEditingText,
    // 折れ線関連
    isDrawingPolyline,
    cancelPolyline,
    finalizePolyline,
    undoLastPolylinePoint,
    // 画像関連
    showImageInput,
    loadImageFile,
    placeImageAtCenter,
    cancelImageInput,
    isDrawingImage,
    // labeledRect（小文字指定）関連
    showLabelInputModal,
    pendingLabeledRect,
    setShowLabelInputModal,
    setPendingLabeledRect,
  };
};
