import type { ToolType } from '../../types';
import type { ToolHandler } from './toolContext';

// tool 名から ToolHandler を引く Map。未登録のツールは undefined を返すので
// dispatcher 側で旧ハンドラにフォールスルーする。
const registry = new Map<ToolType, ToolHandler>();

// calibration / grid モードは `tool` とは独立した store フラグで判定されるため、
// ToolType 以外のキーで登録する必要がある。それらは擬似キーで保持する。
type PseudoToolKey = 'mode:calibration' | 'mode:grid';
const pseudoRegistry = new Map<PseudoToolKey, ToolHandler>();

export const toolRegistry = {
  register(tool: ToolType, handler: ToolHandler): void {
    registry.set(tool, handler);
  },
  registerPseudo(key: PseudoToolKey, handler: ToolHandler): void {
    pseudoRegistry.set(key, handler);
  },
  get(tool: ToolType): ToolHandler | undefined {
    return registry.get(tool);
  },
  getPseudo(key: PseudoToolKey): ToolHandler | undefined {
    return pseudoRegistry.get(key);
  },
  has(tool: ToolType): boolean {
    return registry.has(tool);
  },
  clear(): void {
    registry.clear();
    pseudoRegistry.clear();
  },
};

export type { PseudoToolKey };
