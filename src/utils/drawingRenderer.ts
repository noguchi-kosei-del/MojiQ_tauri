/**
 * 描画レンダラー
 * ページの描画データをCanvasにレンダリングし、PDF保存用のPNG画像を生成する
 */

import { PageState, Stroke, Shape, TextElement, ImageElement, Annotation, StampType } from '../types';
import { formatFontFamily } from './fontService';
import { useDisplayScaleStore } from '../stores/displayScaleStore';

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
      yonbunakiStamp: '四分アキ',
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
function drawAnnotation(ctx: CanvasRenderingContext2D, annotation: Annotation, shapeColor: string, rs: number = 1): void {
  const { leaderLine, text, x, y, fontSize, isVertical, align, color: annColor, fontFamily } = annotation;
  const color = annColor || shapeColor;
  const scaledFontSize = fontSize * rs;

  // 引出線を描画
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * rs;
  ctx.moveTo(leaderLine.start.x, leaderLine.start.y);
  ctx.lineTo(leaderLine.end.x, leaderLine.end.y);
  ctx.stroke();

  // 引出線の起点に●を描画
  ctx.beginPath();
  ctx.arc(leaderLine.start.x, leaderLine.start.y, 3 * rs, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // テキストを描画
  if (text) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${scaledFontSize}px ${formatFontFamily(fontFamily)}`;

    const lines = text.split('\n');
    const lineHeight = scaledFontSize * 1.2;

    // 白い縁取り付きでテキストを描画
    const outlineWidth = Math.max(2, scaledFontSize * 0.22);
    const drawWithOutline = (char: string, px: number, py: number) => {
      ctx.save();
      ctx.lineWidth = outlineWidth;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(char, px, py);
      ctx.restore();
      ctx.fillText(char, px, py);
    };

    if (isVertical) {
      // 縦書き
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const verticalLineHeight = scaledFontSize * 1.1;
      const punctuationChars = ['、', '。', '，', '．', '｡', '､'];

      lines.forEach((line, colIndex) => {
        const currentX = x - (colIndex * verticalLineHeight);
        let cursorY = 0;
        const chars = Array.from(line);

        chars.forEach((char) => {
          const currentY = y + cursorY + scaledFontSize / 2;
          if (char === ' ') {
            cursorY += scaledFontSize * 0.3;
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
            const offsetX = scaledFontSize * 0.7;
            const offsetY = -scaledFontSize * 0.55;
            drawWithOutline(char, currentX + offsetX, currentY + offsetY);
          } else {
            drawWithOutline(char, currentX, currentY);
          }

          cursorY += scaledFontSize;
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
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, rs: number = 1): void {
  if (stroke.points.length < 2) return;

  ctx.save();

  // マーカーの場合は半透明で描画
  if (stroke.isMarker) {
    ctx.globalAlpha = stroke.opacity || 0.3;
    ctx.globalCompositeOperation = 'multiply';
  }

  const scaledWidth = stroke.width * rs;

  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const points = stroke.points;
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const pressure = point.pressure || 0.5;
    ctx.lineWidth = stroke.isMarker ? scaledWidth : scaledWidth * (0.5 + pressure);
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.restore();
}

/**
 * 図形を描画
 */
function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, rs: number = 1): void {
  ctx.save();

  const { startPos, endPos, type } = shape;

  // スタンプの場合
  if (type === 'stamp' && shape.stampType) {
    const stampSize = (shape.size || 20) * rs;
    const stampColor = shape.color;

    // 引出線がある場合は描画
    if (shape.leaderLine) {
      ctx.beginPath();
      ctx.strokeStyle = stampColor;
      ctx.lineWidth = 2 * rs;
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

  // 回転変換を適用
  if (shape.rotation) {
    const cx = (startPos.x + endPos.x) / 2;
    const cy = (startPos.y + endPos.y) / 2;
    ctx.translate(cx, cy);
    ctx.rotate(shape.rotation);
    ctx.translate(-cx, -cy);
  }

  const scaledWidth = shape.width * rs;

  ctx.beginPath();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = scaledWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const baseType = type.replace('Annotated', '') as 'rect' | 'ellipse' | 'line' | 'arrow' | 'doubleArrow' | 'polyline' | 'semicircle' | 'chevron' | 'lshape' | 'zshape' | 'bracket';

  if (baseType === 'rect') {
    const w = endPos.x - startPos.x;
    const h = endPos.y - startPos.y;
    ctx.rect(startPos.x, startPos.y, w, h);
    ctx.stroke();

    // フォントラベルを描画（フォント指定枠線の場合）
    if (shape.fontLabel) {
      const { fontName, textX, textY, textAlign } = shape.fontLabel;
      const labelFontSize = 16 * rs;
      ctx.font = `bold ${labelFontSize}px sans-serif`;
      ctx.fillStyle = shape.color;
      ctx.textAlign = textAlign;
      ctx.textBaseline = endPos.y > startPos.y ? 'top' : 'bottom';

      // 白い縁取り
      ctx.save();
      ctx.lineWidth = 4 * rs;
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

    const headLen = Math.max(8 * rs, scaledWidth * 3);
    const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
    drawArrowHead(ctx, endPos.x, endPos.y, angle, headLen);
  } else if (baseType === 'doubleArrow') {
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();

    const headLen = Math.max(8 * rs, scaledWidth * 3);
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
      const dotRadius = Math.max(scaledWidth, 2 * rs);
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
      const labelFontSize = Math.max(10 * rs, Math.min(16 * rs, size * 0.4));
      const padding = 3 * rs;
      const labelX = minX + size - padding;
      const labelY = minY + size - padding;

      ctx.font = `bold ${labelFontSize}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';

      // 白フチを描画
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * rs;
      ctx.lineJoin = 'round';
      ctx.strokeText(label, labelX, labelY);
      ctx.restore();

      // テキスト本体を描画
      ctx.fillStyle = shape.color;
      ctx.fillText(label, labelX, labelY);
    }
  } else if (baseType === 'semicircle') {
    // 半円ツール
    const w = Math.abs(endPos.x - startPos.x);
    const h = Math.abs(endPos.y - startPos.y);
    const cx = startPos.x + (endPos.x - startPos.x) / 2;
    const cy = startPos.y + (endPos.y - startPos.y) / 2;
    const orientation = shape.orientation || (h > w ? 'vertical' : 'horizontal');
    if (orientation === 'vertical') {
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, -0.5 * Math.PI, 0.5 * Math.PI);
    } else {
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, Math.PI, 2 * Math.PI);
    }
    ctx.stroke();
  } else if (baseType === 'chevron') {
    // くの字ツール
    const topY = Math.min(startPos.y, endPos.y);
    const bottomY = Math.max(startPos.y, endPos.y);
    const leftX = Math.min(startPos.x, endPos.x);
    const rightX = Math.max(startPos.x, endPos.x);
    const midY = (topY + bottomY) / 2;
    const midX = (leftX + rightX) / 2;
    const orientation = shape.orientation || 'vertical';
    if (orientation === 'vertical') {
      ctx.moveTo(rightX, topY);
      ctx.lineTo(leftX, midY);
      ctx.lineTo(rightX, bottomY);
    } else {
      ctx.moveTo(leftX, topY);
      ctx.lineTo(midX, bottomY);
      ctx.lineTo(rightX, topY);
    }
    ctx.stroke();
  } else if (baseType === 'lshape') {
    // L字ツール
    const topY = Math.min(startPos.y, endPos.y);
    const bottomY = Math.max(startPos.y, endPos.y);
    const leftX = Math.min(startPos.x, endPos.x);
    const rightX = Math.max(startPos.x, endPos.x);
    const direction = shape.direction ?? 0;
    if (direction === 0) {
      ctx.moveTo(leftX, bottomY);
      ctx.lineTo(leftX, topY);
      ctx.lineTo(rightX, topY);
    } else if (direction === 1) {
      ctx.moveTo(rightX, bottomY);
      ctx.lineTo(rightX, topY);
      ctx.lineTo(leftX, topY);
    } else if (direction === 2) {
      ctx.moveTo(leftX, topY);
      ctx.lineTo(leftX, bottomY);
      ctx.lineTo(rightX, bottomY);
    } else {
      ctx.moveTo(rightX, topY);
      ctx.lineTo(rightX, bottomY);
      ctx.lineTo(leftX, bottomY);
    }
    ctx.stroke();
  } else if (baseType === 'zshape') {
    // Z字ツール
    const rotated = shape.rotated === true;
    if (rotated) {
      const midX = startPos.x + (endPos.x - startPos.x) / 2;
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(midX, startPos.y);
      ctx.lineTo(midX, endPos.y);
      ctx.lineTo(endPos.x, endPos.y);
    } else {
      const midY = startPos.y + (endPos.y - startPos.y) / 2;
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(startPos.x, midY);
      ctx.lineTo(endPos.x, midY);
      ctx.lineTo(endPos.x, endPos.y);
    }
    ctx.stroke();
  } else if (baseType === 'bracket') {
    // コの字ツール
    const w = Math.abs(endPos.x - startPos.x);
    const h = Math.abs(endPos.y - startPos.y);
    const topY = Math.min(startPos.y, endPos.y);
    const bottomY = Math.max(startPos.y, endPos.y);
    const leftX = Math.min(startPos.x, endPos.x);
    const rightX = Math.max(startPos.x, endPos.x);
    const serifSize = Math.min(w, h) * 0.15;
    const orientation = shape.orientation || (h > w ? 'vertical' : 'horizontal');
    const flipped = shape.flipped === true;

    if (orientation === 'vertical') {
      if (!flipped) {
        ctx.moveTo(leftX, topY);
        ctx.lineTo(rightX, topY);
        ctx.lineTo(rightX, bottomY);
        ctx.lineTo(leftX, bottomY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(leftX, topY);
        ctx.lineTo(leftX, topY - serifSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(leftX, bottomY);
        ctx.lineTo(leftX, bottomY + serifSize);
        ctx.stroke();
      } else {
        ctx.moveTo(rightX, topY);
        ctx.lineTo(leftX, topY);
        ctx.lineTo(leftX, bottomY);
        ctx.lineTo(rightX, bottomY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightX, topY);
        ctx.lineTo(rightX, topY - serifSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightX, bottomY);
        ctx.lineTo(rightX, bottomY + serifSize);
        ctx.stroke();
      }
    } else {
      if (flipped) {
        ctx.moveTo(leftX, topY);
        ctx.lineTo(leftX, bottomY);
        ctx.lineTo(rightX, bottomY);
        ctx.lineTo(rightX, topY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(leftX, topY);
        ctx.lineTo(leftX - serifSize, topY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightX, topY);
        ctx.lineTo(rightX + serifSize, topY);
        ctx.stroke();
      } else {
        ctx.moveTo(leftX, bottomY);
        ctx.lineTo(leftX, topY);
        ctx.lineTo(rightX, topY);
        ctx.lineTo(rightX, bottomY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(leftX, bottomY);
        ctx.lineTo(leftX - serifSize, bottomY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightX, bottomY);
        ctx.lineTo(rightX + serifSize, bottomY);
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  // アノテーション（引出線 + テキスト）を描画
  if (shape.annotation) {
    drawAnnotation(ctx, shape.annotation, shape.color, rs);
  }
}

/**
 * テキストを描画
 */
function drawText(ctx: CanvasRenderingContext2D, textElement: TextElement, rs: number = 1): void {
  const { text, x, y, fontSize, isVertical, color: textColor, fontFamily } = textElement;

  if (!text) return;

  const scaledFontSize = fontSize * rs;

  ctx.save();
  ctx.fillStyle = textColor;
  ctx.font = `${scaledFontSize}px ${formatFontFamily(fontFamily)}`;

  const lines = text.split('\n');
  const lineHeight = scaledFontSize * 1.2;

  // 白い縁取り付きでテキストを描画
  const outlineWidth = Math.max(2, scaledFontSize * 0.22);
  const drawWithOutline = (char: string, px: number, py: number) => {
    ctx.save();
    ctx.lineWidth = outlineWidth;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(char, px, py);
    ctx.restore();
    ctx.fillText(char, px, py);
  };

  if (isVertical) {
    // 縦書き
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const verticalLineHeight = scaledFontSize * 1.1;
    const punctuationChars = ['、', '。', '，', '．', '｡', '､'];

    lines.forEach((line, colIndex) => {
      const currentX = x - (colIndex * verticalLineHeight);
      let cursorY = 0;
      const chars = Array.from(line);

      chars.forEach((char) => {
        const currentY = y + cursorY + scaledFontSize / 2;
        if (char === ' ') {
          cursorY += scaledFontSize * 0.3;
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
          const offsetX = scaledFontSize * 0.7;
          const offsetY = -scaledFontSize * 0.55;
          drawWithOutline(char, currentX + offsetX, currentY + offsetY);
        } else {
          drawWithOutline(char, currentX, currentY);
        }

        cursorY += scaledFontSize;
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

  // 回転変換を適用
  if (imageElement.rotation) {
    const cx = (startPos.x + endPos.x) / 2;
    const cy = (startPos.y + endPos.y) / 2;
    ctx.translate(cx, cy);
    ctx.rotate(imageElement.rotation);
    ctx.translate(-cx, -cy);
  }

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
 * 描画データで使用されているカスタムフォントをプリロードする
 * 保存処理の前に1回だけ呼ぶ
 */
export async function preloadDrawingFonts(pages: PageState[]): Promise<void> {
  if (!document.fonts) return;
  const families = new Set<string>();
  const generic = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  for (const page of pages) {
    for (const layer of page.layers) {
      for (const t of layer.texts) {
        if (t.fontFamily && !generic.has(t.fontFamily)) families.add(t.fontFamily);
      }
      for (const s of layer.shapes) {
        if (s.annotation?.fontFamily && !generic.has(s.annotation.fontFamily)) families.add(s.annotation.fontFamily);
      }
    }
  }
  if (families.size > 0) {
    await Promise.all(
      Array.from(families).map(f => document.fonts.load(`16px "${f}"`).catch(() => {}))
    );
  }
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

  // 画面描画時はストロークwidth・テキストfontSizeにrenderScale(1/baseScale)を掛けているが、
  // 座標はキャンバス内部解像度のままなので、ctx.scale()での全体補正は不可。
  // 代わりに各描画関数にrenderScaleを渡して線幅・フォントサイズを個別補正する。
  const bs = useDisplayScaleStore.getState().baseScale;
  const renderScale = bs > 0 ? 1 / bs : 1;

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
      drawStroke(ctx, stroke, renderScale);
    }

    // 図形を描画
    for (const shape of layer.shapes) {
      drawShape(ctx, shape, renderScale);
    }

    // テキストを描画
    for (const textElement of layer.texts) {
      // コメント非表示モードの場合、PDF注釈由来のテキストをスキップ
      if (hideComments && textElement.pdfAnnotationSource) {
        continue;
      }
      drawText(ctx, textElement, renderScale);
    }
  }

  // PNGとしてBase64エンコード（toBlobで非同期化しメインスレッドブロックを軽減）
  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        // フォールバック
        resolve(canvas.toDataURL('image/png'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
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
