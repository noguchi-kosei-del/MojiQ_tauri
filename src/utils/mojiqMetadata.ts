/**
 * MojiQ メタデータの PDF `/Subject` フィールド保存・復元
 *
 * 旧 MojiQ (pdf-lib-saver.js / pdf-manager.js) との互換フォーマット:
 *   MojiQ:commentTextHidden=true;MojiQText:<Base64>;MojiQChecked:<Base64>
 *
 * - MojiQText: PDF 注釈由来テキストのリスト (ページ番号・テキスト・座標・表示サイズ)
 * - MojiQChecked: 確認済み注釈のリスト (ページ番号・内容・座標)
 * - commentTextHidden: 保存時点でコメントテキストが非表示状態だったかのフラグ
 *
 * Base64 は「UTF-8 → Base64」エンコード。旧 MojiQ の
 *   btoa(unescape(encodeURIComponent(s)))
 * と完全互換。
 */

export interface MojiQTextEntry {
  /** PDF ページ番号 (1 始まり) */
  pdfPage: number;
  /** テキスト内容 */
  contents: string;
  /** 保存時点のキャンバス座標 */
  canvasRect: { x: number; y: number };
  /** 保存時点の表示幅 */
  displayWidth: number;
  /** 保存時点の表示高さ */
  displayHeight: number;
}

export interface MojiQCheckedEntry {
  /** PDF ページ番号 (1 始まり) */
  pdfPage: number;
  /** 確認済み注釈のテキスト内容 */
  contents: string;
  /** キャンバス座標 (無い場合 null) */
  canvasRect: { x: number; y: number } | null;
}

export interface ParsedMojiqMetadata {
  /** MojiQ で保存済みの PDF かどうか */
  isMojiqSaved: boolean;
  /** コメントテキストを非表示で保存したか */
  commentTextHidden: boolean;
  /** 保存されていた MojiQText エントリ */
  texts: MojiQTextEntry[];
  /** 保存されていた MojiQChecked エントリ */
  checked: MojiQCheckedEntry[];
}

// ===== UTF-8 対応 Base64 =====

/**
 * UTF-8 文字列を Base64 にエンコード。
 * 旧 MojiQ の `btoa(unescape(encodeURIComponent(s)))` と同等の出力を返す。
 */
export function encodeUtf8Base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 を UTF-8 文字列にデコード。
 * 旧 MojiQ の `decodeURIComponent(escape(atob(b64)))` と同等。
 */
export function decodeUtf8Base64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// ===== Subject フィールドのパーサ =====

/**
 * PDF の `/Subject` フィールド文字列から MojiQ メタデータを抽出する。
 * 非 MojiQ PDF や壊れた値を渡されても常に安全に { isMojiqSaved: false, ... } を返す。
 */
export function parseMojiqSubject(subject: string | null | undefined): ParsedMojiqMetadata {
  const empty: ParsedMojiqMetadata = {
    isMojiqSaved: false,
    commentTextHidden: false,
    texts: [],
    checked: [],
  };

  if (!subject || typeof subject !== 'string') return empty;
  if (!subject.includes('MojiQ:')) return empty;

  const result: ParsedMojiqMetadata = {
    isMojiqSaved: true,
    commentTextHidden: subject.includes('MojiQ:commentTextHidden=true'),
    texts: [],
    checked: [],
  };

  // MojiQText パート
  const textMatch = subject.match(/MojiQText:([A-Za-z0-9+/=]+)/);
  if (textMatch && textMatch[1]) {
    try {
      const jsonStr = decodeUtf8Base64(textMatch[1]);
      const arr = JSON.parse(jsonStr);
      if (Array.isArray(arr)) {
        result.texts = arr
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            pdfPage: Number(item.p) || 0,
            contents: typeof item.t === 'string' ? item.t : '',
            canvasRect: {
              x: Number(item.x) || 0,
              y: Number(item.y) || 0,
            },
            displayWidth: Number(item.w) || 595,
            displayHeight: Number(item.h) || 842,
          }));
      }
    } catch (e) {
      console.warn('[MojiQ] MojiQText メタデータの復元に失敗:', e);
    }
  }

  // MojiQChecked パート
  const checkedMatch = subject.match(/MojiQChecked:([A-Za-z0-9+/=]+)/);
  if (checkedMatch && checkedMatch[1]) {
    try {
      const jsonStr = decodeUtf8Base64(checkedMatch[1]);
      const arr = JSON.parse(jsonStr);
      if (Array.isArray(arr)) {
        result.checked = arr
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            pdfPage: Number(item.p) || 0,
            contents: typeof item.c === 'string' ? item.c : '',
            canvasRect:
              item.x !== null && item.x !== undefined && item.y !== null && item.y !== undefined
                ? { x: Number(item.x) || 0, y: Number(item.y) || 0 }
                : null,
          }));
      }
    } catch (e) {
      console.warn('[MojiQ] MojiQChecked メタデータの復元に失敗:', e);
    }
  }

  return result;
}

