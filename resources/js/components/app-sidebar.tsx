import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
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
import { Link, usePage } from '@inertiajs/react';
import { BookOpen, Folder, LayoutGrid, ShoppingCart, Wrench } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Tickets',
        href: '/tickets',
        icon: Folder,
        items: [
            {
                title: 'Ouverts',
                href: '/tickets?status=open',
                icon: null,
            },
            {
                title: 'En cours',
                href: '/tickets?status=in_progress',
                icon: null,
            },
            {
                title: 'En attente',
                href: '/tickets?status=pending',
                icon: null,
            },
            {
                title: 'Résolus',
                href: '/tickets?status=resolved',
                icon: null,
            },
            {
                title: 'Fermés',
                href: '/tickets?status=closed',
                icon: null,
            },
            {
                title: 'Imprimante tickets',
                href: '/tickets/print-settings',
                icon: null,
            },
        ],
    },
    {
        title: 'Commandes',
        href: '/commandes',
        icon: ShoppingCart,
        items: [
            {
                title: 'Toutes les commandes',
                href: '/commandes',
                icon: null,
            },
            {
                title: 'Nouveaux',
                href: '/commandes?statut=new',
                icon: null,
            },
            {
                title: 'Panier',
                href: '/commandes?statut=panier',
                icon: null,
            },
            {
                title: 'Commandés',
                href: '/commandes?statut=commandé',
                icon: null,
            },
            {
                title: 'Réceptionnés',
                href: '/commandes?statut=réceptionner',
                icon: null,
            },
            {
                title: 'Traités',
                href: '/commandes?statut=traité',
                icon: null,
            },
        ],
    },
    {
        title: 'Users',
        href: '/users',
        icon: Folder,
    },
    {
        title: 'Bug et amélioration',
        href: '/tickets/bugs-improvements',
        icon: BookOpen,
        items: [
            {
                title: 'Tous les tickets spéciaux',
                href: '/tickets/bugs-improvements',
                icon: null,
            },
            {
                title: 'Signaler bug / amélioration',
                href: '/tickets/bugs-improvements/create?ticket_kind=bug',
                icon: null,
            },
        ],
    },
    {
        title: 'Agents',
        href: '/agents',
        icon: Folder,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Signaler bug / amélioration',
        href: '/tickets/bugs-improvements/create?ticket_kind=bug',
        icon: Wrench,
    },
    {
        title: 'Statistiques',
        href: '#',
        icon: Folder,
    },
    {
        title: 'Rapports',
        href: '#',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    const page = usePage();
    const user = (page.props as any).auth?.user ?? null;

    // If the authenticated user is not an agent, render an empty sidebar
    // (no navigation items or footer). Keep the logo in the header so the
    // layout remains stable and users can still return to the home route.
    const isAgent = !!user?.agent;

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
                        {/* Add main nav items and conditionally the "Nouveau ticket" link when authenticated */}
                        {(() => {
                            const isAuth = !!user;
                            const items = [...mainNavItems];
                            if (isAuth) {
                                items.push({ title: 'Nouveau ticket', href: '/tickets/create', icon: BookOpen });
                                items.push({ title: 'Nouvelle commande', href: '/commandes/create', icon: ShoppingCart });
                                items.push({ title: 'Commande groupée', href: '/commandes/create-bulk', icon: ShoppingCart });
                            }
                            return <NavMain items={items} />;
                        })()}
                    </SidebarContent>

                    <SidebarFooter>
                        <NavFooter items={footerNavItems} className="mt-auto" />
                        <NavUser />
                    </SidebarFooter>
                </>
            ) : (
                // Empty main content for non-agent users, but keep the footer
                // (settings / logout / user menu) so they can manage their account.
                <>
                    <SidebarContent />
                    <SidebarFooter>
                        <NavFooter items={footerNavItems} className="mt-auto" />
                        <NavUser />
                    </SidebarFooter>
                </>
            )}
        </Sidebar>
    );
}
