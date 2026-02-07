import * as pdfjsLib from 'pdfjs-dist';
import type { PageData, PdfAnnotationText, PdfPageInfo, PdfAnnotationSourceType } from '../types';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// レンダリングスケール
const RENDER_SCALE = 3.0;

// PDF色配列からHEX文字列に変換
function pdfColorToHex(pdfColor: number[] | null | undefined): string {
  if (!pdfColor || pdfColor.length < 3) {
    return '#ff0000'; // デフォルト: 赤
  }
  const r = Math.round(pdfColor[0] * 255);
  const g = Math.round(pdfColor[1] * 255);
  const b = Math.round(pdfColor[2] * 255);
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
  scaleY: number
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

  // フォントサイズ（スケールに合わせて大きめに設定）
  const fontSize = annot.subtype === 'FreeText' ? 48 : 42;

  return {
    text: textContent,
    x: pos.x,
    y: pos.y,
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
      scaleY
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
  const pdfData = atob(pdfBase64);
  const pdfArray = new Uint8Array(pdfData.length);
  for (let i = 0; i < pdfData.length; i++) {
    pdfArray[i] = pdfData.charCodeAt(i);
  }

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

  return canvas.toDataURL('image/png');
}

// 後方互換性のため、従来の関数も残す
export async function renderPdfToImages(
  pdfBase64: string,
  onProgress?: (progress: number) => void
): Promise<PdfRenderResult> {
  const pdfData = atob(pdfBase64);
  const pdfArray = new Uint8Array(pdfData.length);
  for (let i = 0; i < pdfData.length; i++) {
    pdfArray[i] = pdfData.charCodeAt(i);
  }

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
