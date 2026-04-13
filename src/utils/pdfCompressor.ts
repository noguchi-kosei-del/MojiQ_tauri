/**
 * PDF圧縮ユーティリティ
 * 旧MojiQ ver_2.18 の pdf-compress.js を TypeScript に移植
 * Canvas経由でPDFを再構築し、ファイルサイズを削減する
 */
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { base64ToUint8ArrayAsync } from './pdfWorkerManager';
import { THRESHOLDS } from '../constants/loadingLimits';

export const PDF_COMPRESSION_THRESHOLD = THRESHOLDS.PDF_SIZE_LIMIT; // 300MB

/** 圧縮用レンダリングスケール（旧MojiQ準拠: 2.0x） */
const COMPRESS_RENDER_SCALE = 2.0;

/**
 * Base64をUint8Arrayに変換
 */
async function base64ToUint8Array(base64: string): Promise<Uint8Array> {
  if (base64.length >= 100000) {
    try {
      return await base64ToUint8ArrayAsync(base64);
    } catch {
      console.warn('Web Worker failed, falling back to fetch');
    }
  }

  const dataUrl = `data:application/octet-stream;base64,${base64}`;
  try {
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch {
    const pdfData = atob(base64);
    const pdfArray = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
      pdfArray[i] = pdfData.charCodeAt(i);
    }
    return pdfArray;
  }
}

/**
 * Uint8ArrayをBase64文字列に非同期変換
 */
async function uint8ArrayToBase64Async(data: Uint8Array): Promise<string> {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Base64エンコードに失敗しました'));
    reader.readAsDataURL(blob);
  });
}

/**
 * UIブロック回避用のフレーム待ち
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Canvas経由でPDFを圧縮する（旧MojiQのcompressPdfViaCanvasを移植）
 *
 * 各ページをpdf.jsでCanvas(2.0xスケール)にレンダリングし、
 * jsPDFで圧縮付きPDFとして再構築する。
 *
 * @param pdfBase64 - 元のPDFデータ（base64文字列）
 * @param onProgress - 進捗コールバック (currentPage, totalPages)
 * @param isCancelled - キャンセル判定関数
 * @returns 圧縮後のPDFデータ（base64文字列）
 * @throws Error('CANCELLED') キャンセル時
 */
export async function compressPdfViaCanvas(
  pdfBase64: string,
  onProgress?: (current: number, total: number) => void,
  isCancelled?: () => boolean,
): Promise<string> {
  const checkCancelled = isCancelled || (() => false);

  if (checkCancelled()) {
    throw new Error('CANCELLED');
  }

  // base64 → Uint8Array
  const typedArray = await base64ToUint8Array(pdfBase64);

  // pdf.jsでPDFをロード
  const loadingTask = pdfjsLib.getDocument({ data: typedArray });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  let newPdf: jsPDF | null = null;

  for (let i = 1; i <= numPages; i++) {
    if (checkCancelled()) {
      throw new Error('CANCELLED');
    }

    await nextFrame();
    onProgress?.(i, numPages);

    const page = await pdfDoc.getPage(i);

    const originalViewport = page.getViewport({ scale: 1.0 });
    const viewport = page.getViewport({ scale: COMPRESS_RENDER_SCALE });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2Dコンテキストの取得に失敗しました');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    try {
      // @ts-ignore - pdf.js types mismatch with actual API
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
    } catch (renderError) {
      canvas.width = 0;
      canvas.height = 0;
      throw new Error(`ページ ${i} のレンダリングに失敗しました`);
    }

    // Canvas → PNG dataURL
    const imgData = canvas.toDataURL('image/png');

    // ページサイズ（pt単位）
    const pageWidthPt = (originalViewport.width * 72) / 96;
    const pageHeightPt = (originalViewport.height * 72) / 96;

    if (i === 1) {
      const orientation = pageWidthPt > pageHeightPt ? 'l' : 'p';
      newPdf = new jsPDF({
        orientation: orientation as 'l' | 'p',
        unit: 'pt',
        format: [pageWidthPt, pageHeightPt],
        compress: true,
      });
    } else {
      const orient = pageWidthPt > pageHeightPt ? 'l' : 'p';
      newPdf!.addPage([pageWidthPt, pageHeightPt], orient);
    }

    newPdf!.addImage(imgData, 'PNG', 0, 0, pageWidthPt, pageHeightPt, undefined, 'SLOW');

    // Canvas解放（メモリリーク防止）
    canvas.width = 0;
    canvas.height = 0;
  }

  if (!newPdf) {
    throw new Error('PDFの作成に失敗しました');
  }

  // 圧縮PDFをArrayBufferとして出力 → base64変換
  const compressedArrayBuffer = newPdf.output('arraybuffer');
  const compressedData = new Uint8Array(compressedArrayBuffer);
  const compressedBase64 = await uint8ArrayToBase64Async(compressedData);

  return compressedBase64;
}
