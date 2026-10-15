'use client';

import { ILink, NavLinks } from './navlinks';
import { LayoutRightIcon as PanelRight } from 'hugeicons-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/app/providers/sidebar-provider';
import Link from 'next/link';

export function SideNavbar({ dataLinks }: { dataLinks: ILink[]; helpLinks?: ILink[] }) {
  const { isExpanded, setIsExpanded } = useSidebar();

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={cn(
        'sticky left-0 top-0 hidden h-screen flex-col items-start justify-between border-r border-[#E2E4F0] bg-white p-0 shadow-sm transition-all duration-300 sm:flex',
        isExpanded ? 'w-[220px]' : 'w-[68px]',
      )}
    >
      <div className="w-full">
        {/* Top Brand Header */}
        <div className="flex h-[60px] w-full items-center justify-between border-b border-[#E2E4F0] px-3">
          {isExpanded ? (
            <Link href="/overview" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5356FB] text-white font-mono text-xs font-black shadow-sm">
                GW
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold leading-tight tracking-wide text-[#1E2038]">
                  MCP Gateway
                </span>
                <span className="text-[10px] font-semibold text-[#5356FB]">
                  Kubernetes
                </span>
              </div>
            </Link>
          ) : (
            <Link href="/overview" className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-[#5356FB] text-white font-mono text-xs font-black shadow-sm">
              GW
            </Link>
          )}

          {isExpanded && (
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#55597D] hover:bg-[#F0F2FA] hover:text-[#1E2038] transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelRight size={16} />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <div className="mt-3 px-2">
          <NavLinks links={dataLinks} withTitle={isExpanded} />
        </div>
      </div>

      {/* Bottom Utilities */}
      <div className="w-full border-t border-[#E2E4F0] p-3 flex items-center justify-between">
        {isExpanded ? (
          <div className="flex w-full items-center justify-between">
            <span className="text-[11px] font-medium text-[#8F95B2]">v1.0.0</span>
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#55597D] hover:bg-[#F0F2FA] hover:text-[#1E2038] transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelRight size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={toggleSidebar}
            className="mx-auto flex h-7 w-7 items-center justify-center rounded-md text-[#55597D] hover:bg-[#F0F2FA] hover:text-[#1E2038] transition-colors"
            aria-label="Expand sidebar"
          >
            <PanelRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}