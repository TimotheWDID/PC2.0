import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { type NavItem } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, BookOpen, Computer, FilePlus, Folder, HardHat, LayoutGrid, Mail, ShieldCheck, ShoppingCart, User, Wrench } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Accueil',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Dashboard Admin',
        href: '/admin/dashboard',
        icon: ShieldCheck,
    },
    {
        title: 'Notifications',
        href: '/dashboard?severity=notification',
        icon: Bell,
    },
    {
        title: 'Tickets',
        href: '/tickets',
        icon: Folder,
        quickHref: '/tickets/create',
        quickLabel: 'Nouveau ticket',
    },
    {
        title: 'Mails entrants',
        href: '/tickets/inbound-mails',
        icon: Mail,
    },
    {
        title: 'Commandes',
        href: '/commandes',
        icon: ShoppingCart,
        quickHref: '/commandes/create',
        quickLabel: 'Nouvelle commande',
    },
    {
        title: 'Clients',
        href: '/users',
        icon: User,
    },
    {
        title: 'Appareils',
        href: '/devices',
        icon: Computer,
    },
    {
        title: 'Agents',
        href: '/agents',
        icon: HardHat,
    },
    {
        title: 'Interne',
        href: '/internal-tickets',
        icon: BookOpen,
    },
    {
        title: 'Impression',
        href: '/tickets/print-settings',
        icon: Wrench,
    },
    {
        title: 'Parametrage App',
        href: '/app-settings',
        icon: Wrench,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Profil',
        href: '/settings/profile',
        icon: User,
    },
    {
        title: 'Signaler',
        href: '/internal-tickets/create?category=bug',
        icon: BookOpen,
    },
];

const nonAgentNavItems: NavItem[] = [
    {
        title: 'Accueil',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Notifications',
        href: '/dashboard?severity=notification',
        icon: Bell,
    },
    {
        title: 'Tickets',
        href: '/tickets',
        icon: Folder,
    },
    {
        title: '+ Ticket',
        href: '/tickets/create',
        icon: FilePlus,
    },
    {
        title: 'Commandes',
        href: '/commandes',
        icon: ShoppingCart,
    },
    {
        title: 'Profil',
        href: '/settings/profile',
        icon: User,
    },
];

const nonAgentFooterNavItems: NavItem[] = [
    {
        title: 'Signaler',
        href: '/internal-tickets/create?category=bug',
        icon: Wrench,
    },
];

export function AppSidebar() {
    const page = usePage();
    const user = (page.props as any).auth?.user ?? null;
    const preview = (page.props as any).preview ?? { nonAgent: false, canToggle: false, mode: 'admin' };

    // If the authenticated user is not an agent, render an empty sidebar
    // (no navigation items or footer). Keep the logo in the header so the
    // layout remains stable and users can still return to the home route.
    const isAgent = !!user?.agent;
    const isAdmin = !!(user?.is_admin || user?.agent?.is_admin || preview?.canToggle);
    const unreadCount = Number((page.props as any).notifications?.unread_count ?? 0);

    const setPreviewMode = (mode: 'admin' | 'agent' | 'user') => {
        if (!preview.canToggle || preview.mode === mode) {
            return;
        }

        router.post('/settings/preview/mode', { mode }, { preserveScroll: true });
    };

    const previewControls = preview.canToggle ? (
        <div className="mb-2 rounded-md border border-border/70 p-2 group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:p-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:sr-only">Aperçu admin</p>
            <div className="grid grid-cols-3 gap-1 group-data-[collapsible=icon]:grid-cols-1">
                <Button
                    variant={preview.mode === 'admin' ? 'default' : 'outline'}
                    size="sm"
                    className="justify-center px-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                    onClick={() => setPreviewMode('admin')}
                    title="Vue admin"
                    aria-label="Vue admin"
                >
                    <ShieldCheck className="h-4 w-4" />
                    <span className="sr-only">Vue admin</span>
                </Button>
                <Button
                    variant={preview.mode === 'agent' ? 'default' : 'outline'}
                    size="sm"
                    className="justify-center px-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                    onClick={() => setPreviewMode('agent')}
                    title="Vue agent (non admin)"
                    aria-label="Vue agent (non admin)"
                >
                    <HardHat className="h-4 w-4" />
                    <span className="sr-only">Vue agent (non admin)</span>
                </Button>
                <Button
                    variant={preview.mode === 'user' ? 'default' : 'outline'}
                    size="sm"
                    className="justify-center px-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                    onClick={() => setPreviewMode('user')}
                    title="Vue utilisateur (non agent)"
                    aria-label="Vue utilisateur (non agent)"
                >
                    <User className="h-4 w-4" />
                    <span className="sr-only">Vue utilisateur (non agent)</span>
                </Button>
            </div>
        </div>
    ) : null;

    const adminOnlyPrefixes = ['/admin', '/agents', '/tickets/print-settings', '/settings/ticket-label', '/settings/ticket-timeline-templates', '/settings/dashboard-insights', '/settings/sms', '/app-settings'];

    const isAdminOnlyPath = (path: string) => adminOnlyPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

    const toPath = (href: NavItem['href']) => (typeof href === 'string' ? href : href.url);

    const visibleMainNavItems = isAdmin
        ? mainNavItems
        : mainNavItems
              .filter((item) => !isAdminOnlyPath(toPath(item.href)))
              .map((item) => {
                  if (!item.quickHref) {
                      return item;
                  }

                  const quickPath = typeof item.quickHref === 'string' ? item.quickHref : item.quickHref.url;

                  if (isAdminOnlyPath(quickPath)) {
                      return {
                          ...item,
                          quickHref: undefined,
                          quickLabel: undefined,
                      };
                  }

                  return item;
              });

    const withNotificationBadge = (items: NavItem[]) =>
        items.map((item) =>
            item.title === 'Notifications'
                ? {
                      ...item,
                      badgeCount: unreadCount,
                  }
                : item,
        );

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            {isAgent ? (
                <>
                    <SidebarContent>
                        <NavMain items={withNotificationBadge(visibleMainNavItems)} />
                    </SidebarContent>

                    <SidebarFooter>
                        {previewControls}
                        <NavFooter items={footerNavItems} className="mt-auto" />
                        <NavUser />
                    </SidebarFooter>
                </>
            ) : (
                // Dedicated navigation for non-agent users.
                <>
                    <SidebarContent>
                        <NavMain items={withNotificationBadge(nonAgentNavItems)} />
                    </SidebarContent>
                    <SidebarFooter>
                        {previewControls}
                        <NavFooter items={nonAgentFooterNavItems} className="mt-auto" />
                        <NavUser />
                    </SidebarFooter>
                </>
            )}
        </Sidebar>
    );
}
