/**
 * PDF Worker マネージャー
 * Web Workerを使用してPDF処理をメインスレッドから分離
 */

// Worker応答の型定義
interface WorkerResponse {
  type: 'result' | 'error';
  id: string;
  data?: Uint8Array | string;
  error?: string;
}

// 保留中のリクエストを管理
const pendingRequests = new Map<string, {
  resolve: (data: Uint8Array | string) => void;
  reject: (error: Error) => void;
}>();

// Worker インスタンス（遅延初期化）
let worker: Worker | null = null;
let requestId = 0;

// Worker の初期化
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/pdfWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, id, data, error } = event.data;
      const pending = pendingRequests.get(id);

      if (pending) {
        pendingRequests.delete(id);
        if (type === 'result' && data !== undefined) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error || 'Unknown worker error'));
        }
      }
    };

    worker.onerror = (event) => {
      console.error('PDF Worker error:', event);
      // すべての保留中のリクエストを拒否
      pendingRequests.forEach((pending) => {
        pending.reject(new Error('Worker error'));
      });
      pendingRequests.clear();
    };
  }

  return worker;
}

// 一意のリクエストIDを生成
function generateId(): string {
  return `req-${++requestId}-${Date.now()}`;
}

/**
 * Base64をUint8Arrayに変換（Web Worker使用）
 * @param base64 - Base64文字列
 * @returns Uint8Array
 */
export async function base64ToUint8ArrayAsync(base64: string): Promise<Uint8Array> {
  // 小さいデータはメインスレッドで処理（オーバーヘッド回避）
  if (base64.length < 100000) { // 約75KB未満
    return base64ToUint8ArraySync(base64);
  }

  const w = getWorker();
  const id = generateId();

  return new Promise<Uint8Array>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: (data) => resolve(data as Uint8Array),
      reject,
    });

    w.postMessage({
      type: 'base64ToUint8Array',
      id,
      data: base64,
    });
  });
}

/**
 * Uint8ArrayをBase64に変換（Web Worker使用）
 * @param uint8Array - Uint8Array
 * @returns Base64文字列
 */
export async function uint8ArrayToBase64Async(uint8Array: Uint8Array): Promise<string> {
  // 小さいデータはメインスレッドで処理
  if (uint8Array.length < 100000) {
    return uint8ArrayToBase64Sync(uint8Array);
  }

  const w = getWorker();
  const id = generateId();

  return new Promise<string>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: (data) => resolve(data as string),
      reject,
    });

    // Transferableとして送信
    w.postMessage(
      {
        type: 'uint8ArrayToBase64',
        id,
        data: uint8Array,
      },
      { transfer: [uint8Array.buffer] }
    );
  });
}

/**
 * 同期版 Base64 → Uint8Array（小さいデータ用）
 */
function base64ToUint8ArraySync(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * 同期版 Uint8Array → Base64（小さいデータ用）
 */
function uint8ArrayToBase64Sync(uint8Array: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
  }
  return btoa(chunks.join(''));
}

/**
 * Worker を終了
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    pendingRequests.clear();
  }
}
