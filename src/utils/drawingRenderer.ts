/**
 * 描画レンダラー
 * ページの描画データをCanvasにレンダリングし、PDF保存用のPNG画像を生成する
 */

import { PageState, Stroke, Shape, TextElement, ImageElement, Annotation, StampType } from '../types';

/**
 * 矢頭を描画するヘルパー関数
 */
function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, headLen: number): void {
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
}

/**
 * スタンプを描画
 */
function drawStamp(ctx: CanvasRenderingContext2D, x: number, y: number, stampType: StampType, size: number, stampColor: string): void {
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
      tojiruStamp: 'とじる',
      hirakuStamp: 'ひらく',
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
}

/**
 * アノテーション（引出線 + テキスト）を描画
 */
function drawAnnotation(ctx: CanvasRenderingContext2D, annotation: Annotation, shapeColor: string): void {
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
}

/**
 * ストロークを描画
 */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.points.length < 2) return;

  ctx.save();

  // マーカーの場合は半透明で描画
  if (stroke.isMarker) {
    ctx.globalAlpha = stroke.opacity || 0.3;
    ctx.globalCompositeOperation = 'multiply';
  }

  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const points = stroke.points;
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const pressure = point.pressure || 0.5;
    ctx.lineWidth = stroke.isMarker ? stroke.width : stroke.width * (0.5 + pressure);
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.restore();
}

/**
 * 図形を描画
 */
function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  ctx.save();

  const { startPos, endPos, type } = shape;

  // スタンプの場合
  if (type === 'stamp' && shape.stampType) {
    const stampSize = shape.size || 20;
    const stampColor = shape.color;

    // 引出線がある場合は描画
    if (shape.leaderLine) {
      ctx.beginPath();
      ctx.strokeStyle = stampColor;
      ctx.lineWidth = 2;
      ctx.moveTo(shape.leaderLine.start.x, shape.leaderLine.start.y);
      ctx.lineTo(shape.leaderLine.end.x, shape.leaderLine.end.y);
      ctx.stroke();

      // 引出線の先端（開始点）に●を描画
      const dotRadius = Math.max(2, 3);
      ctx.beginPath();
      ctx.arc(shape.leaderLine.start.x, shape.leaderLine.start.y, dotRadius, 0, 2 * Math.PI);
      ctx.fillStyle = stampColor;
      ctx.fill();
    }

    drawStamp(ctx, startPos.x, startPos.y, shape.stampType, stampSize, stampColor);
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.strokeStyle = shape.color;
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
    if (shape.fontLabel) {
      const { fontName, textX, textY, textAlign } = shape.fontLabel;
      const labelFontSize = 16;
      ctx.font = `bold ${labelFontSize}px sans-serif`;
      ctx.fillStyle = shape.color;
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
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();

    const headLen = Math.max(8, shape.width * 3);
    const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
    drawArrowHead(ctx, endPos.x, endPos.y, angle, headLen);
  } else if (baseType === 'doubleArrow') {
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();

    const headLen = Math.max(8, shape.width * 3);
    const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
    drawArrowHead(ctx, endPos.x, endPos.y, angle, headLen);
    drawArrowHead(ctx, startPos.x, startPos.y, angle + Math.PI, headLen);
  } else if (baseType === 'polyline') {
    const points = shape.points || [];
    if (points.length >= 2) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
  } else if (type === 'labeledRect') {
    // ラベル付き枠線（小文字指定）

    // 引出線を描画
    if (shape.leaderLine) {
      ctx.beginPath();
      ctx.moveTo(shape.leaderLine.start.x, shape.leaderLine.start.y);
      ctx.lineTo(shape.leaderLine.end.x, shape.leaderLine.end.y);
      ctx.stroke();

      // 先端に●を描画
      const dotRadius = Math.max(shape.width, 2);
      ctx.beginPath();
      ctx.arc(shape.leaderLine.start.x, shape.leaderLine.start.y, dotRadius, 0, 2 * Math.PI);
      ctx.fillStyle = shape.color;
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
    const label = shape.label || '小';
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
      ctx.fillStyle = shape.color;
      ctx.fillText(label, labelX, labelY);
    }
  }

  ctx.restore();

  // アノテーション（引出線 + テキスト）を描画
  if (shape.annotation) {
    drawAnnotation(ctx, shape.annotation, shape.color);
  }
}

