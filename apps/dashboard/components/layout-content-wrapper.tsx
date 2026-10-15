'use client';

import { Container } from '@/components/ui/container';
import { Header } from '@/components/ui/header/header';
import { Navbar } from '@/components/ui/navbar/navbar';
import { cn } from '@/lib/utils';
import { PropsWithChildren } from 'react';
import { useSidebar } from '@/app/providers/sidebar-provider';

export function LayoutContentWrapper({ children }: PropsWithChildren) {
  const { isExpanded } = useSidebar();

  return (
    <div id="main-layout-container" className="flex min-h-screen bg-[#F4F5FF]">
      <div id="left-part" className="relative z-20">
        <Navbar mobile={false} />
      </div>
      <div
        id="right-part"
        className={cn(
          'flex flex-col min-w-0 transition-all duration-300 max-sm:w-full flex-1',
          isExpanded ? 'w-[calc(100%-220px)]' : 'w-[calc(100%-68px)]',
        )}
      >
        <Header search={false} mobile={true} />
        <Container className="bg-transparent py-6 px-6 sm:px-8">
          <div className="min-h-[calc(100vh-100px)]">{children}</div>
        </Container>
      </div>
    </div>
  );
}
