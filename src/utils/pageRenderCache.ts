/**
 * ページレンダリングLRUキャッシュ
 * 旧MojiQ ver_2.08からの移植 + マルチタブ対応
 *
 * ImageBitmapを使用してGPU最適化されたキャッシュを提供
 */

import { getOptimalCacheSize } from './memoryUtils';

/** キャッシュエントリ */
export interface CacheEntry {
  /** レンダリング結果（ImageBitmap or HTMLImageElement） */
  bitmap: ImageBitmap | HTMLImageElement;
  /** 実際の幅 */
  width: number;
  /** 実際の高さ */
  height: number;
  /** 表示幅 */
  displayWidth: number;
  /** 表示高さ */
  displayHeight: number;
  /** ドキュメントID */
  documentId: string;
}

/**
 * LRUキャッシュ（ページレンダリング結果保持用）
 * マルチタブ対応: キャッシュキーにドキュメントIDを含める
 */
class PageRenderLRUCache {
  private _maxSize: number;
  private _map: Map<string, CacheEntry>;

  constructor(maxSize: number) {
    this._maxSize = maxSize;
    this._map = new Map();
  }

  /**
   * キャッシュキー生成
   * @param documentId - ドキュメントID
   * @param pageNum - ページ番号
   * @param containerWidth - コンテナ幅
   * @param containerHeight - コンテナ高さ
   * @param dprValue - デバイスピクセル比
   * @param rotation - ビュー回転角度（オプション、デフォルト0）
   */
  static makeKey(
    documentId: string,
    pageNum: number,
    containerWidth: number,
    containerHeight: number,
    dprValue: number,
    rotation: number = 0
  ): string {
    return `${documentId}:${pageNum}_${containerWidth}_${containerHeight}_${dprValue}_r${rotation}`;
  }

  /**
   * キャッシュ取得（アクセス時にLRU順序を更新）
   */
  get(key: string): CacheEntry | null {
    if (!this._map.has(key)) return null;
    const value = this._map.get(key)!;
    // LRU更新: 削除して再追加（Mapの末尾が最新）
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  /**
   * キャッシュ保存（容量超過時は最古エントリを削除）
   */
  set(key: string, value: CacheEntry): void {
    if (this._map.has(key)) {
      this._map.delete(key);
    }
    this._map.set(key, value);
    // 容量超過時にLRU（先頭）を削除
    while (this._map.size > this._maxSize) {
      const oldestKey = this._map.keys().next().value;
      if (oldestKey) {
        const oldest = this._map.get(oldestKey);
        // ImageBitmapの場合はGPUメモリを解放
        if (oldest && oldest.bitmap && 'close' in oldest.bitmap && typeof oldest.bitmap.close === 'function') {
          oldest.bitmap.close();
        }
        this._map.delete(oldestKey);
      }
    }
  }

  /**
   * 特定のキャッシュエントリを削除
   */
  delete(key: string): boolean {
    const entry = this._map.get(key);
    if (entry) {
      if (entry.bitmap && 'close' in entry.bitmap && typeof entry.bitmap.close === 'function') {
        entry.bitmap.close();
      }
      return this._map.delete(key);
    }
    return false;
  }

  /**
   * 全キャッシュクリア（メモリ解放付き）
   */
  clear(): void {
    for (const entry of this._map.values()) {
      if (entry && entry.bitmap && 'close' in entry.bitmap && typeof entry.bitmap.close === 'function') {
        entry.bitmap.close();
      }
    }
    this._map.clear();
  }

  /**
   * 特定ドキュメントのキャッシュをクリア（タブ閉じ時用）
   */
  clearForDocument(documentId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this._map.entries()) {
      if (entry.documentId === documentId) {
        keysToDelete.push(key);
        if (entry.bitmap && 'close' in entry.bitmap && typeof entry.bitmap.close === 'function') {
          entry.bitmap.close();
        }
      }
    }
    for (const key of keysToDelete) {
      this._map.delete(key);
    }
  }

  /**
   * 特定ページのキャッシュを無効化（描画変更時用）
   */
  invalidatePageCache(documentId: string, pageNum: number): void {
    const prefix = `${documentId}:${pageNum}_`;
    const keysToDelete: string[] = [];
    for (const [key, entry] of this._map.entries()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
        if (entry.bitmap && 'close' in entry.bitmap && typeof entry.bitmap.close === 'function') {
          entry.bitmap.close();
        }
      }
    }
    for (const key of keysToDelete) {
      this._map.delete(key);
    }
  }

  /**
   * キャッシュサイズ
   */
  get size(): number {
    return this._map.size;
  }

  /**
   * 最大サイズを更新
   */
  setMaxSize(newMaxSize: number): void {
    this._maxSize = newMaxSize;
    // 新しい最大サイズに合わせて古いエントリを削除
    while (this._map.size > this._maxSize) {
      const oldestKey = this._map.keys().next().value;
      if (oldestKey) {
        const oldest = this._map.get(oldestKey);
        if (oldest && oldest.bitmap && 'close' in oldest.bitmap && typeof oldest.bitmap.close === 'function') {
          oldest.bitmap.close();
        }
        this._map.delete(oldestKey);
      }
    }
  }

  /**
   * キャッシュにキーが存在するか確認
   */
  has(key: string): boolean {
    return this._map.has(key);
  }
}

// シングルトンインスタンス（動的サイズ）
const optimalSize = getOptimalCacheSize();
export const pageRenderCache = new PageRenderLRUCache(optimalSize);

console.log(`[MojiQ] PageRenderCache initialized with size: ${optimalSize}`);

/**
 * Base64画像からImageBitmapを作成
 * ImageBitmapが使用できない環境ではHTMLImageElementにフォールバック
 */
export async function createBitmapFromDataUrl(
  dataUrl: string
): Promise<ImageBitmap | HTMLImageElement> {
  // Blob経由でImageBitmapを作成（より効率的）
  if (typeof createImageBitmap === 'function') {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      return await createImageBitmap(blob);
    } catch (e) {
      console.warn('[MojiQ] ImageBitmap creation failed, falling back to Image:', e);
    }
  }

  // フォールバック: HTMLImageElement
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * CanvasからImageBitmapを作成
 */
export async function createBitmapFromCanvas(
  canvas: HTMLCanvasElement
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(canvas);
    } catch (e) {
      console.warn('[MojiQ] ImageBitmap from canvas failed, falling back to Image:', e);
    }
  }

  // フォールバック: CanvasをDataURLに変換してImageを作成
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL('image/png');
  });
}
