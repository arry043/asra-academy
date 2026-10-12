import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { publicEnv } from '@/lib/env';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: 'ASRA Academy',
    template: '%s | ASRA Academy',
  },
  description:
    'ASRA Academy — online learning for Classes 6–12, English, Entrepreneurship & Business, Quranic Studies, Arabic and Urdu.',
  applicationName: 'ASRA Academy',
  // Foundation build: keep out of search indexes until the public website phase ships.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0f4d36',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
