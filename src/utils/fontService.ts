/**
 * システムフォント取得ユーティリティ
 */
import { invoke } from '@tauri-apps/api/core';

export const DEFAULT_FONT = 'sans-serif';

// 日本語環境で一般的なフォントのフォールバックリスト
const FALLBACK_FONTS: string[] = [
  'sans-serif',
  'serif',
  'monospace',
  'Yu Gothic',
  'Yu Mincho',
  'Meiryo',
  'MS Gothic',
  'MS PGothic',
  'MS Mincho',
  'MS PMincho',
  'BIZ UDGothic',
  'BIZ UDPGothic',
  'BIZ UDMincho',
  'BIZ UDPMincho',
  'Arial',
  'Times New Roman',
  'Courier New',
];

let cachedFonts: string[] | null = null;

/**
 * システムにインストールされているフォント一覧を取得する。
 * Tauriコマンドでレジストリから取得し、失敗時はフォールバックリストを返す。
 */
/**
 * Canvas の ctx.font に安全に使えるフォントファミリー文字列を返す。
 * スペースを含むフォント名はダブルクォートで囲み、
 * ジェネリックファミリー (sans-serif 等) はそのまま返す。
 */
const GENERIC_FAMILIES = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);

export function formatFontFamily(fontFamily?: string): string {
  if (!fontFamily) return 'sans-serif';
  if (GENERIC_FAMILIES.has(fontFamily)) return fontFamily;
  // スペースやハイフンを含む場合クォートが必要
  return `"${fontFamily}"`;
}

export async function getAvailableFonts(): Promise<string[]> {
  if (cachedFonts) return cachedFonts;

  try {
    const fonts = await invoke<string[]>('list_system_fonts');
    if (fonts && fonts.length > 0) {
      // ジェネリックファミリーを先頭に追加
      const genericFamilies = ['sans-serif', 'serif', 'monospace'];
      cachedFonts = [...genericFamilies, ...fonts];
      return cachedFonts;
    }
  } catch {
    // Tauriコマンド失敗時はフォールバック
  }

  cachedFonts = FALLBACK_FONTS;
  return cachedFonts;
}
