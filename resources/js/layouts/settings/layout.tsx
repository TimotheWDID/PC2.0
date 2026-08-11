import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editPassword } from '@/routes/password';
import { edit } from '@/routes/profile';
import { show } from '@/routes/two-factor';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Bell, KeyRound, Mail, Palette, Shield, Smartphone, UserCircle2, Wrench } from 'lucide-react';
import { type PropsWithChildren } from 'react';

type SettingsNavSection = {
    title: string;
    description: string;
    items: NavItem[];
};

const accountNavItems: NavItem[] = [
    {
        title: 'Profil',
        href: edit(),
        icon: UserCircle2,
    },
    {
        title: 'Mot de passe',
        href: editPassword(),
        icon: KeyRound,
    },
    {
        title: 'Appareils connectes',
        href: '/settings/device-sessions',
        icon: Shield,
    },
    {
        title: 'Authentification 2FA',
        href: show(),
        icon: Shield,
    },
    {
        title: 'Apparence',
        href: editAppearance(),
        icon: Palette,
    },
];

const adminAppNavItems: NavItem[] = [
    {
        title: 'Parametres application',
        href: '/settings/application',
        icon: Wrench,
    },
    {
        title: 'Dashboard et alertes',
        href: '/settings/dashboard-insights',
        icon: Bell,
    },
    {
        title: 'Etiquettes tickets',
        href: '/settings/ticket-label',
        icon: Wrench,
    },
    {
        title: 'Modeles de suivi',
        href: '/settings/ticket-timeline-templates',
        icon: Wrench,
    },
    {
        title: 'Listes d\'actions',
        href: '/settings/ticket-action-lists',
        icon: Wrench,
    },
];

const adminCommunicationNavItems: NavItem[] = [
    {
        title: 'Notif creation ticket',
        href: '/settings/ticket-created-notification',
        icon: Mail,
    },
    {
        title: 'Paramètres SMS',
        href: '/settings/sms',
        icon: Smartphone,
    },
    {
        title: 'Templates SMS',
        href: '/settings/sms/templates',
        icon: Smartphone,
    },
    {
        title: 'Mails entrants',
        href: '/settings/inbound-mail-review',
        icon: Mail,
    },
    {
        title: 'Debug Mail',
        href: '/settings/mail-debug',
        icon: Mail,
    },
    {
        title: 'Debug SMS',
        href: '/settings/sms-debug',
        icon: Smartphone,
    },
];

export default function SettingsLayout({
    children,
    fullWidth = false,
}: PropsWithChildren<{ fullWidth?: boolean }>) {
    const { props } = usePage();
    const authUser = (props as any).auth?.user ?? null;
    const preview = (props as any).preview ?? { canToggle: false };

    // When server-side rendering, we only render the layout on the client...
    if (typeof window === 'undefined') {
        return null;
    }

    const currentPath = window.location.pathname;
    const isAdmin = !!(authUser?.is_admin || authUser?.agent?.is_admin || preview?.canToggle);
    const navSections: SettingsNavSection[] = [
        {
            title: 'Compte',
            description: 'Vos acces personnels et preferences visibles partout dans l\'application.',
            items: accountNavItems,
        },
    ];

    if (isAdmin) {
        navSections.push(
            {
                title: 'Pilotage application',
                description: 'Les reglages globaux qui structurent les workflows et l\'organisation.',
                items: adminAppNavItems,
            },
            {
                title: 'Communication',
                description: 'SMS, mails entrants et ecrans de debug pour les envois.',
                items: adminCommunicationNavItems,
            },
        );
    }

    const isItemActive = (href: NavItem['href']) => {
        const target = typeof href === 'string' ? href : href.url;

        return currentPath === target || currentPath.startsWith(`${target}/`);
    };

    return (
        <div className="px-4 py-6">
            <Heading
                title="Paramètres"
                description={isAdmin
                    ? "Retrouvez vos preferences personnelles et l'ensemble des reglages admin dans une navigation unique."
                    : 'Gerez votre profil et les parametres de votre compte.'}
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl space-y-4 lg:w-72">
                    {navSections.map((section) => (
                        <div key={section.title} className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
                            <div className="mb-3 space-y-1 px-1">
                                <p className="text-sm font-semibold">{section.title}</p>
                                <p className="text-xs text-muted-foreground">{section.description}</p>
                            </div>

                            <nav className="flex flex-col space-y-1">
                                {section.items.map((item, index) => (
                                    <Button
                                        key={`${typeof item.href === 'string' ? item.href : item.href.url}-${index}`}
                                        size="sm"
                                        variant="ghost"
                                        asChild
                                        className={cn('h-auto w-full justify-start px-3 py-2 text-left', {
                                            'bg-muted': isItemActive(item.href),
                                        })}
                                    >
                                        <Link href={item.href} className="flex items-start gap-2">
                                            {item.icon && <item.icon className="mt-0.5 h-4 w-4 shrink-0" />}
                                            <span>{item.title}</span>
                                        </Link>
                                    </Button>
                                ))}
                            </nav>
                        </div>
                    ))}
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className={cn('flex-1', fullWidth ? 'md:max-w-5xl' : 'md:max-w-2xl')}>
                    <section className={cn(fullWidth ? 'space-y-8' : 'max-w-xl space-y-12')}>
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
