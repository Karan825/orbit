'use client';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function AgentOpsButton({ isCollapsed = false }: { isCollapsed?: boolean }) {
  return (
    <nav className="grid gap-1 px-2">
      {isCollapsed ? (
        <Link
          href="/overview"
          className={cn(
            buttonVariants({
              variant: 'outline',
              size: 'icon',
            }),
            'h-9 w-9 border-border bg-white text-primary-foreground hover:bg-slate-50',
          )}
        >
          <span className="font-mono text-sm font-black text-[#5356FB]">G</span>
          <span className="sr-only">MCP Gateway</span>
        </Link>
      ) : (
        <Link
          href="/overview"
          className={cn(
            buttonVariants({
              variant: 'outline',
              size: 'sm',
            }),
            'justify-start overflow-hidden border-border bg-white px-3 py-5 font-bold text-[#1E2038] hover:bg-slate-50',
          )}
        >
          <div className="mr-2.5 flex h-6 w-6 items-center justify-center rounded-md bg-[#5356FB] text-xs font-mono font-black text-white shadow-xs">
            GW
          </div>
          <div className="flex flex-col text-left">
            <span className="text-sm font-bold leading-tight tracking-wide text-[#1E2038]">MCP Gateway</span>
            <span className="text-[10px] font-medium leading-none text-[#5356FB]">Kubernetes Core</span>
          </div>
        </Link>
      )}
    </nav>
  );
}
