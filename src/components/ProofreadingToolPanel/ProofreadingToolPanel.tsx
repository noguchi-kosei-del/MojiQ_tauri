import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { StampType } from '../../types';
import './ProofreadingToolPanel.css';

// 校正指示スタンプの種類（UI用）
export type ProofreadingStampType =
  | 'toru'           // トル
  | 'torutsume'      // トルツメ
  | 'torumama'       // トルママ
  | 'zenkakuaki'     // 全角アキ
  | 'hankakuaki'     // 半角アキ
  | 'kaigyou'        // 改行
  | 'tojiru'         // とじる
  | 'hiraku'         // ひらく
  | 'komoji'         // 小文字指定
  | 'jikan'          // 字間指示
  | 'done'           // 済
  | 'ruby';          // ルビ

// 校正記号の種類
export type ProofreadingSymbolType =
  | 'rectSymbol'     // □（全角アキ）
  | 'triangleSymbol' // △（半角アキ）
  | 'chevron'        // ＜（アキ）
  | 'lshape'         // ∟（行移動）
  | 'zshape'         // Z形（改行）
  | 'bracket'        // ⊐（全体移動）
  | 'semicircle';    // ◠（半円）

// UI上のスタンプタイプからstore用のStampTypeへのマッピング
const stampTypeMapping: Record<ProofreadingStampType, StampType | null> = {
  toru: 'toruStamp',
  torutsume: 'torutsumeStamp',
  torumama: 'torumamaStamp',
  zenkakuaki: 'zenkakuakiStamp',
  hankakuaki: 'hankakuakiStamp',
  kaigyou: 'kaigyouStamp',
  tojiru: 'tojiruStamp',
  hiraku: 'hirakuStamp',
  komoji: 'komojiStamp',
  jikan: null, // 字間指示はdoubleArrowツールを使用
  done: 'doneStamp',
  ruby: 'rubyStamp',
};

// アイコンコンポーネント
const ProofreadingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

// Z形改行アイコン
const ZShapeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2 L4 9 L14 9 L14 16"/>
  </svg>
);

interface ProofreadingToolPanelProps {
  onStampSelect?: (stampType: ProofreadingStampType) => void;
  onSymbolSelect?: (symbolType: ProofreadingSymbolType) => void;
}

