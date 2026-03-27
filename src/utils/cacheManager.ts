/**
 * 統合キャッシュマネージャー
 * 3つのキャッシュ（pageRenderCache, backgroundImageCache, imageCache）を統一インターフェースで管理
 */

import { pageRenderCache } from './pageRenderCache';
import { backgroundImageCache } from './backgroundImageCache';
import { imageCache } from './imageCache';

export type CacheType = 'pageRender' | 'backgroundImage' | 'linkedImage';

export interface CacheStats {
  pageRender: {
    entries: number;
    maxSize: number;
  };
  backgroundImage: {
    entries: number;
  };
  linkedImage: {
    entries: number;
    sizeBytes: number;
    maxBytes: number;
  };
  total: {
    entries: number;
  };
}

/**
 * 統合キャッシュマネージャー
 * すべてのキャッシュを一元管理し、統一されたAPIを提供
 */
class CacheManager {
  /**
   * 全キャッシュをクリア
   * アプリ終了時やメモリ不足時に使用
   */
  clearAll(): void {
    console.log('[CacheManager] Clearing all caches');
    pageRenderCache.clear();
    backgroundImageCache.clear();
    imageCache.clearAll();
  }

  /**
   * 特定ドキュメントのキャッシュをクリア
   * タブを閉じる際に使用
   * @param documentId - ドキュメントID
   * @param linkedImagePaths - リンク画像のファイルパス配列（オプション）
   */
  clearForDocument(documentId: string, linkedImagePaths?: string[]): void {
    console.log(`[CacheManager] Clearing caches for document: ${documentId}`);

    // ページレンダーキャッシュをクリア
    pageRenderCache.clearForDocument(documentId);

    // 背景画像キャッシュをクリア
    backgroundImageCache.clear();

    // リンク画像キャッシュをクリア（パスが指定されている場合）
    if (linkedImagePaths && linkedImagePaths.length > 0) {
      imageCache.clearForDocument(linkedImagePaths);
    }
  }

  /**
   * 特定のキャッシュタイプをクリア
   * @param type - キャッシュタイプ
   */
  clearByType(type: CacheType): void {
    console.log(`[CacheManager] Clearing cache type: ${type}`);
    switch (type) {
      case 'pageRender':
        pageRenderCache.clear();
        break;
      case 'backgroundImage':
        backgroundImageCache.clear();
        break;
      case 'linkedImage':
        imageCache.clearAll();
        break;
    }
  }

  /**
   * 特定ページのキャッシュを無効化
   * 描画変更時に使用
   * @param documentId - ドキュメントID
   * @param pageNumber - ページ番号
   */
  invalidatePage(documentId: string, pageNumber: number): void {
    // ページレンダーキャッシュを無効化
    pageRenderCache.invalidatePageCache(documentId, pageNumber);

    // 背景画像キャッシュも無効化（ページ番号で管理されている場合）
    // Note: backgroundImageCacheは全ページを保持するため、個別ページの無効化は不要
  }

  /**
   * キャッシュ統計を取得
   */
  getStats(): CacheStats {
    const linkedStats = imageCache.getStats();
    const pageRenderSize = pageRenderCache.size;
    const backgroundSize = backgroundImageCache.size;

    return {
      pageRender: {
        entries: pageRenderSize,
        maxSize: pageRenderSize, // 現在のサイズを返す（maxSizeのgetterがないため）
      },
      backgroundImage: {
        entries: backgroundSize,
      },
      linkedImage: {
        entries: linkedStats.entries,
        sizeBytes: linkedStats.sizeBytes,
        maxBytes: linkedStats.maxBytes,
      },
      total: {
        entries: pageRenderSize + backgroundSize + linkedStats.entries,
      },
    };
  }

  /**
   * デバッグ用: キャッシュ状態をログ出力
   */
  logStats(): void {
    const stats = this.getStats();
    console.log('[CacheManager] Cache Statistics:', {
      pageRender: `${stats.pageRender.entries} entries`,
      backgroundImage: `${stats.backgroundImage.entries} entries`,
      linkedImage: `${stats.linkedImage.entries} entries (${(stats.linkedImage.sizeBytes / 1024 / 1024).toFixed(2)}MB / ${(stats.linkedImage.maxBytes / 1024 / 1024).toFixed(2)}MB)`,
      total: `${stats.total.entries} total entries`,
    });
  }

  /**
   * メモリ圧迫時にキャッシュを削減
   * @param aggressive - true の場合、すべてのキャッシュをクリア
   */
  reduceMemory(aggressive: boolean = false): void {
    console.log(`[CacheManager] Reducing memory (aggressive: ${aggressive})`);

    if (aggressive) {
      // 全クリア
      this.clearAll();
    } else {
      // 控えめな削減: 背景画像キャッシュのみクリア
      // （ページレンダーとリンク画像は再取得コストが高い）
      backgroundImageCache.clear();
    }
  }

  /**
   * 個別キャッシュへの直接アクセス（後方互換性のため）
   */
  get pageRender() {
    return pageRenderCache;
  }

  get backgroundImage() {
    return backgroundImageCache;
  }

  get linkedImage() {
    return imageCache;
  }
}

// シングルトンインスタンス
export const cacheManager = new CacheManager();

// 後方互換性のため、個別キャッシュもエクスポート
export { pageRenderCache } from './pageRenderCache';
export { backgroundImageCache } from './backgroundImageCache';
export { imageCache } from './imageCache';
