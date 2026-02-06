import React, { useCallback, useEffect } from 'react';
import { useThemeStore } from '../../stores/themeStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useDrawingStore } from '../../stores/drawingStore';
import { ask } from '@tauri-apps/plugin-dialog';
import './HamburgerMenu.css';

// SVG Icons
const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const FlipIcon = ({ isFlipped }: { isFlipped: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
    {isFlipped ? (
      <>
        <polygon points="2,12 10,4 10,20" fill="none"/>
        <polygon points="22,12 14,4 14,20" fill="currentColor"/>
      </>
    ) : (
      <>
        <polygon points="2,12 10,4 10,20" fill="currentColor"/>
        <polygon points="22,12 14,4 14,20" fill="none"/>
      </>
    )}
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

// Notion links
const MENU_LINKS = [
  {
    label: 'ショートカット',
    url: 'https://hyper-coast-743.notion.site/f0ab008e8e964c7d9071bc78be6e1a53',
  },
  {
    label: '校正のやり方',
    url: 'https://hyper-coast-743.notion.site/2aa34ea373ba80cbbbf3d5e5ab94f893',
  },
  {
    label: '校正記号の入れ方/読み方',
    url: 'https://hyper-coast-743.notion.site/2e734ea373ba8009a6b3efbf43c9e1e0',
  },
];

interface HamburgerMenuProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, onToggle }) => {
  const { theme, toggleTheme } = useThemeStore();
  const { isFlipped, toggleFlipped } = useWorkspaceStore();
  const { pages, clearDocument } = useDrawingStore();

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onToggle]);

  const handleOverlayClick = useCallback(() => {
    onToggle();
  }, [onToggle]);

  const handleLinkClick = useCallback((url: string) => {
    window.open(url, '_blank');
  }, []);

  const handleGoHome = useCallback(async () => {
    if (pages.length > 0) {
      const confirmed = await ask('ホーム画面に戻りますか？\n読み込まれたPDFと描画がすべてリセットされます。', {
        title: '確認',
        kind: 'warning',
      });
      if (confirmed) {
        clearDocument();
        onToggle(); // メニューを閉じる
      }
    }
  }, [pages.length, clearDocument, onToggle]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`hamburger-overlay ${isOpen ? 'open' : ''}`}
        onClick={handleOverlayClick}
      />

      {/* Slide menu */}
      <div className={`hamburger-menu ${isOpen ? 'open' : ''}`}>
        <div className="hamburger-menu-header">
          <span className="menu-title">メニュー</span>
          <button className="menu-close-btn" onClick={onToggle} title="閉じる">
            <CloseIcon />
          </button>
        </div>

        <nav className="hamburger-menu-nav">
          {MENU_LINKS.map((link, index) => (
            <a
              key={index}
              className="menu-link"
              onClick={() => handleLinkClick(link.url)}
              role="button"
              tabIndex={0}
            >
              <span className="menu-link-icon">
                <ExternalLinkIcon />
              </span>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hamburger-menu-footer">
          <button
            className="menu-icon-btn"
            onClick={toggleFlipped}
            title="ワークスペース反転"
          >
            <FlipIcon isFlipped={isFlipped} />
          </button>
          <button
            className="menu-icon-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
          >
            {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
          </button>
          <button
            className="menu-icon-btn"
            onClick={handleGoHome}
            disabled={pages.length === 0}
            title="ホーム画面に戻る"
          >
            <HomeIcon />
          </button>
        </div>
      </div>
    </>
  );
};
