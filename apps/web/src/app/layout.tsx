import type { Metadata } from 'next'
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brief',
  description: 'Decision docs from your coding agent',
}

const plexSans = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-plex-sans',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const themeInit = `(function(){try{var t=localStorage.getItem('idocs:theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'mocha':'latte'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','latte')}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
