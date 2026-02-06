import React, { useEffect, useRef } from 'react';
import { useViewerModeStore } from '../../stores/viewerModeStore';

const HINT_SHOW_DURATION = 3000;
const CLOSE_BTN_FADE_DELAY = 3000;

interface ViewerModeOverlayProps {
  onExit: () => void;
}

export const ViewerModeOverlay: React.FC<ViewerModeOverlayProps> = ({ onExit }) => {
  const { isActive, showHint, showCloseButton, setShowHint, setShowCloseButton } = useViewerModeStore();
  const hintTimerRef = useRef<number | null>(null);
  const closeBtnTimerRef = useRef<number | null>(null);

  // ヒントと閉じるボタンの自動非表示タイマー
  useEffect(() => {
    if (isActive) {
      // ヒントを3秒後に非表示
      hintTimerRef.current = window.setTimeout(() => {
        setShowHint(false);
      }, HINT_SHOW_DURATION);

      // 閉じるボタンを3秒後にフェードアウト
      closeBtnTimerRef.current = window.setTimeout(() => {
        setShowCloseButton(false);
      }, CLOSE_BTN_FADE_DELAY);
    }

    return () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
      if (closeBtnTimerRef.current) {
        clearTimeout(closeBtnTimerRef.current);
      }
    };
  }, [isActive, setShowHint, setShowCloseButton]);

  // マウス移動で閉じるボタンを再表示
  useEffect(() => {
    if (!isActive) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 画面上部60px以内でマウスが動いたら上部バーを表示
      if (e.clientY < 60) {
        setShowCloseButton(true);

        // タイマーをリセット
        if (closeBtnTimerRef.current) {
          clearTimeout(closeBtnTimerRef.current);
        }
        closeBtnTimerRef.current = window.setTimeout(() => {
          setShowCloseButton(false);
        }, CLOSE_BTN_FADE_DELAY);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isActive, setShowCloseButton]);

  if (!isActive) return null;

  return (
    <>
      {/* ナビゲーションヒント */}
      <div className={`viewer-nav-hint ${showHint ? 'show' : ''}`}>
        Escまたは×ボタンで閲覧モード解除
      </div>

      {/* 上部バー（閉じるボタン用） */}
      <div className={`viewer-top-bar ${showCloseButton ? 'show' : ''}`}>
        <button
          className="viewer-close-btn"
          onClick={onExit}
          title="閲覧モードを終了"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </>
  );
};
