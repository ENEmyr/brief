import type { Metadata } from 'next'
import { Geist, Geist_Mono, Noto_Sans_Thai } from 'next/font/google'
import { THEME_INIT_SCRIPT } from '@/features/theme'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brief',
  description:
    "Brief turns an agent's work into an interactive decision document. The agent sends one JSON payload; you get one link to read, annotate, and answer.",
}

// Geist and Geist Mono ship no Thai subset; Thai glyphs fall through to Noto
// Sans Thai, which sits after them in both stacks (globals.css --font-sans,
// --font-mono).
const geist = Geist({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})
const geistMono = Geist_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})
const notoThai = Noto_Sans_Thai({
  weight: ['400', '500', '600', '700'],
  subsets: ['thai'],
  variable: '--font-noto-thai',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${notoThai.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
