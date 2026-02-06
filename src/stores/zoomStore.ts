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
}));
