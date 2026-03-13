/**
 * 背景画像キャッシュ
 * ImageBitmapを使用してGPU最適化されたキャッシュを提供
 *
 * 旧MojiQ ver_2.08のimageBitmapCacheを参考に、
 * ページ切り替え時の描画を高速化する
 */

/** キャッシュエントリ（ImageBitmap or HTMLImageElement） */
type CachedImage = ImageBitmap | HTMLImageElement;

class BackgroundImageCacheManager {
  private cache: Map<number, CachedImage> = new Map();
  private currentDocumentId: string = '';

  /**
   * キャッシュから画像を取得
   */
  get(pageNumber: number): CachedImage | undefined {
    return this.cache.get(pageNumber);
  }

  /**
   * 画像をキャッシュに保存
   */
  set(pageNumber: number, image: CachedImage): void {
    this.cache.set(pageNumber, image);
  }

  /**
   * 指定ページがキャッシュにあるか確認
   */
  has(pageNumber: number): boolean {
    const img = this.cache.get(pageNumber);
    if (!img) return false;

    // HTMLImageElementの場合はcompleteチェック
    if (img instanceof HTMLImageElement) {
      return img.complete;
    }
    // ImageBitmapの場合は常にtrue
    return true;
  }

  /**
   * キャッシュをクリア（メモリ解放付き）
   */
  clear(): void {
    for (const img of this.cache.values()) {
      // ImageBitmapの場合はGPUメモリを解放
      if ('close' in img && typeof img.close === 'function') {
        img.close();
      }
    }
    this.cache.clear();
  }

  /**
   * ドキュメントIDを設定（タブ切り替え時のキャッシュ管理用）
   */
  setDocumentId(docId: string): void {
    if (this.currentDocumentId !== docId) {
      // 異なるドキュメントの場合はキャッシュをクリア
      this.clear();
      this.currentDocumentId = docId;
    }
  }

  /**
   * 現在のドキュメントIDを取得
   */
  getDocumentId(): string {
    return this.currentDocumentId;
  }

  /**
   * 画像をプリロードしてキャッシュに保存
   * ImageBitmapが使用可能な場合はそれを使用（GPU最適化）
   */
  async preloadImage(pageNumber: number, imageSource: string): Promise<void> {
    try {
      // ImageBitmapが使用可能な場合
      if (typeof createImageBitmap === 'function') {
        const response = await fetch(imageSource);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        this.cache.set(pageNumber, bitmap);
        return;
      }
    } catch (e) {
      console.warn(`[MojiQ] ImageBitmap creation failed for page ${pageNumber}, falling back to Image:`, e);
    }

    // フォールバック: HTMLImageElement
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(pageNumber, img);
        resolve();
      };
      img.onerror = () => {
        console.error(`Failed to decode image for page ${pageNumber}`);
        resolve();
      };
      img.src = imageSource;
    });
  }

  /**
   * キャッシュサイズを取得
   */
  get size(): number {
    return this.cache.size;
  }
}

// シングルトンインスタンス
export const backgroundImageCache = new BackgroundImageCacheManager();

/**
 * ページ配列から全ての背景画像をプリロード
 * App.tsxから呼び出してローディングを一元管理
 */
export async function preloadAllBackgroundImages(
  getPageImage: (pageNumber: number) => string | null,
  totalPages: number,
  onProgress?: (current: number, total: number) => void,
  documentId?: string
): Promise<void> {
  // ドキュメントIDが指定されている場合は設定
  if (documentId) {
    backgroundImageCache.setDocumentId(documentId);
  } else {
    // 未指定の場合はキャッシュをクリア
    backgroundImageCache.clear();
  }

  for (let i = 0; i < totalPages; i++) {
    const imageSource = getPageImage(i);
    if (imageSource) {
      await backgroundImageCache.preloadImage(i, imageSource);
    }
    onProgress?.(i + 1, totalPages);
  }
}

/**
 * 隣接ページをプリフェッチ
 * 現在のページの前後N ページを先読み
 */
export async function prefetchAdjacentPages(
  currentPage: number,
  totalPages: number,
  getPageImage: (pageNumber: number) => string | null,
  range: number = 2
): Promise<void> {
  const pagesToLoad: number[] = [];

  // 前後のページを収集
  for (let i = currentPage - range; i <= currentPage + range; i++) {
    if (i >= 0 && i < totalPages && i !== currentPage && !backgroundImageCache.has(i)) {
      pagesToLoad.push(i);
    }
  }

  // 並列でプリロード
  await Promise.all(
    pagesToLoad.map(async (pageNum) => {
      const imageSource = getPageImage(pageNum);
      if (imageSource) {
        await backgroundImageCache.preloadImage(pageNum, imageSource);
      }
    })
  );
}
