/**
 * ファイルロック — 保存中の競合防止
 * 旧MojiQ ver_2.11 の pdf-manager.js より移植
 *
 * 複数の保存リクエストが同時に走るのを防ぐロック機構。
 * - acquireSaveLock() でロックを取得（取得できなければ false）
 * - releaseSaveLock() でロックを解放
 * - タイムアウト付き: 一定時間経過でロックを自動解放（デッドロック防止）
 */

/** ベースタイムアウト（60秒） */
const BASE_LOCK_TIMEOUT_MS = 60_000;
/** 最大タイムアウト（10分） */
const MAX_LOCK_TIMEOUT_MS = 600_000;

interface SaveOperation {
  isLocked: boolean;
  lockTime: number | null;
}

const saveOperation: SaveOperation = {
  isLocked: false,
  lockTime: null,
};

/**
 * ページ数・オブジェクト数に応じた動的タイムアウトを計算
 * 計算式: ベース60秒 + (ページ数 × 3秒) + (オブジェクト数 × 500ms)
 */
function calculateSaveTimeout(pageCount: number, totalObjects: number): number {
  const calculated = BASE_LOCK_TIMEOUT_MS + (pageCount * 3000) + (totalObjects * 500);
  return Math.min(Math.max(calculated, BASE_LOCK_TIMEOUT_MS), MAX_LOCK_TIMEOUT_MS);
}

/**
 * 保存ロックを取得する
 * @param pageCount 保存対象のページ数（タイムアウト計算用）
 * @param totalObjects 描画オブジェクト総数（タイムアウト計算用）
 * @returns true=取得成功 / false=既にロック中
 */
export function acquireSaveLock(pageCount = 1, totalObjects = 0): boolean {
  const now = Date.now();
  const timeout = calculateSaveTimeout(pageCount, totalObjects);

  // タイムアウトしたロックは自動解放
  if (saveOperation.isLocked && saveOperation.lockTime !== null) {
    if (now - saveOperation.lockTime > timeout) {
      console.warn('[MojiQ] 保存ロックがタイムアウトしました。自動解放します。');
      saveOperation.isLocked = false;
      saveOperation.lockTime = null;
    }
  }

  if (saveOperation.isLocked) {
    return false;
  }

  saveOperation.isLocked = true;
  saveOperation.lockTime = now;
  return true;
}

/**
 * 保存ロックを解放する
 */
export function releaseSaveLock(): void {
  saveOperation.isLocked = false;
  saveOperation.lockTime = null;
}

/**
 * 現在保存中かどうかを返す
 */
export function isSaving(): boolean {
  return saveOperation.isLocked;
}
