import type { Palette } from '@/features/reader/services/echarts'

/** What chartPalette('light') resolves to in a browser: the light token values in globals.css. */
export const LIGHT_PALETTE: Palette = {
  text: '#0f1214',
  sub: '#4c555d',
  faint: '#6a737b',
  line2: '#cdd2d7',
  card: '#ffffff',
  page: '#f4f5f6',
  gridLine: '#e9ecee',
  accent: '#c5f05a',
  accentText: '#4d7a00',
  accentLine: '#5e8c10',
  info: '#0b6fa8',
  good: '#13784a',
  warn: '#8f5a00',
  bad: '#c0322d',
  dataOrange: '#b4530f',
  dataTeal: '#0b7a70',
  heat: ['#f9fafa', '#eef8d9', '#e0f5af', '#d3f384', '#c5f05a'],
  plot3d: ['#b9d98a', '#afd07c', '#99be5f', '#7ea73a', '#5e8c10'],
  plot3dGrid: '#cdd2d7',
  font: "'Geist Mono', 'Noto Sans Thai', ui-monospace, monospace",
  sans: "'Geist', 'Noto Sans Thai', ui-sans-serif, system-ui, sans-serif",
}
