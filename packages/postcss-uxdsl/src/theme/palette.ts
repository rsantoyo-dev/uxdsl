import type { SjPalette } from './models';

// Sensible defaults; adjust as needed. These are placeholders that keep
// contrast readable and follow a familiar scale.
export const DEFAULT_PALETTE: SjPalette = {
  primary: {
    main: '#2C415C',
    light: '#8AA7BA',
    dark: '#25374E',
    contrast: '#FFFFFF',
  },
  secondary: {
    main: '#475569',
    light: '#94A3B8',
    dark: '#334155',
    contrast: '#FFFFFF',
  },
  tertiary: {
    main: '#CBD5E1',
    light: '#E2E8F0',
    dark: '#94A3B8',
    contrast: '#000000',
  },
  success: {
    main: '#166534',
    light: '#15803D',
    dark: '#166534',
    contrast: '#FFFFFF',
  },
  info: {
    main: '#2563EB',
    light: '#3B82F6',
    dark: '#2563EB',
    contrast: '#FFFFFF',
  },
  warning: {
    main: '#F59E0B',
    light: '#F59E0B',
    dark: '#D97706',
    contrast: '#0B1220',
  },
  error: {
    main: '#C61625',
    light: '#EC1B2E',
    dark: '#C61625',
    contrast: '#FFFFFF',
  },
  dark: {
    main: '#1F2937',
    light: '#475569',
    dark: '#0B1220',
    contrast: '#FFFFFF',
  },
  neutral: {
    main: '#E2E8F0',
    light: '#F8FAFC',
    dark: '#CBD5E1',
    contrast: '#0B1220',
  },
  light: {
    main: '#FFFFFF',
    light: '#F8FAFC',
    dark: '#F1F5F9',
    contrast: '#0B1220',
  },
};
