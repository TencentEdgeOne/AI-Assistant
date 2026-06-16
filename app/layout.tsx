import type { Metadata } from 'next';
import { I18nProvider } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'SiteAgent',
  description: 'AI-powered site agent — embed on any website with one line of code.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
