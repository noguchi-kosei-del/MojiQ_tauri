import * as pdfjsLib from 'pdfjs-dist';
import type { PageData, PdfAnnotationText, PdfPageInfo, PdfAnnotationSourceType } from '../types';
import { base64ToUint8ArrayAsync } from './pdfWorkerManager';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// レンダリングスケール
const RENDER_SCALE = 3.0;

// Canvas明示解放（メモリリーク防止）
function releaseCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Base64をUint8Arrayに変換（Web Worker使用で大容量データ対応）
 * - 大きいデータ: Web Workerで処理（メインスレッドブロック回避）
 * - 小さいデータ: fetch APIで処理（オーバーヘッド最小化）
 */
async function base64ToUint8Array(base64: string): Promise<Uint8Array> {
  // 大きいデータ（約75KB以上）はWeb Workerで処理
  if (base64.length >= 100000) {
    try {
      return await base64ToUint8ArrayAsync(base64);
    } catch {
      // Workerが失敗した場合はfetchにフォールバック
      console.warn('Web Worker failed, falling back to fetch');
    }
  }

  // 小さいデータまたはWorker失敗時はfetch APIで処理
  const dataUrl = `data:application/octet-stream;base64,${base64}`;
  try {
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    // 最終フォールバック: 従来のatob方式
    const pdfData = atob(base64);
    const pdfArray = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
      pdfArray[i] = pdfData.charCodeAt(i);
    }
    return pdfArray;
  }
}

// PDF色配列からHEX文字列に変換
function pdfColorToHex(pdfColor: number[] | null | undefined): string {
  if (!pdfColor || pdfColor.length < 3) {
    return '#ff0000'; // デフォルト: 赤
  }
  const r = Math.round(pdfColor[0] * 255);
  const g = Math.round(pdfColor[1] * 255);
  const b = Math.round(pdfColor[2] * 255);

  // 白または非常に薄い色（輝度が高い）の場合は赤に変換して視認性を確保
  // 輝度計算: (0.299*R + 0.587*G + 0.114*B)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luminance > 240) {
    return '#ff0000'; // 白や薄い色は赤に変換
  }

  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

// PDF座標をMojiQ座標に変換
function pdfToMojiQCoordinates(
  pdfX: number,
  pdfY: number,
  pdfHeight: number,
  scaleX: number,
  scaleY: number
): { x: number; y: number } {
  return {
    x: pdfX * scaleX,
    y: (pdfHeight - pdfY) * scaleY,
  };
}

// テキストの境界ボックスを計算
function calculateTextBounds(text: string, fontSize: number): { width: number; height: number } {
  const lines = (text || '').split('\n');
  const lineHeight = fontSize * 1.2;

  // 各行の幅を計算（半角文字は0.6、全角は1.0）
  let maxWidth = 0;
  for (const line of lines) {
    let width = 0;
    for (const char of line) {
      if (char.charCodeAt(0) < 128) {
        width += fontSize * 0.6;
      } else {
        width += fontSize;
      }
    }
    maxWidth = Math.max(maxWidth, width);
  }

  const totalHeight = lines.length * lineHeight;
  return { width: maxWidth || fontSize, height: totalHeight || lineHeight };
}

// テキスト位置をキャンバス境界内に収める
function clampTextPosition(
  x: number,
  y: number,
  textWidth: number,
  textHeight: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const margin = 5;
  let newX = x;
  let newY = y;

  // 右端チェック: テキストが右端をはみ出す場合、左にシフト
  if (newX + textWidth > canvasWidth - margin) {
    newX = canvasWidth - textWidth - margin;
  }

  // 左端チェック
  if (newX < margin) {
    newX = margin;
  }

  // 下端チェック: テキストが下端をはみ出す場合、上にシフト
  if (newY + textHeight > canvasHeight - margin) {
    newY = canvasHeight - textHeight - margin;
  }

  // 上端チェック
  if (newY < margin) {
    newY = margin;
  }

  return { x: newX, y: newY };
}

