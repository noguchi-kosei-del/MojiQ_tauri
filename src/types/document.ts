import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PageState, HistoryState, PdfPageInfo, PdfAnnotationText } from './index';

/**
 * ドキュメントのファイルタイプ
 */
export type DocumentFileType = 'pdf' | 'images' | 'new';

/**
 * 個々のドキュメントの状態
 */
export interface DocumentState {
  /** ユニークなドキュメント識別子 */
  id: string;
  /** 表示名（ファイル名または「新規ドキュメント」） */
  title: string;
  /** 元のファイルパス（新規の場合はnull） */
  filePath: string | null;
  /** ファイルタイプ */
  fileType: DocumentFileType;
  /** 未保存の変更があるか */
  isModified: boolean;
  /** 最終アクセス日時（LRUキャッシュ用） */
  lastAccessedAt: number;

  // --- drawingStoreから移行する状態 ---
  /** ページの配列 */
  pages: PageState[];
  /** 現在のページインデックス */
  currentPage: number;
  /** 現在選択中のレイヤーID */
  currentLayerId: string;
  /** Undo/Redo履歴 */
  history: HistoryState[];
  /** 履歴の現在位置 */
  historyIndex: number;

  // --- PDF固有データ ---
  /** PDF.jsのドキュメントプロキシ */
  pdfDocument: PDFDocumentProxy | null;
  /** PDFページ情報 */
  pdfPageInfos: PdfPageInfo[];
  /** PDF注釈 */
  pdfAnnotations: PdfAnnotationText[][];

  // --- UI状態の保存 ---
  /** ズームレベル */
  zoom: number;
}

/**
 * タブバーに表示する最小限の情報
 */
export interface TabInfo {
  id: string;
  title: string;
  isModified: boolean;
  order: number;
}

/**
 * ドキュメント作成用のオプション
 */
export interface CreateDocumentOptions {
  title?: string;
  filePath?: string | null;
  fileType?: DocumentFileType;
}
