import '@/app/globals.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PropsWithChildren, Suspense } from 'react';
import HeaderProvider from '@/app/providers/header-provider';
import { SidebarProvider } from '@/app/providers/sidebar-provider';
import { LayoutContentWrapper } from '@/components/layout-content-wrapper';
import ReactQueryProvider from '@/app/providers/react-query-provider';

export default async function AppLayout({ children }: PropsWithChildren) {
  return (
    <ReactQueryProvider>
      <TooltipProvider>
        <HeaderProvider>
          <SidebarProvider>
            <LayoutContentWrapper>
              <Suspense fallback={<div className="p-8 text-muted-foreground animate-pulse">Loading view...</div>}>
                {children}
              </Suspense>
            </LayoutContentWrapper>
          </SidebarProvider>
        </HeaderProvider>
      </TooltipProvider>
    </ReactQueryProvider>
  );
}