/**
 * テキストを描画
 */
function drawText(ctx: CanvasRenderingContext2D, textElement: TextElement): void {
  const { text, x, y, fontSize, isVertical, color: textColor } = textElement;

  if (!text) return;

  ctx.save();
  ctx.fillStyle = textColor;
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
}

/**
 * 画像を描画（同期版 - 事前にロード済みの画像を使用）
 */
function drawImageSync(ctx: CanvasRenderingContext2D, imageElement: ImageElement, loadedImage: HTMLImageElement): void {
  const { startPos, endPos } = imageElement;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const w = endPos.x - startPos.x;
  const h = endPos.y - startPos.y;
  ctx.drawImage(loadedImage, startPos.x, startPos.y, w, h);

  ctx.restore();
}

/**
 * 画像をロードする
 */
async function loadImage(imageData: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}

/**
 * ページの描画データをCanvasにレンダリング
 */
export async function renderPageDrawingsToCanvas(
  pageState: PageState,
  options?: {
    scale?: number;
    hideComments?: boolean;
  }
): Promise<string> {
  const scale = options?.scale || 1;
  const hideComments = options?.hideComments || false;

  // キャンバスを作成
  const canvas = document.createElement('canvas');
  canvas.width = pageState.width * scale;
  canvas.height = pageState.height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // スケール変換を適用
  ctx.scale(scale, scale);

  // 表示レイヤーの全要素を収集
  const visibleLayers = pageState.layers.filter((l) => l.visible);

  // 画像を事前にロード
  const imageLoadPromises: Promise<{ element: ImageElement; image: HTMLImageElement }>[] = [];
  for (const layer of visibleLayers) {
    for (const imageElement of layer.images) {
      imageLoadPromises.push(
        loadImage(imageElement.imageData).then((image) => ({ element: imageElement, image }))
      );
    }
  }
  const loadedImages = await Promise.all(imageLoadPromises);
  const imageMap = new Map<string, HTMLImageElement>();
  for (const { element, image } of loadedImages) {
    imageMap.set(element.id, image);
  }

  // 描画順序: images -> strokes -> shapes -> texts
  for (const layer of visibleLayers) {
    // 画像を描画
    for (const imageElement of layer.images) {
      const loadedImage = imageMap.get(imageElement.id);
      if (loadedImage) {
        drawImageSync(ctx, imageElement, loadedImage);
      }
    }

    // ストロークを描画
    for (const stroke of layer.strokes) {
      drawStroke(ctx, stroke);
    }

    // 図形を描画
    for (const shape of layer.shapes) {
      drawShape(ctx, shape);
    }

    // テキストを描画
    for (const textElement of layer.texts) {
      // コメント非表示モードの場合、PDF注釈由来のテキストをスキップ
      if (hideComments && textElement.pdfAnnotationSource) {
        continue;
      }
      drawText(ctx, textElement);
    }
  }

  // PNGとしてBase64エンコード
  return canvas.toDataURL('image/png');
}

/**
 * ページに描画データがあるかチェック
 */
export function hasDrawings(pageState: PageState): boolean {
  for (const layer of pageState.layers) {
    if (layer.strokes.length > 0 ||
        layer.shapes.length > 0 ||
        layer.texts.length > 0 ||
        layer.images.length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * 全ページの描画データをPNGにレンダリング
 */
export async function renderAllPagesToOverlays(
  pages: PageState[],
  options?: {
    scale?: number;
    hideComments?: boolean;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<Map<number, string>> {
  const overlays = new Map<number, string>();
  const total = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    // 描画データがある場合のみレンダリング
    if (hasDrawings(page)) {
      const overlay = await renderPageDrawingsToCanvas(page, options);
      overlays.set(page.pageNumber, overlay);
    }

    if (options?.onProgress) {
      options.onProgress(i + 1, total);
    }
  }

  return overlays;
}
