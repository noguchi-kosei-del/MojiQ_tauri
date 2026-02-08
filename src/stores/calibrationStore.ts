import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 定数
export const MM_PER_PT = 0.3528; // 1pt = 0.3528mm

interface CalibrationState {
  isCalibrated: boolean;
  pixelsPerMm: number;
  isCalibrationMode: boolean;
  calibrationStart: { x: number; y: number } | null;
  calibrationEnd: { x: number; y: number } | null;
}

interface CalibrationActions {
  setCalibrated: (pixelsPerMm: number) => void;
  clearCalibration: () => void;
  enterCalibrationMode: () => void;
  exitCalibrationMode: () => void;
  setCalibrationStart: (pos: { x: number; y: number } | null) => void;
  setCalibrationEnd: (pos: { x: number; y: number } | null) => void;
  calculatePixelsPerMm: (distancePx: number, distanceMm: number) => number;
}

export const useCalibrationStore = create<CalibrationState & CalibrationActions>()(
  persist(
    (set, _get) => ({
      isCalibrated: false,
      pixelsPerMm: 1.0,
      isCalibrationMode: false,
      calibrationStart: null,
      calibrationEnd: null,

      setCalibrated: (pixelsPerMm) => {
        set({
          isCalibrated: true,
          pixelsPerMm,
          isCalibrationMode: false,
          calibrationStart: null,
          calibrationEnd: null,
        });
      },

      clearCalibration: () => {
        set({
          isCalibrated: false,
          pixelsPerMm: 1.0,
        });
      },

      enterCalibrationMode: () => {
        set({
          isCalibrationMode: true,
          calibrationStart: null,
          calibrationEnd: null,
        });
      },

      exitCalibrationMode: () => {
        set({
          isCalibrationMode: false,
          calibrationStart: null,
          calibrationEnd: null,
        });
      },

      setCalibrationStart: (pos) => {
        set({ calibrationStart: pos });
      },

      setCalibrationEnd: (pos) => {
        set({ calibrationEnd: pos });
      },

      calculatePixelsPerMm: (distancePx, distanceMm) => {
        return distancePx / distanceMm;
      },
    }),
    {
      name: 'mojiq-calibration-v2',
      // pixelsPerMmのみ永続化（isCalibrated は毎回確認が必要）
      partialize: (state) => ({
        pixelsPerMm: state.pixelsPerMm,
      }),
    }
  )
);
