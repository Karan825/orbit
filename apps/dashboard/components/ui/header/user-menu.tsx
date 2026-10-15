'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import { Avatar, AvatarFallback } from '../avatar';
import { UserIcon } from 'hugeicons-react';
import { useRouter } from 'next/navigation';
import { Separator } from '../separator';

export const UserMenu = ({ showText = false }: { showText?: boolean }) => {
  const router = useRouter();
  const [user] = useState({
    name: 'Alice (Admin)',
    email: 'alice@urumi.local',
    role: 'admin',
  });

  const signOut = () => {
    router.push('/login');
  };

  return (
    <div className="relative flex items-center gap-3">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="focus:outline-none">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 flex items-center justify-center border border-[#D5D8EB] bg-[#EEF0FF]">
              <AvatarFallback className="text-xs font-bold text-[#5356FB]">
                AL
              </AvatarFallback>
            </Avatar>
            {showText && (
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-[#1E2038]">{user.name}</span>
                <span className="text-[10px] text-[#55597D]">{user.email}</span>
              </div>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-white border border-[#E2E4F0] shadow-lg rounded-xl p-1">
          <div className="p-2 text-xs">
            <div className="font-bold text-[#1E2038]">{user.name}</div>
            <div className="text-[10px] text-[#55597D]">{user.email}</div>
            <div className="mt-1 inline-flex rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[9px] font-bold text-[#5356FB] uppercase border border-[#D5D8EB]">
              {user.role}
            </div>
          </div>
          <Separator className="bg-[#E2E4F0]" />
          <DropdownMenuItem onClick={() => router.push('/api-keys')} className="text-xs cursor-pointer text-[#1E2038] hover:bg-[#F4F5FF] rounded-lg">
            Client API Keys
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/team')} className="text-xs cursor-pointer text-[#1E2038] hover:bg-[#F4F5FF] rounded-lg">
            Team & Permissions
          </DropdownMenuItem>
          <Separator className="bg-[#E2E4F0]" />
          <DropdownMenuItem onClick={signOut} className="text-xs text-[#D82A50] hover:bg-[#FDECEF] rounded-lg cursor-pointer font-medium">
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserMenu;
