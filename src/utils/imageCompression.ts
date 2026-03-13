/**
 * 画像・PDF圧縮ユーティリティ
 * 旧MojiQ ver_2.08からの移植
 *
 * Canvas経由での圧縮処理を提供
 */

import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { THRESHOLDS } from '../constants/loadingLimits';

// PDF.jsワーカーの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/** 圧縮進捗コールバック */
export type CompressionProgressCallback = (current: number, total: number) => void;

/** 圧縮結果 */
export interface CompressionResult {
  /** 圧縮後のデータ */
  data: Uint8Array | null;
  /** 元のデータ */
  originalData: Uint8Array | null;
  /** 圧縮されたかどうか */
  wasCompressed: boolean;
  /** 最適化されたかどうか */
  wasOptimized: boolean;
  /** キャンセルされたかどうか */
  cancelled: boolean;
}

/**
 * 画像をCanvas経由で圧縮
 * @param dataUrl - Base64 Data URL
 * @param quality - 圧縮品質 (0.0-1.0)
 * @returns 圧縮後のData URL
 */
export async function compressImage(
  dataUrl: string,
  quality: number = THRESHOLDS.IMAGE_COMPRESS_QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2Dコンテキストの取得に失敗しました'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      // JPEG形式で圧縮
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      // メモリ解放
      canvas.width = 0;
      canvas.height = 0;

      resolve(compressedDataUrl);
    };
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = dataUrl;
  });
}

/**
 * 複数画像を圧縮
 * @param dataUrls - Base64 Data URL配列
 * @param quality - 圧縮品質
 * @param onProgress - 進捗コールバック
 */
export async function compressImages(
  dataUrls: string[],
  quality: number = THRESHOLDS.IMAGE_COMPRESS_QUALITY,
  onProgress?: CompressionProgressCallback
): Promise<string[]> {
  const results: string[] = [];

  for (let i = 0; i < dataUrls.length; i++) {
    const compressed = await compressImage(dataUrls[i], quality);
    results.push(compressed);
    onProgress?.(i + 1, dataUrls.length);

    // UIブロック回避
    await nextFrame();
  }

  return results;
}

/**
 * PDFをCanvas経由で圧縮（画質を維持したロスレス圧縮）
 * 各ページをCanvasにレンダリングし、jsPDFで再構成
 *
 * @param pdfData - 元のPDFデータ
 * @param onProgress - 進捗コールバック
 * @returns 圧縮されたPDFデータ
 */
export async function compressPdfViaCanvas(
  pdfData: Uint8Array,
  onProgress?: CompressionProgressCallback
): Promise<Uint8Array> {
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  let newPdf: jsPDF | null = null;

  try {
    // PDF.jsでPDFを読み込み
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.530/cmaps/',
      cMapPacked: true,
    });
    pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    for (let i = 1; i <= numPages; i++) {
      await nextFrame();
      onProgress?.(i, numPages);

      let page: pdfjsLib.PDFPageProxy | null = null;
      try {
        page = await pdfDoc.getPage(i);
      } catch (pageError) {
        throw new Error(`ページ ${i} の読み込みに失敗しました`);
      }

      const originalViewport = page.getViewport({ scale: 1.0 });
      // 2倍スケールでレンダリング（品質維持）
      const renderScale = 2.0;
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas 2Dコンテキストの取得に失敗しました');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      try {
        await page.render({
          canvasContext: context,
          viewport: viewport,
          // pdfjs-dist 5.x requires canvas but it's optional at runtime
        } as Parameters<typeof page.render>[0]).promise;
      } catch (renderError) {
        canvas.width = 0;
        canvas.height = 0;
        throw new Error(`ページ ${i} のレンダリングに失敗しました`);
      }

      const imgData = canvas.toDataURL('image/png');

      // PDFのポイント単位に変換 (72 DPI)
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
        newPdf!.addPage([pageWidthPt, pageHeightPt], orient as 'l' | 'p');
      }

      newPdf!.addImage(imgData, 'PNG', 0, 0, pageWidthPt, pageHeightPt, undefined, 'SLOW');

      // メモリ解放
      canvas.width = 0;
      canvas.height = 0;
    }

    if (!newPdf) {
      throw new Error('PDFの作成に失敗しました');
    }

    const compressedArrayBuffer = newPdf.output('arraybuffer');
    return new Uint8Array(compressedArrayBuffer);
  } finally {
    // PDF.jsドキュメントを解放
    if (pdfDoc) {
      await pdfDoc.destroy();
    }
  }
}

/**
 * UIブロック回避用の次フレーム待機
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * ArrayBufferからUint8Arrayに変換
 */
export function arrayBufferToUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

/**
 * FileからUint8Arrayに変換
 */
export async function fileToUint8Array(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
