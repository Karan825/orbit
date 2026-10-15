'use client';

import {
  Activity as OverviewIcon,
  Server as ServerIcon,
  MessageSquare as ChatIcon,
  Key as KeyIcon,
  FileText as AuditIcon,
  Users as TeamIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { ILink } from './components/navlinks';
import { SideNavbar } from './components/side-navbar';
import { TopNavbar } from './components/top-navbar';
import { useAuth } from '@/app/providers/auth-provider';

export type NavItemVariant = 'default' | 'ghost';

const getIconStyles = (variant: NavItemVariant) => {
  return `h-4 w-4 flex-shrink-0 ${variant === 'default' ? 'stroke-white' : 'stroke-primary'}`;
};

interface NavLinkConfig {
  title: string;
  href: string;
  IconComponent: React.FC<any>;
  badge?: string;
  adminOnly?: boolean;
}

const dataLinksConfig: NavLinkConfig[] = [
  { title: 'Overview', href: '/overview', IconComponent: OverviewIcon },
  { title: 'Servers', href: '/servers', IconComponent: ServerIcon },
  { title: 'Chat Agent', href: '/chat', IconComponent: ChatIcon },
  { title: 'API Keys', href: '/api-keys', IconComponent: KeyIcon },
  { title: 'Audit Log', href: '/audit', IconComponent: AuditIcon, adminOnly: true },
  { title: 'Team', href: '/team', IconComponent: TeamIcon, adminOnly: true },
];

export function NavbarClientComponent(props: { mobile: boolean }) {
  const pathname = usePathname();
  const { isMember } = useAuth();

  const dataLinks: ILink[] = useMemo(() => {
    const visibleConfigs = isMember
      ? dataLinksConfig.filter((c) => !c.adminOnly)
      : dataLinksConfig;

    return visibleConfigs.map((config) => {
      const isActive =
        pathname === config.href ||
        (config.href !== '/overview' && pathname?.startsWith(config.href));
      const variant = isActive ? 'default' : 'ghost';
      return {
        title: config.title,
        href: config.href,
        icon: <config.IconComponent className={getIconStyles(variant)} />,
        variant,
        badge: config.badge,
      };
    });
  }, [pathname, isMember]);

  if (props.mobile) {
    return <TopNavbar dataLinks={dataLinks} />;
  }

  return <SideNavbar dataLinks={dataLinks} />;
}

export const NavbarClient = NavbarClientComponent;
export default NavbarClientComponent;