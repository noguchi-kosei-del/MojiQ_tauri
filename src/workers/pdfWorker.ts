/**
 * PDF処理用Web Worker
 * メインスレッドのブロックを防ぎ、UIの応答性を維持
 */

// Worker内でのメッセージ型定義
interface WorkerMessage {
  type: 'base64ToUint8Array' | 'uint8ArrayToBase64';
  id: string;
  data: string | Uint8Array;
}

interface WorkerResponse {
  type: 'result' | 'error';
  id: string;
  data?: Uint8Array | string;
  error?: string;
}

// Base64をUint8Arrayに変換（メインスレッドのatobより効率的）
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Uint8ArrayをBase64に変換
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  const chunkSize = 0x8000; // 32KB chunks
  const chunks: string[] = [];
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
  }
  return btoa(chunks.join(''));
}

// メッセージハンドラー
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, id, data } = event.data;

  try {
    let result: Uint8Array | string;

    switch (type) {
      case 'base64ToUint8Array':
        result = base64ToUint8Array(data as string);
        // Transferable objectとして送信（コピーではなく移動）
        self.postMessage(
          { type: 'result', id, data: result } as WorkerResponse,
          { transfer: [result.buffer] }
        );
        return;

      case 'uint8ArrayToBase64':
        result = uint8ArrayToBase64(data as Uint8Array);
        self.postMessage({ type: 'result', id, data: result } as WorkerResponse);
        return;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage({ type: 'error', id, error: errorMessage } as WorkerResponse);
  }
};

export {};
