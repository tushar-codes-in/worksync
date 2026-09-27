import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/providers/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SYNC — Real-time project management',
  description:
    'Collaborative project & task management with real-time updates.',

  icons: {
    icon: '/sync.png',
    shortcut: '/sync.png',
    apple: '/sync.png',
  },

  openGraph: {
    title: 'SYNC — Real-time project management',
    description:
      'Collaborative project & task management with real-time updates.',
    url: 'https://sync-main.vercel.app',
    siteName: 'SYNC',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SYNC Project Management',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'SYNC — Real-time project management',
    description:
      'Collaborative project & task management with real-time updates.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}