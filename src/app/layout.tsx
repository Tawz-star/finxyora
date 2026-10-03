import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'FINXYORA 2026 | Inter-Collegiate FinTech & Commerce Festival',
  description: 'FINXYORA is the premier inter-collegiate FinTech festival organized by the Commerce Department and FinTech Association. Join us for 6 flagship events in AI, leadership, corporate presentation, blockchain, and financial strategy.',
  keywords: ['FinTech festival', 'FINXYORA', 'Commerce fest', 'Prompt Perfect', 'Best Manager', 'Corporate Walk', 'B Quiz', 'Football Auction', 'inter-collegiate fest'],
  authors: [{ name: 'Commerce Department — FinTech Association' }],
  openGraph: {
    title: 'FINXYORA 2026 — Where Finance Meets Innovation',
    description: 'Inter-collegiate technical, management, and cultural festival featuring 6 flagship events and vibrant student & vendor stalls.',
    siteName: 'FINXYORA',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="antialiased min-h-screen flex flex-col bg-[#07152f] text-slate-100 selection:bg-sky-500 selection:text-white">
        <Navbar />
        <main className="flex-grow pt-24 sm:pt-28 md:pt-32">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