export const ProofreadingToolPanel: React.FC<ProofreadingToolPanelProps> = ({
  onStampSelect,
  onSymbolSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStamp, setSelectedStamp] = useState<ProofreadingStampType | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<ProofreadingSymbolType | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { tool, setTool, setColor, setCurrentStampType } = useDrawingStore();

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 他のツールに切り替わったら選択を解除
  useEffect(() => {
    // スタンプツール、両矢印ツール、または校正記号関連ツール以外に切り替わった場合
    const proofreadingTools = ['stamp', 'doubleArrow', 'rect', 'polyline', 'ellipse'];
    if (!proofreadingTools.includes(tool)) {
      setSelectedStamp(null);
      setSelectedSymbol(null);
    }
  }, [tool]);

  // 校正指示スタンプのラベル
  const stampLabels: Record<ProofreadingStampType, string> = {
    toru: 'トル',
    torutsume: 'トルツメ',
    torumama: 'トルママ',
    zenkakuaki: '全角アキ',
    hankakuaki: '半角アキ',
    kaigyou: '改行',
    tojiru: 'とじる',
    hiraku: 'ひらく',
    komoji: '小文字指定',
    jikan: '字間指示',
    done: '済',
    ruby: 'ルビ',
  };

  // 校正記号のラベル
  const symbolLabels: Record<ProofreadingSymbolType, { icon: string | React.ReactNode; label: string }> = {
    rectSymbol: { icon: '□', label: '全角アキ' },
    triangleSymbol: { icon: '△', label: '半角アキ' },
    chevron: { icon: '＜', label: 'アキ' },
    lshape: { icon: '∟', label: '行移動' },
    zshape: { icon: <ZShapeIcon />, label: '改行' },
    bracket: { icon: '⊐', label: '全体移動' },
    semicircle: { icon: '◠', label: '半円' },
  };

  // スタンプ選択ハンドラ
  const handleStampSelect = useCallback((stampType: ProofreadingStampType) => {
    setSelectedStamp(stampType);
    setSelectedSymbol(null);
    setColor('#ff0000');

    // 字間指示の場合は両矢印ツールを使用
    if (stampType === 'jikan') {
      setCurrentStampType(null);
      setTool('doubleArrow');
    } else {
      // スタンプモードに切り替え
      const storeStampType = stampTypeMapping[stampType];
      if (storeStampType) {
        setCurrentStampType(storeStampType);
        setTool('stamp');
      }
    }

    if (onStampSelect) {
      onStampSelect(stampType);
    }
  }, [setTool, setColor, setCurrentStampType, onStampSelect]);

  // 校正記号選択ハンドラ
  const handleSymbolSelect = useCallback((symbolType: ProofreadingSymbolType) => {
    setSelectedSymbol(symbolType);
    setSelectedStamp(null);
    setColor('#ff0000');
    setCurrentStampType(null);

    // 各記号に対応するツールに切り替え
    switch (symbolType) {
      case 'rectSymbol':
        setTool('rect');
        break;
      case 'triangleSymbol':
        setTool('polyline');
        break;
      case 'chevron':
        setTool('polyline');
        break;
      case 'lshape':
        setTool('polyline');
        break;
      case 'zshape':
        setTool('polyline');
        break;
      case 'bracket':
        setTool('polyline');
        break;
      case 'semicircle':
        setTool('ellipse');
        break;
      default:
        setTool('pen');
    }

    if (onSymbolSelect) {
      onSymbolSelect(symbolType);
    }
  }, [setTool, setColor, setCurrentStampType, onSymbolSelect]);

  // 選択中の表示テキスト
  const getSelectedDisplayText = (): string => {
    if (selectedStamp) {
      return stampLabels[selectedStamp];
    }
    if (selectedSymbol) {
      return symbolLabels[selectedSymbol].label;
    }
    return '';
  };

  return (
    <div className="proofreading-tool-panel" ref={dropdownRef}>
      <button
        className={`proofreading-toggle-btn ${isOpen ? 'open' : ''} ${(selectedStamp || selectedSymbol) ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="校正ツール"
      >
        <ProofreadingIcon />
        {(selectedStamp || selectedSymbol) && (
          <span className="proofreading-badge">{getSelectedDisplayText()}</span>
        )}
      </button>

      {isOpen && (
        <div className="proofreading-dropdown">
          {/* 校正指示ツールセクション */}
          <div className="proofreading-section">
            <div className="proofreading-section-label">校正指示ツール</div>
            <div className="proofreading-stamp-grid">
              {(['toru', 'torutsume', 'torumama', 'zenkakuaki', 'hankakuaki', 'kaigyou', 'tojiru', 'hiraku', 'komoji', 'jikan'] as ProofreadingStampType[]).map((stamp) => {
                // 長い名前は2行に分割
                const labelLines: Record<string, [string, string] | null> = {
                  torutsume: ['トル', 'ツメ'],
                  torumama: ['トル', 'ママ'],
                  zenkakuaki: ['全角', 'アキ'],
                  hankakuaki: ['半角', 'アキ'],
                  komoji: ['小文字', '指定'],
                  jikan: ['字間', '指示'],
                };
                const lines = labelLines[stamp];

                return (
                  <button
                    key={stamp}
                    className={`proofreading-stamp-btn ${selectedStamp === stamp ? 'active' : ''}`}
                    onClick={() => handleStampSelect(stamp)}
                    title={stampLabels[stamp]}
                  >
                    {lines ? (
                      <>
                        {lines[0]}
                        <br />
                        {lines[1]}
                      </>
                    ) : (
                      stampLabels[stamp]
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 写植指示スタンプセクション */}
          <div className="proofreading-section">
            <div className="proofreading-section-label">写植指示スタンプ</div>
            <div className="proofreading-stamp-grid shashoku">
              {(['done', 'ruby'] as ProofreadingStampType[]).map((stamp) => (
                <button
                  key={stamp}
                  className={`proofreading-stamp-btn ${selectedStamp === stamp ? 'active' : ''}`}
                  onClick={() => handleStampSelect(stamp)}
                  title={stampLabels[stamp]}
                >
                  {stampLabels[stamp]}
                </button>
              ))}
            </div>
          </div>

          {/* 校正記号ツールセクション */}
          <div className="proofreading-section">
            <div className="proofreading-section-label">校正記号ツール</div>
            <div className="proofreading-symbol-grid">
              {(Object.keys(symbolLabels) as ProofreadingSymbolType[]).map((symbol) => (
                <button
                  key={symbol}
                  className={`proofreading-symbol-btn ${selectedSymbol === symbol ? 'active' : ''}`}
                  onClick={() => handleSymbolSelect(symbol)}
                  title={symbolLabels[symbol].label}
                >
                  <span className="symbol-icon">
                    {symbolLabels[symbol].icon}
                  </span>
                  <span className="symbol-label">
                    {symbolLabels[symbol].label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProofreadingToolPanel;
