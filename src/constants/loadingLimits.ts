/**
 * ファイル読み込みに関する閾値・制限定義
 * 旧MojiQ ver_2.08からの移植
 */

/** ファイルサイズ閾値 */
export const THRESHOLDS = {
  /** PDF Canvas圧縮しきい値 (300MB) */
  PDF_SIZE_LIMIT: 300 * 1024 * 1024,
  /** 画像圧縮しきい値 (300MB) */
  IMAGE_SIZE_LIMIT: 300 * 1024 * 1024,
  /** JPEG圧縮品質 (0.0-1.0) */
  IMAGE_COMPRESS_QUALITY: 0.75,
} as const;

/** PDF制限 */
export const PDF_LIMITS = {
  /** 最大ページ数（メモリ安全のため200に制限） */
  MAX_PAGES: 200,
  /** 警告を出すページ数 */
  WARNING_PAGES: 100,
  /** 単ページサイズ上限 (100MB) */
  SINGLE_PAGE_SIZE_LIMIT: 100 * 1024 * 1024,
} as const;

/** オブジェクト制限（1ページあたり） */
export const OBJECT_LIMITS = {
  /** 1ページあたりの最大オブジェクト数 */
  MAX_PER_PAGE: 5000,
  /** 警告を出すオブジェクト数 */
  WARNING_PER_PAGE: 3000,
} as const;

/** ストローク制限 */
export const STROKE_LIMITS = {
  /** 1ストロークあたりの最大ポイント数 */
  MAX_POINTS: 50000,
} as const;

/** テキスト制限 */
export const TEXT_LIMITS = {
  /** 最大文字数 */
  MAX_LENGTH: 50000,
} as const;

/** キャッシュ設定 */
export const CACHE_LIMITS = {
  /** 最小キャッシュサイズ（ページ数） */
  MIN_CACHE_SIZE: 5,
  /** 最大キャッシュサイズ（ページ数） */
  MAX_CACHE_SIZE: 30,
  /** デフォルトキャッシュサイズ（ページ数） */
  DEFAULT_CACHE_SIZE: 15,
} as const;
