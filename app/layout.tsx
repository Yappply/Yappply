import type { Metadata } from 'next'
import { Bricolage_Grotesque, Instrument_Serif } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'
import '@/App.css'
import '@/styles/yappply-app.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
})

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Yappply — Talk to Yappy for 30 minutes a day and speak English with confidence',
  description:
    'Talk out loud with Yappy, your AI speaking buddy, for 30 minutes every day. Get corrected as you go, and a full report after every call.',
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/favicon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <Providers>
          <div className="app-shell">{children}</div>
        </Providers>
      </body>
    </html>
  )
}
