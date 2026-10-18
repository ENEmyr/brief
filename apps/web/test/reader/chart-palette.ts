import type { Palette } from '@/features/reader/services/echarts'

/** What chartPalette('light') resolves to in a browser: the light token values in globals.css. */
export const LIGHT_PALETTE: Palette = {
  text: '#0f1214',
  sub: '#4c555d',
  line2: '#cdd2d7',
  card: '#ffffff',
  accentText: '#4d7a00',
  info: '#0b6fa8',
  good: '#13784a',
  warn: '#8f5a00',
  bad: '#c0322d',
  dataOrange: '#b4530f',
  dataTeal: '#0b7a70',
  font: "'Geist Mono', 'Noto Sans Thai', ui-monospace, monospace",
}
