import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PageState, HistoryState, PdfPageInfo, PdfAnnotationText, ProofreadingCheckData, ProofreadingCheckItem } from './index';
import type { ProofreadingTabType, CheckedState } from '../stores/proofreadingCheckStore';

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

  // --- 校正チェックデータ（タブ別保持） ---
  /** 校正チェックの読み込みデータ */
  proofreadingData: ProofreadingCheckData | null;
  /** 校正チェックファイル名 */
  proofreadingFileName: string;
  /** マージ済みアイテム一覧 */
  proofreadingAllItems: ProofreadingCheckItem[];
  /** 現在の校正タブ（正誤/提案/コメント） */
  proofreadingTab: ProofreadingTabType;
  /** チェック済み状態 */
  proofreadingCheckedState: CheckedState | null;
  /** コメント済スタンプ情報 */
  proofreadingCommentDoneStamps: [number, { pageIndex: number; stampId: string }][];
  /** 折りたたみカテゴリ */
  proofreadingCollapsedCategories: string[];
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
