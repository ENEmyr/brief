import type { Metadata } from 'next'
import { THEME_INIT_SCRIPT } from '@/features/theme'
import './fonts.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brief',
  description:
    "Brief turns an agent's work into an interactive decision document. The agent sends one JSON payload; you get one link to read, annotate, and answer.",
}

// The first-paint primary faces (the Latin subset of each family, the ones next/font used to
// preload). Without these the browser finds the fonts only after parsing fonts.css.
const PRELOADED_FONTS = [
  new URL('./fonts/22a5144ee8d83bca-s.p.woff2', import.meta.url),
  new URL('./fonts/7d4881bb7e1bf84d-s.p.woff2', import.meta.url),
  new URL('./fonts/f196b1e65fee88ed-s.p.woff2', import.meta.url),
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {PRELOADED_FONTS.map((url) => (
          <link
            key={url.href}
            rel="preload"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
            href={url.href}
          />
        ))}
      </head>
      <body>{children}</body>
    </html>
  )
}
