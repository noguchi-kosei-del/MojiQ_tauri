/**
 * システムメモリ検出ユーティリティ
 * 旧MojiQ ver_2.08からの移植
 */

import { CACHE_LIMITS } from '../constants/loadingLimits';

// TypeScript用の型拡張
declare global {
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
  interface Navigator {
    deviceMemory?: number;
  }
}

/**
 * システムメモリに基づいて最適なキャッシュサイズを計算
 * @returns キャッシュサイズ（ページ数）5-30の範囲
 */
export function getOptimalCacheSize(): number {
  let cacheSize: number = CACHE_LIMITS.DEFAULT_CACHE_SIZE;

  try {
    // performance.memory APIが利用可能な場合（Chromium系）
    if (performance.memory && performance.memory.jsHeapSizeLimit) {
      const heapLimit = performance.memory.jsHeapSizeLimit;
      // 1GB以上: 30ページ、512MB以上: 20ページ、それ以下: 10ページ
      if (heapLimit >= 1024 * 1024 * 1024) {
        cacheSize = 30;
      } else if (heapLimit >= 512 * 1024 * 1024) {
        cacheSize = 20;
      } else {
        cacheSize = 10;
      }
    }

    // navigator.deviceMemory APIが利用可能な場合
    if (navigator.deviceMemory) {
      // デバイスメモリ8GB以上: 30ページ、4GB以上: 20ページ、それ以下: 10ページ
      if (navigator.deviceMemory >= 8) {
        cacheSize = Math.max(cacheSize, 30);
      } else if (navigator.deviceMemory >= 4) {
        cacheSize = Math.max(cacheSize, 20);
      } else {
        cacheSize = Math.min(cacheSize, 10);
      }
    }
  } catch (e) {
    console.warn('[MojiQ] メモリ情報取得に失敗、デフォルトキャッシュサイズを使用:', e);
  }

  // 最小5ページ、最大30ページ
  return Math.max(
    CACHE_LIMITS.MIN_CACHE_SIZE,
    Math.min(cacheSize, CACHE_LIMITS.MAX_CACHE_SIZE)
  );
}

