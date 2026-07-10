import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brief',
  description: 'Decision docs from your coding agent',
}

const themeInit = `(function(){try{var t=localStorage.getItem('idocs:theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'mocha':'latte'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','latte')}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
