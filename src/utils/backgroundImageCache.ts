/**
 * 背景画像のHTMLImageElementキャッシュ
 * 画像のBase64データをデコード済みのImageオブジェクトとして保持し、
 * ページ切り替え時の描画を高速化する
 */

class BackgroundImageCacheManager {
  private cache: Map<number, HTMLImageElement> = new Map();

  /**
   * キャッシュから画像を取得
   */
  get(pageNumber: number): HTMLImageElement | undefined {
    return this.cache.get(pageNumber);
  }

  /**
   * 画像をキャッシュに保存
   */
  set(pageNumber: number, image: HTMLImageElement): void {
    this.cache.set(pageNumber, image);
  }

  /**
   * 指定ページがキャッシュにあるか確認
   */
  has(pageNumber: number): boolean {
    const img = this.cache.get(pageNumber);
    return img !== undefined && img.complete;
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 画像をプリロードしてキャッシュに保存
   */
  async preloadImage(pageNumber: number, imageSource: string): Promise<void> {
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
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  // キャッシュをクリア
  backgroundImageCache.clear();

  for (let i = 0; i < totalPages; i++) {
    const imageSource = getPageImage(i);
    if (imageSource) {
      await backgroundImageCache.preloadImage(i, imageSource);
    }
    onProgress?.(i + 1, totalPages);
  }
}
