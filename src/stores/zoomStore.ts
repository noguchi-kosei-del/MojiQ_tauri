import { create } from 'zustand';

interface ZoomState {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setZoom: (zoom: number) => void;
  zoomToFit: (pageWidth: number, pageHeight: number, containerWidth: number, containerHeight: number) => void;
}

export const useZoomStore = create<ZoomState>((set, get) => ({
  zoom: 1,
  minZoom: 0.25,
  maxZoom: 4,
  zoomStep: 0.25,

  zoomIn: () => {
    const { zoom, maxZoom, zoomStep } = get();
    const newZoom = Math.min(zoom + zoomStep, maxZoom);
    set({ zoom: newZoom });
  },

  zoomOut: () => {
    const { zoom, minZoom, zoomStep } = get();
    const newZoom = Math.max(zoom - zoomStep, minZoom);
    set({ zoom: newZoom });
  },

  resetZoom: () => set({ zoom: 1 }),

  setZoom: (zoom) => {
    const { minZoom, maxZoom } = get();
    const clampedZoom = Math.max(minZoom, Math.min(zoom, maxZoom));
    set({ zoom: clampedZoom });
  },

  zoomToFit: (pageWidth, pageHeight, containerWidth, containerHeight) => {
    if (pageWidth <= 0 || pageHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) return;
    const { minZoom, maxZoom } = get();
    // baseScaleは通常モードでmin(scaleX, scaleY, 1)で計算される
    // zoomToFitではbaseScale*zoom でページが収まるようにzoomを設定
    const scaleX = containerWidth / pageWidth;
    const scaleY = containerHeight / pageHeight;
    const fitScale = Math.min(scaleX, scaleY);
    // baseScale = min(fitScale, 1) なので、zoom = fitScale / baseScale
    const baseScale = Math.min(fitScale, 1);
    const targetZoom = fitScale / baseScale;
    const clampedZoom = Math.max(minZoom, Math.min(targetZoom, maxZoom));
    set({ zoom: clampedZoom });
  },
}));
