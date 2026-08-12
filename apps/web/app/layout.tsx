import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import './globals.css';

// Public GA4 measurement ID — safe to commit; it's shipped in every
// rendered page anyway.
const GA_MEASUREMENT_ID = 'G-4N7XSN0FT0';
const isCloud = process.env.NOTOMORROW_AUTH === 'cloud';

export const metadata: Metadata = {
  title: 'NoTomorrow',
  description: 'Train like Ippo. Ship like a champion.',
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
