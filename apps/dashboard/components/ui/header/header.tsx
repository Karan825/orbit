'use client';

import { useHeaderContext } from '@/app/providers/header-provider';
import { NavbarClient } from '../navbar/navbar-client';
import { UserMenu } from './user-menu';
import { cn } from '@/lib/utils';

export const Header = ({ mobile }: { search?: boolean; mobile: boolean }) => {
  const { headerTitle, headerContent } = useHeaderContext();

  return (
    <nav className="sticky left-0 right-0 top-0 z-10 backdrop-blur-md bg-white/95 border-b border-[#E2E4F0] shadow-[0_1px_2px_rgba(0,0,0,0.03)] w-full">
      <div
        className={cn(
          'relative h-[60px] w-full px-6 sm:px-8',
          'flex items-center justify-between',
        )}
      >
        {/* Left section: mobile toggle + Page Title */}
        <div className="flex items-center gap-4">
          <NavbarClient mobile={mobile} />

          {headerTitle && (
            <h2 className="my-auto text-lg font-bold text-[#1E2038] tracking-tight">
              {headerTitle}
            </h2>
          )}
        </div>

        {/* Right section: user profile + action content */}
        <div className="flex items-center gap-3">
          {headerContent && (
            <div className="rounded-md bg-[#F0F2FA] p-1">{headerContent}</div>
          )}
          <UserMenu showText={true} />
        </div>
      </div>
    </nav>
  );
};
