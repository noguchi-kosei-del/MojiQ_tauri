import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export type ShapeType = 'rect' | 'ellipse' | 'line' | 'rectAnnotated' | 'ellipseAnnotated' | 'lineAnnotated' | 'arrow' | 'doubleArrow' | 'polyline' | 'stamp' | 'labeledRect';

// スタンプの種類
export type StampType =
  | 'doneStamp'       // 済スタンプ（円形）
  | 'rubyStamp'       // ルビスタンプ（角丸長方形）
  | 'toruStamp'       // トルスタンプ
  | 'torutsumeStamp'  // トルツメスタンプ
  | 'torumamaStamp'   // トルママスタンプ
  | 'zenkakuakiStamp' // 全角アキスタンプ
  | 'hankakuakiStamp' // 半角アキスタンプ
  | 'kaigyouStamp'    // 改行スタンプ
  | 'komojiStamp'     // 小文字スタンプ（○に小）
  | 'tojiruStamp'     // とじるスタンプ
  | 'hirakuStamp';    // ひらくスタンプ

// PDF注釈のソースタイプ
export type PdfAnnotationSourceType = 'Text' | 'FreeText' | 'Highlight' | 'Underline' | 'StrikeOut';

// テキスト要素
export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  isVertical: boolean;
  layerId: string;
  // PDF注釈由来の場合、注釈タイプを保持
  pdfAnnotationSource?: PdfAnnotationSourceType;
}

// アノテーション（引出線 + テキスト指示）
export interface Annotation {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  isVertical: boolean;
  align: 'left' | 'right';
  leaderLine: {
    start: Point;  // 図形側の接続点
    end: Point;    // テキスト側の接続点
  };
}

export interface Shape {
  id: string;
  type: ShapeType;
  startPos: Point;
  endPos: Point;
  color: string;
  width: number;
  layerId: string;
  annotation?: Annotation;  // +テキスト指示機能用
  points?: Point[];  // 折れ線用の頂点配列
  stampType?: StampType;  // スタンプの種類
  size?: number;  // スタンプのサイズ
  // フォントラベル用（フォント指定枠線）
  fontLabel?: {
    fontName: string;
    textX: number;
    textY: number;
    textAlign: 'left' | 'right';
  };
  // ラベル付き枠線用（小文字指定など）
  label?: string;
  // ラベル付き枠線の引出線
  leaderLine?: {
    start: Point;
    end: Point;
  };
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  layerId: string;
  isMarker?: boolean;
  opacity?: number;
}

// 画像要素
export interface ImageElement {
  id: string;
  startPos: Point;
  endPos: Point;
  imageData: string;  // Base64 Data URL
  layerId: string;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  strokes: Stroke[];
  shapes: Shape[];
  texts: TextElement[];
  images: ImageElement[];
}

export interface PageData {
  page_number: number;
  image_data: string;
  width: number;
  height: number;
}

// PDF注釈から読み込んだテキスト情報
export interface PdfAnnotationText {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  isVertical: boolean;
  // PDF注釈の種類（表示/非表示フィルタリング用）
  pdfAnnotationSource: PdfAnnotationSourceType;
}

export interface LoadedDocument {
  file_type: string;
  file_name: string;
  file_path: string;
  pages: PageData[];
  pdf_data?: string;
}

// PDFページ情報（オンデマンドレンダリング用）
export interface PdfPageInfo {
  pageNumber: number;
  width: number;
  height: number;
  rendered: boolean;
  imageData?: string;
}

// リンク方式の画像参照（InDesignライク）
export interface ImageLink {
  type: 'file' | 'embedded';  // 'file'=パス参照, 'embedded'=従来のBase64
  filePath?: string;          // 画像ファイルの絶対パス
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  modifiedAt?: number;        // ファイル更新検知用
}

// ファイルメタデータ（Tauriから返却）
export interface FileMetadata {
  file_path: string;
  mime_type: string;
  width: number;
  height: number;
  modified_at: number;
}

export interface PageState {
  pageNumber: number;
  layers: Layer[];
  // リンク参照（推奨、新規読み込み時に使用）
  imageLink?: ImageLink;
  // 従来のBase64データ（後方互換性、キャッシュ用）
  backgroundImage: string;
  width: number;
  height: number;
}

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingState {
  pages: PageState[];
  currentPage: number;
  currentLayerId: string;
  tool: 'pen' | 'eraser' | 'select' | 'rect' | 'ellipse' | 'line' | 'rectAnnotated' | 'ellipseAnnotated' | 'lineAnnotated' | 'marker' | 'pan' | 'text' | 'arrow' | 'doubleArrow' | 'polyline' | 'image' | 'stamp' | 'labeledRect';
  color: string;
  strokeWidth: number;
  history: HistoryState[];
  historyIndex: number;
  selectedStrokeIds: string[];
  selectedShapeIds: string[];
  selectedTextIds: string[];
  selectedImageIds: string[];
  selectedAnnotationShapeId: string | null;
  selectionBounds: SelectionBounds | null;
  // PDF関連
  pdfDocument: PDFDocumentProxy | null;
  pdfPageInfos: PdfPageInfo[];
  pdfAnnotations: PdfAnnotationText[][];
  // スタンプ関連
  currentStampType: StampType | null;
}

export interface HistoryState {
  pages: PageState[];
  currentPage: number;
}

export type ToolType = 'pen' | 'eraser' | 'select' | 'rect' | 'ellipse' | 'line' | 'rectAnnotated' | 'ellipseAnnotated' | 'lineAnnotated' | 'marker' | 'pan' | 'text' | 'arrow' | 'doubleArrow' | 'polyline' | 'image' | 'stamp' | 'labeledRect';

// ===== 校正チェック機能 =====

// 校正チェック項目
export interface ProofreadingCheckItem {
  picked?: boolean;
  category?: string;
  page?: string;
  excerpt?: string;
  content?: string;
  checkKind?: 'correctness' | 'proposal';
}

// 校正チェックカテゴリ
export interface ProofreadingCheckCategory {
  items: ProofreadingCheckItem[];
}

// 校正チェック全体
export interface ProofreadingChecks {
  variation?: ProofreadingCheckCategory;
  simple?: ProofreadingCheckCategory;
}

// 校正チェックデータ
export interface ProofreadingCheckData {
  title?: string;
  work?: string;
  checks?: ProofreadingChecks;
}

// フォルダエントリ（Tauriから返却）
export interface FolderEntry {
  name: string;
  path: string;
  is_dir: boolean;
}
