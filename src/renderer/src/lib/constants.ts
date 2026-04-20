export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8] as const

export const MIN_ZOOM = ZOOM_STEPS[0] // 0.25
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1] // 8
export const DEFAULT_ZOOM = 1

export const MAX_CANVAS_DIM = 16384
export const PDF_BASE_SCALE = 2.0

export const COLORS = {
  dominant: '#1a1a1a',
  secondary: '#252526',
  accent: '#0078d4',
  accentHover: '#1a86db',
  accentActive: '#0067b8',
  border: '#3c3c3c',
  textPrimary: '#cccccc',
  textSecondary: '#808080',
  textOnAccent: '#ffffff',
  hoverSurface: '#2d2d30',
  activeSurface: '#37373d',
  titleBar: '#1e1e1e',
  warning: '#e8a838'
} as const

export const LAYOUT = {
  titleBarHeight: 32,
  toolbarHeight: 40,
  statusBarHeight: 28
} as const
