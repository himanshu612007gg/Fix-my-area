import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { PwaRegister } from '@/components/PwaRegister';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Fix my area',
    template: '%s | Fix my area',
  },
  description:
    'A modern public grievance and civic coordination portal for citizens, local administrations, and control-room teams across India.',
  applicationName: 'Fix my area',
  generator: 'Codex',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fix my area',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff8ef' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2937' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <PwaRegister />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
