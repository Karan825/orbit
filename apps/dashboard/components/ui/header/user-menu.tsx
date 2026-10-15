'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import { Avatar, AvatarFallback } from '../avatar';
import { UserIcon, Logout01Icon as LogoutIcon } from 'hugeicons-react';
import { useRouter } from 'next/navigation';
import { Separator } from '../separator';
import { useAuth } from '@/app/providers/auth-provider';

export const UserMenu = ({ showText = false }: { showText?: boolean }) => {
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    } catch {}
    logout();
    router.push('/login');
  };

  const initials = isAdmin ? 'AL' : 'BO';
  const roleLabel = isAdmin ? 'Admin' : 'Team Member';

  return (
    <div className="relative flex items-center gap-3">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 flex items-center justify-center border border-[#D5D8EB] bg-[#EEF0FF]">
              <AvatarFallback className="text-xs font-bold text-[#5356FB]">
                {initials}
              </AvatarFallback>
            </Avatar>
            {showText && (
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-[#1E2038]">{user.displayName}</span>
                <span className="text-[10px] text-[#55597D]">{user.email}</span>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-2 bg-white border border-[#D5D8EB] shadow-xs rounded-xl">
          <div className="flex flex-col space-y-1 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E2038]">{user.displayName}</span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                  isAdmin
                    ? 'bg-[#EEF0FF] text-[#5356FB]'
                    : 'bg-[#F4F5FF] text-[#55597D] border border-[#D5D8EB]'
                }`}
              >
                {roleLabel}
              </span>
            </div>
            <span className="text-[11px] text-[#55597D]">{user.email}</span>
          </div>
          <Separator className="my-1.5 bg-[#E2E4F0]" />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs text-[#DC2626] font-medium p-2 rounded-lg hover:bg-[#FEF2F2] cursor-pointer"
          >
            <LogoutIcon className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};