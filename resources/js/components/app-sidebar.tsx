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
import { BookOpen, Computer, Eye, EyeOff, FilePlus, Folder, HardHat, LayoutGrid, ShoppingCart, User, Wrench } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Accueil',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Tickets',
        href: '/tickets',
        icon: Folder,
        quickHref: '/tickets/create',
        quickLabel: 'Nouveau ticket',
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
        title: 'Bugs',
        href: '/tickets/bugs-improvements',
        icon: BookOpen,
    },
    {
        title: 'Impression',
        href: '/tickets/print-settings',
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
        href: '/tickets/bugs-improvements/create?ticket_kind=bug',
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
        href: '/tickets/bugs-improvements/create?ticket_kind=bug',
        icon: Wrench,
    },
];

export function AppSidebar() {
    const page = usePage();
    const user = (page.props as any).auth?.user ?? null;
    const preview = (page.props as any).preview ?? { nonAgent: false, canToggle: false };

    // If the authenticated user is not an agent, render an empty sidebar
    // (no navigation items or footer). Keep the logo in the header so the
    // layout remains stable and users can still return to the home route.
    const isAgent = !!user?.agent;

    const togglePreviewMode = () => {
        router.post('/settings/preview/non-agent/toggle', {}, { preserveScroll: true });
    };

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
                        <NavMain items={mainNavItems} />
                    </SidebarContent>

                    <SidebarFooter>
                        {preview.canToggle && (
                            <Button
                                variant={preview.nonAgent ? 'default' : 'outline'}
                                size="sm"
                                className="mb-2 w-full justify-start"
                                onClick={togglePreviewMode}
                            >
                                {preview.nonAgent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                {preview.nonAgent ? 'Quitter l’aperçu' : 'Aperçu'}
                            </Button>
                        )}
                        <NavFooter items={footerNavItems} className="mt-auto" />
                        <NavUser />
                    </SidebarFooter>
                </>
            ) : (
                // Dedicated navigation for non-agent users.
                <>
                    <SidebarContent>
                        <NavMain items={nonAgentNavItems} />
                    </SidebarContent>
                    <SidebarFooter>
                        {preview.canToggle && (
                            <Button
                                variant={preview.nonAgent ? 'default' : 'outline'}
                                size="sm"
                                className="mb-2 w-full justify-start"
                                onClick={togglePreviewMode}
                            >
                                {preview.nonAgent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                {preview.nonAgent ? 'Quitter l’aperçu' : 'Aperçu'}
                            </Button>
                        )}
                        <NavFooter items={nonAgentFooterNavItems} className="mt-auto" />
                        <NavUser />
                    </SidebarFooter>
                </>
            )}
        </Sidebar>
    );
}