// ===== Subject フィールドのビルダー =====

export interface BuildSubjectOptions {
  /** コメントテキスト非表示フラグ (保存時は常に true を推奨) */
  commentTextHidden: boolean;
  /** 保存する MojiQText エントリ */
  texts: MojiQTextEntry[];
  /** 保存する MojiQChecked エントリ */
  checked: MojiQCheckedEntry[];
}

/**
 * MojiQ メタデータから PDF `/Subject` フィールド文字列を生成する。
 * エントリが空の場合でも `MojiQ:` プレフィクスは必ず出力するため、
 * 再読み込み時に「MojiQ 保存済み」と判定できる。
 */
export function buildMojiqSubject(options: BuildSubjectOptions): string {
  const parts: string[] = [];

  parts.push(`MojiQ:commentTextHidden=${options.commentTextHidden ? 'true' : 'false'}`);

  if (options.texts.length > 0) {
    // 旧 MojiQ 互換のコンパクト形式 {p, t, x, y, w, h}
    const compact = options.texts.map((t) => ({
      p: t.pdfPage,
      t: t.contents,
      x: Math.round(t.canvasRect.x),
      y: Math.round(t.canvasRect.y),
      w: Math.round(t.displayWidth),
      h: Math.round(t.displayHeight),
    }));
    const b64 = encodeUtf8Base64(JSON.stringify(compact));
    parts.push(`MojiQText:${b64}`);
  }

  if (options.checked.length > 0) {
    // 旧 MojiQ 互換のコンパクト形式 {p, c, x, y}
    const compact = options.checked.map((c) => ({
      p: c.pdfPage,
      c: c.contents,
      x: c.canvasRect ? Math.round(c.canvasRect.x) : null,
      y: c.canvasRect ? Math.round(c.canvasRect.y) : null,
    }));
    const b64 = encodeUtf8Base64(JSON.stringify(compact));
    parts.push(`MojiQChecked:${b64}`);
  }

  return parts.join(';');
}

// ===== 注釈オブジェクトが MojiQ 処理済みかの判定 =====

/**
 * PDF から抽出した注釈オブジェクトが、既に MojiQText メタデータに記録済みか判定する。
 * 記録済みの注釈は再度オブジェクト化せずスキップすべき (Acrobat 往復で重複生成を防ぐ)。
 *
 * 旧 MojiQ の `isMojiQProcessedAnnotation` と同じロジック:
 * - テキスト内容の完全一致 → マッチ
 * - 座標の近接一致 (30px 以内、表示サイズの違いをスケーリング補正) → マッチ
 */
export function isMojiQProcessedAnnotation(
  annotationText: string,
  annotationX: number,
  annotationY: number,
  pdfPage: number,
  loadedTexts: MojiQTextEntry[],
  currentDisplayWidth: number,
  currentDisplayHeight: number,
): boolean {
  if (!loadedTexts || loadedTexts.length === 0) return false;

  for (const saved of loadedTexts) {
    if (saved.pdfPage !== pdfPage) continue;

    // テキスト内容の完全一致
    if (annotationText === saved.contents) {
      return true;
    }

    // 座標の近接一致 (表示サイズの違いをスケーリングで吸収)
    const savedW = saved.displayWidth || currentDisplayWidth;
    const savedH = saved.displayHeight || currentDisplayHeight;
    const scaleX = currentDisplayWidth / savedW;
    const scaleY = currentDisplayHeight / savedH;
    const scaledX = saved.canvasRect.x * scaleX;
    const scaledY = saved.canvasRect.y * scaleY;

    const dx = Math.abs(annotationX - scaledX);
    const dy = Math.abs(annotationY - scaledY);
    if (dx < 30 && dy < 30) {
      return true;
    }
  }
  return false;
}