// PDF注釈をテキストオブジェクトに変換
function convertPdfAnnotationToTextObject(
  annot: {
    contents?: string;
    contentsObj?: { str?: string };
    subtype?: string;
    rect?: number[];
    color?: number[];
  },
  pdfHeight: number,
  scaleX: number,
  scaleY: number,
  displayWidth: number,
  displayHeight: number
): PdfAnnotationText | null {
  // contentsまたはcontentsObj.strからテキストを取得
  const textContent = annot.contents || annot.contentsObj?.str || '';

  // テキストがない注釈はスキップ
  if (!textContent || textContent.trim() === '') {
    return null;
  }

  // サポートする注釈タイプをチェック（Popupは除外）
  const supportedTypes: PdfAnnotationSourceType[] = ['Text', 'FreeText', 'Highlight', 'Underline', 'StrikeOut'];
  if (!annot.subtype || !supportedTypes.includes(annot.subtype as PdfAnnotationSourceType)) {
    return null;
  }

  const rect = annot.rect; // [x1, y1, x2, y2]
  if (!rect || rect.length < 4) {
    return null;
  }

  // 注釈の左上位置をMojiQ座標に変換
  const pos = pdfToMojiQCoordinates(rect[0], rect[3], pdfHeight, scaleX, scaleY);

  // 色の変換
  const color = pdfColorToHex(annot.color);

  // フォントサイズ（固定値）
  // テキストツールと同じスケール感で表示するため、固定のフォントサイズを使用
  // RENDER_SCALE（3.0）が適用されるので、論理サイズとして指定
  const fontSize = 14; // テキストツールのデフォルトと同じ

  // テキストサイズを計算（表示座標系で計算するためRENDER_SCALEを掛ける）
  const textBounds = calculateTextBounds(textContent, fontSize * RENDER_SCALE);

  // 境界内に収める
  const clampedPos = clampTextPosition(
    pos.x,
    pos.y,
    textBounds.width,
    textBounds.height,
    displayWidth,
    displayHeight
  );

  return {
    text: textContent,
    x: clampedPos.x,
    y: clampedPos.y,
    color: color,
    fontSize: fontSize,
    isVertical: false,
    // PDF注釈の種類を保持（表示/非表示フィルタリング用）
    pdfAnnotationSource: annot.subtype as PdfAnnotationSourceType,
  };
}

// PDFページから注釈を抽出
async function extractPdfAnnotations(
  page: pdfjsLib.PDFPageProxy,
  displayWidth: number,
  displayHeight: number
): Promise<PdfAnnotationText[]> {
  const annotations = await page.getAnnotations();
  const viewport = page.getViewport({ scale: 1 });

  const scaleX = displayWidth / viewport.width;
  const scaleY = displayHeight / viewport.height;

  const objects: PdfAnnotationText[] = [];

  for (const annot of annotations) {
    const obj = convertPdfAnnotationToTextObject(
      annot,
      viewport.height,
      scaleX,
      scaleY,
      displayWidth,
      displayHeight
    );
    if (obj) {
      objects.push(obj);
    }
  }

  return objects;
}

export interface PdfRenderResult {
  pages: PageData[];
  annotations: PdfAnnotationText[][]; // ページごとの注釈配列
}

// PDFドキュメントを開く（オンデマンドレンダリング用）
export interface PdfLoadResult {
  pdfDocument: pdfjsLib.PDFDocumentProxy;
  pageInfos: PdfPageInfo[];
  annotations: PdfAnnotationText[][];
}

export async function loadPdfDocument(
  pdfBase64: string,
  onProgress?: (progress: number) => void
): Promise<PdfLoadResult> {
  const pdfArray = await base64ToUint8Array(pdfBase64);

  onProgress?.(10);

  const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
  const numPages = pdf.numPages;
  const pageInfos: PdfPageInfo[] = [];
  const annotations: PdfAnnotationText[][] = [];

  onProgress?.(30);

  // 各ページの情報を取得（レンダリングはしない）
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    pageInfos.push({
      pageNumber: pageNum - 1,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      rendered: false,
    });

    // 注釈を抽出
    const pageAnnotations = await extractPdfAnnotations(
      page,
      viewport.width,
      viewport.height
    );
    annotations.push(pageAnnotations);

    const progress = 30 + (pageNum / numPages) * 60;
    onProgress?.(progress);
  }

  onProgress?.(100);

  return { pdfDocument: pdf, pageInfos, annotations };
}

// 単一ページをレンダリング
export async function renderPdfPage(
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNumber: number // 0-indexed
): Promise<string> {
  const page = await pdfDocument.getPage(pageNumber + 1);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // @ts-ignore - pdf.js types mismatch with actual API
  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  const imageData = canvas.toDataURL('image/png');

  // Canvas明示解放（メモリリーク防止）
  releaseCanvas(canvas);

  return imageData;
}

// 後方互換性のため、従来の関数も残す
export async function renderPdfToImages(
  pdfBase64: string,
  onProgress?: (progress: number) => void
): Promise<PdfRenderResult> {
  const pdfArray = await base64ToUint8Array(pdfBase64);

  onProgress?.(10); // PDF parsing started

  const pdf = await pdfjsLib.getDocument({ data: pdfArray }).promise;
  const numPages = pdf.numPages;
  const pages: PageData[] = [];
  const annotations: PdfAnnotationText[][] = [];

  onProgress?.(20); // PDF loaded

  const scale = 3.0; // High resolution rendering for quality

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // @ts-ignore - pdf.js types mismatch with actual API
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const imageData = canvas.toDataURL('image/png');

    // Canvas明示解放（メモリリーク防止）
    releaseCanvas(canvas);

    // Use rendered size for display (high resolution)
    pages.push({
      page_number: pageNum - 1,
      image_data: imageData,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    });

    // PDFアノテーションを抽出
    const pageAnnotations = await extractPdfAnnotations(
      page,
      viewport.width,
      viewport.height
    );
    annotations.push(pageAnnotations);

    // Calculate progress: 20% for loading, 80% for rendering pages
    const renderProgress = 20 + (pageNum / numPages) * 80;
    onProgress?.(renderProgress);
  }

  return { pages, annotations };
}
