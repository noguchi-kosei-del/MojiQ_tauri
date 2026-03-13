// src/utils/pageNumberUtils.ts - 横長原稿のページ番号計算ユーティリティ

import { PageState } from '../types';

/**
 * ドキュメントが横長原稿（見開きPDF）かどうかを判定
 * 1ページ目の幅 > 高さ であれば横長原稿とみなす
 */
export function isLandscapeDocument(pages: PageState[]): boolean {
  if (pages.length === 0) return false;
  const firstPage = pages[0];
  return firstPage.width > firstPage.height;
}

/**
 * 横長原稿の場合の総ノンブル数を計算
 * - 1ページ目は単独（ノンブル1）
 * - 2ページ目以降は見開き（各ページが2ノンブルを持つ）
 * 例: 16ページ → 1 + (16-1) * 2 = 31ノンブル
 */
export function getTotalNombre(pages: PageState[]): number {
  const totalPages = pages.length;
  if (totalPages === 0) return 0;

  if (!isLandscapeDocument(pages)) {
    return totalPages;
  }

  // 横長原稿: 1 + (元ページ数 - 1) * 2
  return 1 + (totalPages - 1) * 2;
}

/**
 * PDFページ番号からノンブル（表示ページ番号）を計算
 * @param pdfPageNum PDFの物理ページ番号（1始まり）
 * @param isLandscape 横長原稿かどうか
 * @returns ノンブル（表示ページ番号）
 */
export function pdfPageToNombre(pdfPageNum: number, isLandscape: boolean): number {
  if (!isLandscape || pdfPageNum === 1) {
    return pdfPageNum;
  }
  // 2ページ目以降: ノンブル = (pdfPageNum - 1) * 2
  // PDFページ2 → ノンブル2 (見開きの最初)
  // PDFページ3 → ノンブル4
  return (pdfPageNum - 1) * 2;
}

/**
 * PDFページ番号からノンブル範囲を取得（横長原稿の場合は2つのノンブルを返す）
 * @param pdfPageNum PDFの物理ページ番号（1始まり）
 * @param isLandscape 横長原稿かどうか
 * @returns [開始ノンブル, 終了ノンブル] または単一ノンブルの場合は同じ値
 */
export function pdfPageToNombreRange(pdfPageNum: number, isLandscape: boolean): [number, number] {
  if (!isLandscape || pdfPageNum === 1) {
    return [pdfPageNum, pdfPageNum];
  }
  // 2ページ目以降: ノンブル範囲 = [(pdfPageNum - 1) * 2, (pdfPageNum - 1) * 2 + 1]
  // PDFページ2 → ノンブル2-3
  // PDFページ3 → ノンブル4-5
  const baseNombre = (pdfPageNum - 1) * 2;
  return [baseNombre, baseNombre + 1];
}

/**
 * ノンブル（表示ページ番号）からPDFページ番号を計算
 * @param nombre ノンブル（表示ページ番号）
 * @param isLandscape 横長原稿かどうか
 * @returns PDFの物理ページ番号（1始まり）
 */
export function nombreToPdfPage(nombre: number, isLandscape: boolean): number {
  if (!isLandscape || nombre === 1) {
    return nombre;
  }
  // ノンブル2,3 → PDFページ2
  // ノンブル4,5 → PDFページ3
  // ノンブルN (N>=2) → PDFページ Math.ceil((N-1)/2) + 1
  return Math.ceil((nombre - 1) / 2) + 1;
}

/**
 * ページ表示用の文字列を生成
 * @param pdfPageNum PDFの物理ページ番号（1始まり）
 * @param totalPages 総ページ数
 * @param isLandscape 横長原稿かどうか
 * @returns 表示用文字列（例: "2-3/31" または "5/20"）
 */
export function formatPageDisplay(pdfPageNum: number, totalPages: number, isLandscape: boolean): string {
  if (!isLandscape) {
    return `${pdfPageNum}/${totalPages}`;
  }

  const totalNombre = 1 + (totalPages - 1) * 2;

  if (pdfPageNum === 1) {
    return `1/${totalNombre}`;
  }

  const [startNombre, endNombre] = pdfPageToNombreRange(pdfPageNum, isLandscape);
  return `${startNombre}-${endNombre}/${totalNombre}`;
}
