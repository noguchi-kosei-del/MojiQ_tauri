/**
 * ファイルバリデーションユーティリティ
 * ファイルサイズ・ページ数のチェックと警告メッセージ生成
 */

import { THRESHOLDS, PDF_LIMITS } from '../constants/loadingLimits';

/** バリデーション結果 */
export interface ValidationResult {
  /** 有効かどうか（falseの場合は読み込み不可） */
  valid: boolean;
  /** 警告メッセージ（確認ダイアログ用） */
  warning?: string;
  /** エラーメッセージ（ブロック時） */
  error?: string;
  /** 圧縮が必要かどうか */
  needsCompression?: boolean;
}

/**
 * ファイルサイズをチェック
 * @param size - ファイルサイズ（バイト）
 * @param type - ファイルタイプ ('pdf' | 'image')
 */
export function checkFileSize(
  size: number,
  type: 'pdf' | 'image'
): ValidationResult {
  const threshold = type === 'pdf' ? THRESHOLDS.PDF_SIZE_LIMIT : THRESHOLDS.IMAGE_SIZE_LIMIT;

  if (size >= threshold) {
    const sizeMB = Math.round(size / (1024 * 1024));
    return {
      valid: false,
      error: `ファイルサイズが大きすぎるので読み込めません（${sizeMB}MB / 上限300MB）`,
    };
  }

  return { valid: true };
}

/**
 * ページ数をチェック
 * @param count - ページ数
 */
export function checkPageCount(count: number): ValidationResult {
  if (count > PDF_LIMITS.MAX_PAGES) {
    return {
      valid: false,
      error: `このPDFは${count}ページあります。\n処理可能な最大ページ数（${PDF_LIMITS.MAX_PAGES}）を超えているため開けません。`,
    };
  }

  if (count > PDF_LIMITS.WARNING_PAGES) {
    return {
      valid: true,
      warning: `このPDFは${count}ページあります。\n処理に時間がかかる可能性があります。続行しますか？`,
    };
  }

  return { valid: true };
}

/**
 * 複数画像の合計サイズをチェック
 * @param files - ファイル配列
 */
export function checkTotalImageSize(files: File[]): ValidationResult {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return checkFileSize(totalSize, 'image');
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
