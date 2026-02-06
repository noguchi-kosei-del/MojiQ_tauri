import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDrawingStore } from '../../stores/drawingStore';
import { usePageNavStore } from '../../stores/pageNavStore';
import './PageNav.css';

// SVG Icons
const PrevIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

const NextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const FADE_DELAY_MS = 3000;

export const PageNav: React.FC = () => {
  const { pages, currentPage, setCurrentPage } = useDrawingStore();
  const { isPageNavHidden } = usePageNavStore();
  const [isDragging, setIsDragging] = useState(false);
  const [sliderValue, setSliderValue] = useState(currentPage + 1);
  const [isFadedOut, setIsFadedOut] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = pages.length;

  // Calculate bubble left position based on value
  // Thumb width is 16px, slider container has 8px padding on each side
  const getBubbleLeft = useCallback((value: number, maxPages: number): string => {
    const min = 1;
    const max = maxPages;
    if (max <= min) {
      // Single page: center position
      return '50%';
    }
    // RTL slider with dir="rtl":
    // - value=1 (min) → thumb at RIGHT end of track
    // - value=max → thumb at LEFT end of track
    //
    // Slider container has padding: 0 8px, so input is inset by 8px on each side.
    // Thumb is 16px wide. In a standard range input, the thumb center moves from
    // (thumbWidth/2) from left edge to (thumbWidth/2) from right edge of the input.
    //
    // In container coordinates:
    // - value=max (left end): containerPadding + thumbRadius = 8 + 8 = 16px
    // - value=1 (right end): containerWidth - containerPadding - thumbRadius = 100% - 8 - 8 = 100% - 16px
    //
    // Linear interpolation based on value:
    const t = (max - value) / (max - min); // 0 at value=max (left), 1 at value=1 (right)
    // position = 16px + t * (containerWidth - 32px) = 16 + t * (100% - 32px)
    // = t * 100% + 16 - t * 32
    return `calc(${t * 100}% + ${16 - t * 32}px)`;
  }, []);

  // Reset fade timer
  const resetFadeTimer = useCallback(() => {
    if (totalPages === 0) return;

    setIsFadedOut(false);
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
    }

    fadeTimerRef.current = setTimeout(() => {
      setIsFadedOut(true);
    }, FADE_DELAY_MS);
  }, [totalPages]);

  // Show bar on mount
  useEffect(() => {
    resetFadeTimer();
    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, [resetFadeTimer]);

  // Sync slider value with current page
  useEffect(() => {
    if (!isDragging) {
      setSliderValue(currentPage + 1);
      resetFadeTimer();
    }
  }, [currentPage, isDragging, resetFadeTimer]);

  // Handle slider input (during drag)
  const handleSliderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setSliderValue(value);
    resetFadeTimer();
  };

  // Handle slider change (on release)
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setCurrentPage(value - 1);
    resetFadeTimer();
  };

  // Handle drag start
  const handleDragStart = () => {
    setIsDragging(true);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
    setCurrentPage(sliderValue - 1);
  };

  // Handle prev button (right-to-left: prev = +1)
  const handlePrev = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Handle next button (right-to-left: next = -1)
  const handleNext = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Handle mouse enter to show bar (even when faded out)
  const handleMouseEnter = () => {
    setIsFadedOut(false);
    resetFadeTimer();
  };

  if (totalPages <= 1) return null;

  return (
    <>
      {/* Invisible hover area to catch mouse when bar is faded out */}
      {!isPageNavHidden && (
        <div
          className="page-nav-hover-area"
          onMouseEnter={handleMouseEnter}
        />
      )}
      <div
        className={`page-nav-bar ${isFadedOut ? 'fade-out' : ''} ${isPageNavHidden ? 'hidden' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseMove={resetFadeTimer}
      >
        <div className="slider-container">
          <span
            className={`slider-bubble visible ${isDragging ? 'dragging' : ''}`}
            style={{
              left: getBubbleLeft(sliderValue, totalPages)
            }}
          >
            {sliderValue}/{totalPages}
          </span>
          <input
            type="range"
            className="page-slider"
            min="1"
            max={totalPages}
            value={sliderValue}
            step="1"
            dir="rtl"
            onInput={handleSliderInput as React.FormEventHandler<HTMLInputElement>}
            onChange={handleSliderChange}
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
          />
        </div>
        <div className="nav-buttons">
          <button
            onClick={handlePrev}
            disabled={currentPage === totalPages - 1}
            title="次のページ"
          >
            <PrevIcon />
          </button>
          <button
            onClick={handleNext}
            disabled={currentPage === 0}
            title="前のページ"
          >
            <NextIcon />
          </button>
        </div>
      </div>
    </>
  );
};
