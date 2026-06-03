import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDateTimeFr } from '@/lib/datetime';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, BellRing, Clock3, Home, ListFilter, Plus, Search, Settings, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';

type DashboardMode = 'agent' | 'user';
type Severity = 'all' | 'critical' | 'warning' | 'info';

type Summary = {
    total?: number;
    open?: number;
    pending?: number;
    in_progress?: number;
    closed?: number;
    high_priority?: number;
    attention_count?: number;
};

type TicketItem = {
    id: number;
    title?: string | null;
    status?: string | null;
    priority?: string | null;
    requester_name?: string | null;
    messages_count?: number | null;
    updated_at?: string | null;
};

type QuickAction = {
    label: string;
    href: string;
    description: string;
};

type ActionItem = {
    id: string;
    kind: 'ticket' | 'commande';
    severity: 'critical' | 'warning' | 'info';
    title: string;
    reason: string;
    action_label: string;
    href: string;
    age_label?: string | null;
    tags?: string[];
    ticket?: TicketItem | null;
    commande?: {
        id: number;
        nom?: string | null;
        statut?: string | null;
        fournisseur?: string | null;
        command_number?: string | null;
        ticket_id?: number | null;
        ticket_title?: string | null;
        updated_at?: string | null;
    } | null;
};

type DashboardProps = {
    mode?: DashboardMode;
    summary?: Summary;
    actionItems?: ActionItem[];
    assignedTickets?: TicketItem[];
    recentTickets?: TicketItem[];
    quickActions?: QuickAction[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

const statusLabel = (status?: string | null): string => {
    const map: Record<string, string> = {
        open: 'Ouvert',
        in_progress: 'En cours',
        pending: 'En attente',
        resolved: 'Résolu',
        closed: 'Fermé',
    };

    if (!status) return 'N/A';
    return map[status] ?? status;
};

const severityLabel = (severity: Severity): string => {
    if (severity === 'critical') return 'Critique';
    if (severity === 'warning') return 'Attention';
    if (severity === 'info') return 'Info';
    return 'Toutes';
};

const severityBadgeVariant = (severity: Severity) => {
    if (severity === 'critical') return 'destructive';
    if (severity === 'warning') return 'secondary';
    return 'outline';
};

type DashboardTab = 'recommended' | 'assigned';

const tabLabel: Record<DashboardTab, string> = {
    recommended: 'Actions recommandées',
    assigned: 'Tickets attitrés',
};

const assignedTabLabel = (count: number) => `Tickets attitrés (${count})`;

const tabButtonClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
        active ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:text-foreground'
    }`;

const sectionTitleClass = 'relative pl-3 text-sm font-semibold tracking-tight before:absolute before:left-0 before:top-1 before:h-4 before:w-1 before:rounded-full before:bg-primary/60';

export default function Dashboard({ mode, summary, actionItems, assignedTickets, recentTickets, quickActions }: DashboardProps) {
    const page = usePage();
    const user = (page.props as any).auth?.user ?? null;
    const isAgent = mode ? mode === 'agent' : !!user?.agent;
    const currentPath = (page.url ?? '/').split('?')[0] || '/';

    const stats = summary ?? {};
    const actions = quickActions ?? [];
    const allActionItems = actionItems ?? [];
    const assigned = assignedTickets ?? [];
    const recent = recentTickets ?? [];
    const assignedCount = assigned.length;

    const [query, setQuery] = useState('');
    const [severity, setSeverity] = useState<Severity>('all');
    const [activeTab, setActiveTab] = useState<DashboardTab>('recommended');

    const filteredActionItems = useMemo(() => {
        const q = query.trim().toLowerCase();

        return allActionItems.filter((item) => {
            if (severity !== 'all' && item.severity !== severity) {
                return false;
            }

            if (!q) {
                return true;
            }

            const haystack = [
                item.title,
                item.reason,
                item.ticket?.id?.toString() ?? '',
                item.ticket?.title ?? '',
                item.commande?.id?.toString() ?? '',
                item.commande?.nom ?? '',
                ...(item.tags ?? []),
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [allActionItems, query, severity]);

    const filteredAssignedTickets = useMemo(() => {
        const q = query.trim().toLowerCase();

        return assigned.filter((ticket) => {
            if (!q) {
                return true;
            }

            const haystack = [
                ticket.id?.toString() ?? '',
                ticket.title ?? '',
                ticket.status ?? '',
                ticket.priority ?? '',
                ticket.requester_name ?? '',
                ticket.updated_at ?? '',
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [assigned, query]);

    const metricCards = isAgent
        ? [
              { label: 'Actions à traiter', value: stats.attention_count ?? 0 },
              { label: 'Ouverts', value: stats.open ?? 0 },
              { label: 'En attente', value: stats.pending ?? 0 },
              { label: 'En cours', value: stats.in_progress ?? 0 },
          ]
        : [
              { label: 'Actions à traiter', value: stats.attention_count ?? 0 },
              { label: 'Mes tickets', value: stats.total ?? 0 },
              { label: 'Ouverts', value: stats.open ?? 0 },
              { label: 'En attente', value: stats.pending ?? 0 },
          ];

    const isMobileNavActive = (path: string) => {
        if (path === '/dashboard') return currentPath === '/dashboard';
        return currentPath === path || currentPath.startsWith(`${path}/`);
    };

    const mobileNavItemClass = (active: boolean) =>
        `flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] transition-all duration-200 active:scale-95 ${
            active ? 'bg-muted/60 font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/40'
        }`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tableau de bord" />

            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-2 py-2 pb-24 sm:gap-5 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:max-w-none lg:gap-4 lg:px-8 lg:pb-6 xl:px-10">
                <div className="lg:hidden">
                    <section className="space-y-3 rounded-2xl border border-border bg-gradient-to-br from-background to-muted/30 p-3">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{isAgent ? 'Vue technicien' : 'Vue client'}</Badge>
                                <Badge variant="outline">Version mobile</Badge>
                            </div>
                            <h1 className="text-xl font-semibold tracking-tight">{isAgent ? 'Pilotage des tickets' : 'Mes actions de support'}</h1>
                            <p className="text-xs text-muted-foreground">Priorités, relances et actions rapides en un coup d'oeil.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button asChild size="sm" className="col-span-2 h-11 w-full justify-center px-3 text-sm font-semibold shadow-sm">
                                <Link href="/tickets/create">
                                    <Plus className="h-4 w-4" />
                                    Nouveau ticket
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-10 w-full justify-start px-3">
                                <Link href="/tickets">
                                    <ListFilter className="h-4 w-4" />
                                    Tickets
                                </Link>
                            </Button>
                            {isAgent && (
                                <Button asChild variant="secondary" size="sm" className="h-10 w-full justify-start px-3">
                                    <Link href="/commandes">
                                        <Wrench className="h-4 w-4" />
                                        Commandes liées
                                    </Link>
                                </Button>
                            )}
                            {!isAgent && <div className="h-10" aria-hidden="true" />}
                        </div>

                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                            {metricCards.map((card) => (
                                <div key={card.label} className="min-w-[130px] rounded-xl border border-border bg-background px-3 py-2">
                                    <div className="text-[11px] text-muted-foreground">{card.label}</div>
                                    <div className="mt-0.5 text-lg font-semibold leading-none">{card.value}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="mt-3 space-y-3">
                        <Card className="border-border/70 bg-background">
                            <CardHeader className="space-y-3 border-b border-border/60 p-3 pb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-sm">
                                        {activeTab === 'assigned' ? assignedTabLabel(assignedCount) : tabLabel[activeTab]}
                                    </CardTitle>
                                    {isAgent && (
                                        <div className="ml-auto grid w-full max-w-[240px] grid-cols-2 gap-1 rounded-2xl border border-border/70 p-1">
                                            <button type="button" onClick={() => setActiveTab('recommended')} className={tabButtonClass(activeTab === 'recommended')}>
                                                A. recommandées
                                            </button>
                                            <button type="button" onClick={() => setActiveTab('assigned')} className={tabButtonClass(activeTab === 'assigned')}>
                                                Tickets
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {activeTab === 'recommended' ? (
                                        <>
                                            <div className="relative">
                                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    value={query}
                                                    onChange={(event) => setQuery(event.target.value)}
                                                    placeholder="Rechercher"
                                                    className="h-9 pl-9 text-sm"
                                                />
                                            </div>
                                            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                                                {(['all', 'critical', 'warning', 'info'] as Severity[]).map((value) => (
                                                    <Button
                                                        key={value}
                                                        type="button"
                                                        variant={severity === value ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setSeverity(value)}
                                                        className="h-8 shrink-0 px-3"
                                                    >
                                                        {severityLabel(value)}
                                                    </Button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={query}
                                                onChange={(event) => setQuery(event.target.value)}
                                                placeholder="Rechercher un ticket attitré"
                                                className="h-9 pl-9 text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 p-3 pt-1">
                                {activeTab === 'recommended' ? (
                                    filteredActionItems.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                                            Aucune action ne correspond au filtre actuel.
                                        </div>
                                    ) : (
                                        filteredActionItems.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                className="block rounded-lg border border-border p-3 transition-all duration-200 hover:bg-muted/40 active:scale-[0.99]"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] text-muted-foreground">
                                                            {item.kind === 'ticket' ? `Ticket n°${item.ticket?.id ?? '-'}` : `Commande n°${item.commande?.id ?? '-'}`}
                                                        </div>
                                                        <div className="break-words text-sm font-medium leading-snug">{item.title}</div>
                                                    </div>
                                                    <Badge className="shrink-0" variant={severityBadgeVariant(item.severity)}>
                                                        {severityLabel(item.severity)}
                                                    </Badge>
                                                </div>

                                                <p className="mt-1.5 break-words text-xs text-muted-foreground">{item.reason}</p>

                                                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                                    {item.age_label && (
                                                        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                                                            <Clock3 className="h-3 w-3" />
                                                            {item.age_label}
                                                        </span>
                                                    )}
                                                    {(item.tags ?? []).slice(0, 2).map((tag) => (
                                                        <span key={`${item.id}-${tag}`} className="inline-flex rounded-md border border-border px-2 py-1">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="mt-2 flex items-center justify-end text-xs font-medium">
                                                    {item.action_label}
                                                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                                </div>
                                            </Link>
                                        ))
                                    )
                                ) : filteredAssignedTickets.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                                        Aucun ticket attitré ne correspond à la recherche actuelle.
                                    </div>
                                ) : (
                                    filteredAssignedTickets.map((ticket) => (
                                        <Link
                                            key={ticket.id}
                                            href={`/tickets/${ticket.id}`}
                                            className="block rounded-lg border border-border p-3 transition-all duration-200 hover:bg-muted/40 active:scale-[0.99]"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-[11px] text-muted-foreground">{ticket.requester_name ?? 'Demandeur inconnu'}</div>
                                                    <div className="break-words text-sm font-medium leading-snug">Ticket n°{ticket.id} · {ticket.title ?? 'Sans titre'}</div>
                                                </div>
                                                <Badge className="shrink-0" variant="outline">
                                                    {statusLabel(ticket.status)}
                                                </Badge>
                                            </div>

                                            <p className="mt-1.5 break-words text-xs text-muted-foreground">
                                                {ticket.priority ? `Priorité ${ticket.priority}` : 'Priorité non précisée'}
                                                {ticket.updated_at ? ` · Mis à jour le ${formatDateTimeFr(ticket.updated_at, { timeZone: 'Europe/Paris' })}` : ''}
                                            </p>
                                        </Link>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 bg-background max-[389px]:hidden">
                            <CardHeader className="border-b border-border/60 p-3 pb-3">
                                <CardTitle className="text-sm">Derniers tickets</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1.5 p-3 pt-1">
                                {recent.length === 0 ? (
                                    <div className="text-xs text-muted-foreground">Aucun ticket récent à afficher.</div>
                                ) : (
                                    recent.slice(0, 4).map((ticket) => (
                                        <Link
                                            key={ticket.id}
                                            href={`/tickets/${ticket.id}`}
                                            className="block rounded-lg border border-border p-2.5 transition-all duration-200 hover:bg-muted/40 active:scale-[0.99]"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium">Ticket n°{ticket.id} · {ticket.title ?? 'Sans titre'}</div>
                                                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                                                        {statusLabel(ticket.status)} · {formatDateTimeFr(ticket.updated_at, { timeZone: 'Europe/Paris' })}
                                                    </div>
                                                </div>
                                                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <Button asChild className="fixed bottom-20 right-4 z-40 h-12 rounded-full px-4 shadow-lg transition-transform duration-200 active:scale-95">
                        <Link href="/tickets/create">
                            <Plus className="h-4 w-4" />
                            Nouveau ticket
                        </Link>
                    </Button>

                    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                        <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2">
                            <Link href="/dashboard" className={mobileNavItemClass(isMobileNavActive('/dashboard'))}>
                                <Home className="h-4 w-4" />
                                Accueil
                            </Link>
                            <Link href="/tickets" className={mobileNavItemClass(isMobileNavActive('/tickets'))}>
                                <ListFilter className="h-4 w-4" />
                                Tickets
                            </Link>
                            <Link
                                href={isAgent ? '/commandes' : '/tickets/create'}
                                className={mobileNavItemClass(isMobileNavActive(isAgent ? '/commandes' : '/tickets/create'))}
                            >
                                {isAgent ? <Wrench className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {isAgent ? 'Commandes' : 'Créer'}
                            </Link>
                            <Link href="/settings/profile" className={mobileNavItemClass(isMobileNavActive('/settings'))}>
                                <Settings className="h-4 w-4" />
                                Réglages
                            </Link>
                        </div>
                    </nav>
                </div>

                <div className="hidden space-y-4 lg:block">
                    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-background via-muted/40 to-background p-8 shadow-sm xl:p-10">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,0,0,0.06),transparent_30%)]" />
                        <div className="relative flex items-end justify-between gap-8">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">{isAgent ? 'Vue desktop technicien' : 'Vue desktop client'}</Badge>
                                    <Badge variant="outline">Aide à la décision</Badge>
                                </div>
                                <h1 className="text-4xl font-semibold tracking-tight">{isAgent ? 'Pilotage des tickets' : 'Mon espace support'}</h1>
                                <p className="max-w-3xl text-sm text-muted-foreground">
                                    Vue complète pour ordinateur: suivi global, actions prioritaires et contexte détaillé.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                                    <span className="rounded-md border border-border bg-background/70 px-2 py-1">{stats.attention_count ?? 0} action(s) prioritaires détectée(s)</span>
                                    <span className="rounded-md border border-border bg-background/70 px-2 py-1">{stats.open ?? 0} ticket(s) ouverts</span>
                                    <span className="rounded-md border border-border bg-background/70 px-2 py-1">{stats.pending ?? 0} ticket(s) en attente</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button asChild size="lg">
                                    <Link href="/tickets/create">
                                        <Plus className="h-4 w-4" />
                                        Nouveau ticket
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" size="lg">
                                    <Link href="/tickets">
                                        <ListFilter className="h-4 w-4" />
                                        Consulter tous les tickets
                                    </Link>
                                </Button>
                                {isAgent && (
                                    <Button asChild variant="secondary" size="lg">
                                        <Link href="/commandes">
                                            <Wrench className="h-4 w-4" />
                                            Consulter les commandes
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="mt-4 grid gap-4 xl:grid-cols-4">
                        {metricCards.map((card) => (
                            <Card key={card.label} className="border-border/70 bg-background">
                                <CardContent className="p-4">
                                    <div className="text-xs text-muted-foreground">{card.label}</div>
                                    <div className="mt-1 text-3xl font-semibold">{card.value}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </section>
                </div>

                <section className="hidden gap-4 lg:grid xl:grid-cols-3">
                    <Card className="border-border/70 bg-background xl:col-span-2">
                        <CardHeader className="space-y-3 p-4 pb-2">
                            <div className="flex items-start justify-between gap-4">
                                <CardTitle className={sectionTitleClass}>
                                        {isAgent && activeTab === 'assigned' ? assignedTabLabel(assignedCount) : 'Actions recommandées'}
                                </CardTitle>
                                {isAgent && (
                                    <div className="inline-flex shrink-0 rounded-lg border border-border/70 p-1 text-sm">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('recommended')}
                                            className={`rounded-md px-4 py-1.5 transition-all duration-200 ${
                                                activeTab === 'recommended' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            Actions recommandées
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('assigned')}
                                            className={`rounded-md px-4 py-1.5 transition-all duration-200 ${
                                                activeTab === 'assigned' ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                                    {assignedTabLabel(assignedCount)}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {activeTab === 'recommended' ? (
                                    <>
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={query}
                                                onChange={(event) => setQuery(event.target.value)}
                                                placeholder="Rechercher un ticket, une commande ou un mot-clé"
                                                className="pl-9"
                                            />
                                        </div>
                                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                                            {(['all', 'critical', 'warning', 'info'] as Severity[]).map((value) => (
                                                <Button
                                                    key={value}
                                                    type="button"
                                                    variant={severity === value ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setSeverity(value)}
                                                    className="h-9 shrink-0"
                                                >
                                                    {severityLabel(value)}
                                                </Button>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="relative sm:col-span-2">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder="Rechercher un ticket attitré"
                                            className="pl-9"
                                        />
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {activeTab === 'recommended' ? (
                                filteredActionItems.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                                        Aucune action ne correspond à votre recherche ou à ce filtre.
                                    </div>
                                ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {filteredActionItems.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted/40 active:scale-[0.99]"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="text-xs text-muted-foreground">
                                                            {item.kind === 'ticket' ? `Ticket n°${item.ticket?.id ?? '-'}` : `Commande n°${item.commande?.id ?? '-'}`}
                                                        </div>
                                                        <div className="break-words font-medium leading-tight">{item.title}</div>
                                                    </div>
                                                    <Badge className="shrink-0" variant={severityBadgeVariant(item.severity)}>{severityLabel(item.severity)}</Badge>
                                                </div>

                                                <p className="mt-2 break-words text-sm text-muted-foreground">{item.reason}</p>

                                                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                    {item.age_label && (
                                                        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                                                            <Clock3 className="h-3 w-3" />
                                                            {item.age_label}
                                                        </span>
                                                    )}
                                                    {(item.tags ?? []).slice(0, 3).map((tag) => (
                                                        <span key={`${item.id}-${tag}`} className="inline-flex rounded-md border border-border px-2 py-1">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>

                                                {item.ticket && (
                                                    <div className="mt-3 text-xs text-muted-foreground">
                                                        Statut: {statusLabel(item.ticket.status)} · {item.ticket.messages_count ?? 0} message(s)
                                                    </div>
                                                )}

                                                {item.commande && (
                                                    <div className="mt-3 break-words text-xs text-muted-foreground">
                                                        {item.commande.ticket_title ?? `Ticket n°${item.commande.ticket_id ?? '-'}`} · statut commande: {item.commande.statut ?? 'N/A'}
                                                    </div>
                                                )}

                                                <div className="mt-3 flex items-center justify-end text-sm font-medium">
                                                    {item.action_label}
                                                    <ArrowRight className="ml-1 h-4 w-4" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )
                            ) : filteredAssignedTickets.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                                    Aucun ticket attitré ne correspond à votre recherche.
                                </div>
                            ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {filteredAssignedTickets.map((ticket) => (
                                        <Link
                                            key={ticket.id}
                                            href={`/tickets/${ticket.id}`}
                                            className="block rounded-xl border border-border p-4 transition-colors hover:bg-muted/40 active:scale-[0.99]"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 space-y-1">
                                                    <div className="text-xs text-muted-foreground">{ticket.requester_name ?? 'Demandeur inconnu'}</div>
                                                    <div className="break-words font-medium leading-tight">Ticket n°{ticket.id} · {ticket.title ?? 'Sans titre'}</div>
                                                </div>
                                                <Badge className="shrink-0" variant="outline">{statusLabel(ticket.status)}</Badge>
                                            </div>

                                            <p className="mt-2 break-words text-sm text-muted-foreground">
                                                {ticket.priority ? `Priorité ${ticket.priority}` : 'Priorité non précisée'}
                                                {ticket.updated_at ? ` · Mis à jour le ${formatDateTimeFr(ticket.updated_at, { timeZone: 'Europe/Paris' })}` : ''}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card className="border-border/70 bg-background">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className={sectionTitleClass}>Actions rapides</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {actions.map((action) => (
                                    <Link key={action.label} href={action.href} className="block rounded-lg border border-border p-3 hover:bg-muted/40">
                                        <div className="text-sm font-medium">{action.label}</div>
                                        <div className="text-xs text-muted-foreground">{action.description}</div>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="border-border/70 bg-background">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className={sectionTitleClass}>Derniers tickets mis à jour</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {recent.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Aucun ticket récent à afficher.</div>
                                ) : (
                                    recent.slice(0, 5).map((ticket) => (
                                        <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block rounded-lg border border-border p-3 hover:bg-muted/40">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium">Ticket n°{ticket.id} · {ticket.title ?? 'Sans titre'}</div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        {statusLabel(ticket.status)} · Mis à jour le {formatDateTimeFr(ticket.updated_at, { timeZone: 'Europe/Paris' })}
                                                    </div>
                                                </div>
                                                <BellRing className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}
