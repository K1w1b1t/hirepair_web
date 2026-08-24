import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HirePair — Candidate Assistant & ATS CV Builder',
  description: 'Aplicativo mobile-first e offline-first para otimização de currículos para ATS no Brasil.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
