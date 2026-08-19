import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

// Public GA4 measurement ID — safe to commit; it's shipped in every
// rendered page anyway.
const GA_MEASUREMENT_ID = 'G-4N7XSN0FT0';
const isCloud = process.env.NOTOMORROW_AUTH === 'cloud';

export const metadata: Metadata = {
  metadataBase: new URL('https://plusonesan.com'),
  title: {
    default: 'Plus One — daily streak tracker',
    template: '%s · Plus One',
  },
  description:
    'Plus One is a GitHub-style streak tracker for daily habits. Name a thread, tap +1, watch the contribution grid fill in.',
  applicationName: 'Plus One',
  keywords: ['habit tracker', 'streak tracker', 'daily habits', 'GitHub contribution grid'],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Plus One',
    title: 'Plus One — daily streak tracker',
    description:
      'A GitHub-style streak tracker for daily habits. Name a thread, tap +1, watch the grid fill in.',
    url: 'https://plusonesan.com',
    images: [{ url: '/stickers/champion.png', width: 512, height: 512, alt: 'Plus One' }],
  },
  twitter: {
    card: 'summary',
    title: 'Plus One — daily streak tracker',
    description:
      'A GitHub-style streak tracker for daily habits. Name a thread, tap +1, watch the grid fill in.',
    images: ['/stickers/champion.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-canvas text-charcoal antialiased selection:bg-sunset-magenta/40 selection:text-charcoal">
        {children}
        {isCloud ? <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} /> : null}
      </body>
    </html>
  );
}
