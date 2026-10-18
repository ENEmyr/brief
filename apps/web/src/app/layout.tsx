import type { Metadata } from 'next'
import { THEME_INIT_SCRIPT } from '@/features/theme'
import './fonts.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brief',
  description:
    "Brief turns an agent's work into an interactive decision document. The agent sends one JSON payload; you get one link to read, annotate, and answer.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
