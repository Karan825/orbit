import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Figtree } from 'next/font/google';
import { PropsWithChildren } from 'react';
import './globals.css';
import { BackgroundImageOverlay } from '@/components/ui/background-image-overlay';

const figtreeFont = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
});

export const metadata = {
  title: 'MCP Gateway Dashboard',
  description: 'Governed MCP tool gateway on Kubernetes',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' }} suppressHydrationWarning={true}>
      <body
        className={cn(
          'min-h-screen bg-[#F4F5FF] text-[#1E2038] antialiased',
          figtreeFont.className,
          figtreeFont.variable,
        )}
      >
        <BackgroundImageOverlay
          backgroundImageUrl="url(/image/diagonal-pattern.svg)"
          opacity={0.04}
          additionalStyles={{
            backgroundRepeat: 'repeat',
            backgroundSize: '6px 6px',
            position: 'fixed',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
