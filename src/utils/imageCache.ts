import { invoke } from '@tauri-apps/api/core';
import type { ImageLink } from '../types';

interface CacheEntry {
  imageData: string;      // Base64 Data URL
  lastAccessed: number;   // タイムスタンプ
  sizeBytes: number;      // 概算サイズ
}

interface PreloadTask {
  filePath: string;
  promise: Promise<string | null>;
}

class ImageCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxCacheBytes: number = 200 * 1024 * 1024; // 200MB
  private currentSize: number = 0;
  private preloadBuffer: number = 5; // 前後5ページをプリロード
  private preloadingTasks: Map<string, PreloadTask> = new Map();

  // 画像取得（キャッシュミス時はTauri経由で読み込み）
  async getImage(imageLink: ImageLink): Promise<string> {
    if (!imageLink.filePath) {
      throw new Error('ImageLink has no file path');
    }

    const filePath = imageLink.filePath;

    // キャッシュにある場合
    const cached = this.cache.get(filePath);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.imageData;
    }

    // プリロード中の場合は待機
    const preloading = this.preloadingTasks.get(filePath);
    if (preloading) {
      const result = await preloading.promise;
      if (result) return result;
    }

    // Tauriから読み込み
    return await this.loadImage(filePath);
  }

  // 画像を読み込んでキャッシュに追加
  private async loadImage(filePath: string): Promise<string> {
    try {
      const imageData = await invoke<string>('load_page_image', { path: filePath });

      // キャッシュに追加
      const sizeBytes = this.estimateSize(imageData);

      // キャッシュサイズを確保
      while (this.currentSize + sizeBytes > this.maxCacheBytes && this.cache.size > 0) {
        this.evictOldest();
      }

      this.cache.set(filePath, {
        imageData,
        lastAccessed: Date.now(),
        sizeBytes,
      });
      this.currentSize += sizeBytes;

      return imageData;
    } catch (error) {
      throw new Error(`Failed to load image: ${filePath} - ${error}`);
    }
  }

  // Base64文字列のサイズを概算
  private estimateSize(base64Data: string): number {
    // Base64はデータの約1.33倍 + ヘッダー
    return Math.ceil(base64Data.length * 0.75);
  }

  // 最も古いエントリを削除（LRU）
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentSize -= entry.sizeBytes;
      }
      this.cache.delete(oldestKey);
    }
  }

  // 近傍ページのプリロード（前後5ページ）
  preloadPages(currentPage: number, totalPages: number, imageLinks: (ImageLink | undefined)[]): void {
    const startPage = Math.max(0, currentPage - this.preloadBuffer);
    const endPage = Math.min(totalPages - 1, currentPage + this.preloadBuffer);

    for (let i = startPage; i <= endPage; i++) {
      const link = imageLinks[i];
      if (link?.type === 'file' && link.filePath) {
        this.preloadImage(link.filePath);
      }
    }
  }

  // 単一画像のプリロード（バックグラウンド）
  private preloadImage(filePath: string): void {
    // 既にキャッシュにある場合はスキップ
    if (this.cache.has(filePath)) return;

    // 既にプリロード中の場合はスキップ
    if (this.preloadingTasks.has(filePath)) return;

    const promise = this.loadImage(filePath)
      .then((imageData) => {
        this.preloadingTasks.delete(filePath);
        return imageData;
      })
      .catch((error) => {
        console.warn(`Preload failed for ${filePath}:`, error);
        this.preloadingTasks.delete(filePath);
        return null;
      });

    this.preloadingTasks.set(filePath, { filePath, promise });
  }

  // キャッシュにあるかチェック
  hasImage(filePath: string): boolean {
    return this.cache.has(filePath);
  }

  // 特定ドキュメントのキャッシュをクリア
  clearForDocument(filePaths: string[]): void {
    for (const filePath of filePaths) {
      const entry = this.cache.get(filePath);
      if (entry) {
        this.currentSize -= entry.sizeBytes;
        this.cache.delete(filePath);
      }
    }
  }

  // 全キャッシュをクリア
  clearAll(): void {
    this.cache.clear();
    this.preloadingTasks.clear();
    this.currentSize = 0;
  }

  // デバッグ: キャッシュ状態を取得
  getStats(): { entries: number; sizeBytes: number; maxBytes: number } {
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      maxBytes: this.maxCacheBytes,
    };
  }

  // プリロードバッファサイズを設定
  setPreloadBuffer(buffer: number): void {
    this.preloadBuffer = buffer;
  }

  // 最大キャッシュサイズを設定
  setMaxCacheSize(bytes: number): void {
    this.maxCacheBytes = bytes;
    // 新しいサイズに収まるように削除
    while (this.currentSize > this.maxCacheBytes && this.cache.size > 0) {
      this.evictOldest();
    }
  }
}

// シングルトンインスタンス
export const imageCache = new ImageCacheManager();
