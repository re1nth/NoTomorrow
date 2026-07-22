import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'NoTomorrow',
  description: 'Train like Ippo. Ship like a champion.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-canvas text-charcoal antialiased selection:bg-sunset-magenta/40 selection:text-charcoal">
        {children}
      </body>
    </html>
  );
}
