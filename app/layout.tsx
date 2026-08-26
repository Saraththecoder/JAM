import type { Metadata, Viewport } from 'next';
import { Outfit, Newsreader } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-newsreader',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#eae7dc',
};

export const metadata: Metadata = {
  title: { default: 'JAM — Just A Minute', template: '%s | JAM' },
  description: 'Instant academic letter automation for AITS students and faculty. Submit leave requests, outing passes, and event conduct letters — digitally signed in minutes.',
  keywords: ['AITS', 'letter automation', 'digital signature', 'leave request', 'student portal'],
  authors: [{ name: 'AITS AI&ML Department' }],
  openGraph: {
    title: 'JAM — Just A Minute',
    description: 'Automated letter routing, digital signing, and real-time approval for AITS.',
    type: 'website',
    locale: 'en_IN',
  },
  robots: { index: false, follow: false }, // Private institution portal
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#fbfaf7] text-[#1c1a17]">
        {children}
      </body>
    </html>
  );
}
