import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Public_Sans } from 'next/font/google';
import { AnalyticsConsentControl } from '../analytics/consent-control';
import { createRootMetadata } from './search-indexing';
import './globals.css';
import '../analytics/consent-control.css';

const heading = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-heading' });
const body = Public_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = createRootMetadata();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${heading.variable} ${body.variable} min-h-screen antialiased`}
        suppressHydrationWarning
      >
        {children}
        <AnalyticsConsentControl />
      </body>
    </html>
  );
}
