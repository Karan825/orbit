'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AgentOpsButton } from './agentops';
import { ILink, NavLinks } from './navlinks';
import { SidebarLeft01Icon as SidebarIcon } from 'hugeicons-react';
import { useRef } from 'react';
import { SmallThemeTogler } from '../../small-theme-togler';

export function TopNavbar(props: { dataLinks: ILink[]; helpLinks?: ILink[] }) {
  const togglerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex items-center gap-4 sm:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" ref={togglerRef}>
            <SidebarIcon className="h-6 w-6" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex min-h-dvh max-w-xs flex-col gap-4 px-3 py-4 bg-card"
        >
          <AgentOpsButton isCollapsed={false} />
          <Separator />
          <NavLinks
            links={props.dataLinks}
            onLinkClicked={() => togglerRef.current?.click()}
          />
          <div className="mt-auto border-t border-border pt-4">
            <SmallThemeTogler withTitle alignLeft />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
