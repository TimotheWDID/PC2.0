import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTimeFr } from '@/lib/datetime';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from 'chart.js';
import {
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    ArrowUp,
    BarChart3,
    CheckCircle2,
    ChevronDown,
    Clock,
    ExternalLink,
    Inbox,
    ShieldAlert,
    ShoppingCart,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

// ─── Types ────────────────────────────────────────────────────────────────────

type GlobalStats = {
    total: number;
    open: number;
    in_progress: number;
    pending: number;
    resolved: number;
    closed: number;
    unassigned: number;
    high_priority: number;
    today: number;
    this_week: number;
    this_month: number;
};

type AgentStat = {
    id: number;
    user_id: number;
    name: string | null;
    email: string | null;
    is_admin: boolean;
    specialities: string[];
    assigned_total: number;
    assigned_open: number;
    assigned_pending: number;
    assigned_in_prog: number;
    resolved_month: number;
    resolved_total: number;
    high_priority: number;
    stalled_count: number;
    pending_too_long: number;
    alert_count: number;
    last_activity: string | null;
    last_activity_label: string;
};

type TicketAlert = {
    id: number;
    title: string | null;
    status: string | null;
    priority: string | null;
    category: string | null;
    requester_name: string | null;
    assignee_name?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
    age_label?: string;
    stalled_since?: string;
    pending_since?: string;
};

type CommandeAlert = {
    id: number;
    nom: string | null;
    statut: string | null;
    fournisseur: string | null;
    ticket_id: number | null;
    ticket_title: string | null;
    updated_at: string | null;
    stalled_since: string;
};

type DayEntry = {
    date: string;
    label: string;
    open: number;
    in_progress: number;
    pending: number;
    resolved: number;
    closed: number;
    created: number;
};

type CommandeStats = {
    total: number;
    new: number;
    panier: number;
    ordered: number;
    received: number;
};

type AgentOption = {
    id: number;
    name: string;
};

type AdminDashboardProps = {
    globalStats: GlobalStats;
    agentStats: AgentStat[];
    unassignedTickets: TicketAlert[];
    stalledTickets: TicketAlert[];
    pendingTooLongTickets: TicketAlert[];
    recentTickets: (TicketAlert & { messages_count: number })[];
    ticketsByDay: DayEntry[];
    commandeStats: CommandeStats;
    stalledCommandes: CommandeAlert[];
    totalAlerts: number;
    agentOptions: AgentOption[];
    filters: {
        date: string | null;
        start_date: string | null;
        end_date: string | null;
        agent_id?: number | null;
        has_filter: boolean;
        label: string | null;
    };
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard Admin', href: '/admin/dashboard' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusLabel = (s?: string | null) =>
    ({ open: 'Ouvert', in_progress: 'En cours', pending: 'En attente', resolved: 'Résolu', closed: 'Fermé' }[s ?? ''] ?? s ?? 'N/A');

const statusBadge = (s?: string | null) => {
    if (s === 'open') return 'border-transparent bg-primary text-primary-foreground';
    if (s === 'in_progress') return 'border-transparent bg-secondary text-secondary-foreground';
    if (s === 'pending') return 'border-border bg-muted text-foreground';
    if (s === 'resolved') return 'border-transparent bg-accent text-accent-foreground';
    return 'border-border bg-background text-muted-foreground';
};

const priorityLabel = (p?: string | null) =>
    ({ high: 'Haute', medium: 'Moyenne', low: 'Basse' }[p ?? ''] ?? 'N/A');

const priorityBadge = (p?: string | null) => {
    if (p === 'high') return 'bg-destructive/15 text-destructive border-destructive/30';
    if (p === 'medium') return 'bg-secondary text-secondary-foreground';
    return 'bg-muted text-muted-foreground';
};

const commandeStatutLabel = (s?: string | null) =>
    ({ new: 'Nouveau', panier: 'Panier', ordered: 'Commandé', received: 'Reçu' }[s ?? ''] ?? s ?? 'N/A');

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, highlight }: {
    label: string;
    value: number | string;
    sub?: string;
    icon: React.ElementType;
    highlight?: 'danger' | 'warning' | 'success' | 'info';
}) {
    const colorMap = {
        danger: 'text-destructive',
        warning: 'text-amber-500',
        success: 'text-emerald-500',
        info: 'text-primary',
    };
    const textColor = highlight ? colorMap[highlight] : 'text-foreground';

    return (
        <Card className="flex-1 min-w-[140px]">
            <CardContent className="flex items-center gap-3 pt-5 pb-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className={`h-5 w-5 ${highlight ? colorMap[highlight] : 'text-muted-foreground'}`} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{label}</p>
                    <p className={`text-2xl font-bold leading-none mt-0.5 ${textColor}`}>{value}</p>
                    {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

function AlertBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {count}
        </span>
    );
}

function TicketRow({ ticket, extraCol }: { ticket: TicketAlert; extraCol?: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors">
            <span className="font-mono text-xs text-muted-foreground w-10 shrink-0 pt-0.5">#{ticket.id}</span>
            <div className="flex-1 min-w-0">
                <p className="font-medium truncate leading-snug">{ticket.title ?? 'Sans titre'}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ticket.requester_name ?? 'Demandeur inconnu'}
                    {ticket.assignee_name ? ` · Assigné à ${ticket.assignee_name}` : ' · Non assigné'}
                    {ticket.category ? ` · ${ticket.category}` : ''}
                </p>
                {extraCol}
            </div>
            <div className="flex flex-wrap gap-1 shrink-0">
                <Badge className={`text-[11px] px-1.5 py-0 ${statusBadge(ticket.status)}`}>{statusLabel(ticket.status)}</Badge>
                <Badge className={`text-[11px] px-1.5 py-0 border ${priorityBadge(ticket.priority)}`}>{priorityLabel(ticket.priority)}</Badge>
            </div>
            <Link href={`/tickets/${ticket.id}`} className="shrink-0 self-center">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ExternalLink className="h-3.5 w-3.5" />
                </Button>
            </Link>
        </div>
    );
}

type AlertTab = 'unassigned' | 'stalled' | 'pending' | 'commandes';
type TicketTrendTab = 'statut' | 'cumule' | 'crees';
type ReorderSection = 'chartsRow' | 'agentLoad' | 'alerts' | 'agentPerformance' | 'recentTickets' | 'commandesOverview';
type DashboardSection =
    | 'ticketsTrend'
    | 'statusSplit'
    | 'agentLoad'
    | 'alerts'
    | 'agentPerformance'
    | 'recentTickets'
    | 'commandesOverview';

const reorderSectionDefaults: ReorderSection[] = [
    'chartsRow',
    'agentLoad',
    'alerts',
    'agentPerformance',
    'recentTickets',
    'commandesOverview',
];

const sectionOrderStorageKey = 'supportpc.admin.dashboard.sectionOrder';

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminDashboard({
    globalStats,
    agentStats,
    unassignedTickets,
    stalledTickets,
    pendingTooLongTickets,
    recentTickets,
    ticketsByDay,
    commandeStats,
    stalledCommandes,
    totalAlerts,
    agentOptions,
    filters,
}: AdminDashboardProps) {
    const [alertTab, setAlertTab] = useState<AlertTab>('unassigned');
    const [ticketTrendTab, setTicketTrendTab] = useState<TicketTrendTab>('statut');
    const [agentQuery, setAgentQuery] = useState('');
    const [singleDate, setSingleDate] = useState(filters.date ?? '');
    const [startDate, setStartDate] = useState(filters.start_date ?? '');
    const [endDate, setEndDate] = useState(filters.end_date ?? '');
    const [selectedAgentId, setSelectedAgentId] = useState(filters.agent_id ? String(filters.agent_id) : '');
    const [sectionOrder, setSectionOrder] = useState<ReorderSection[]>(reorderSectionDefaults);
    const [collapsedSections, setCollapsedSections] = useState<Record<DashboardSection, boolean>>({
        ticketsTrend: false,
        statusSplit: false,
        agentLoad: false,
        alerts: false,
        agentPerformance: false,
        recentTickets: false,
        commandesOverview: false,
    });
    const [agentSort, setAgentSort] = useState<{ key: keyof AgentStat; dir: 'asc' | 'desc' }>({
        key: 'alert_count',
        dir: 'desc',
    });

    const toggleSection = (section: DashboardSection) => {
        setCollapsedSections((current) => ({
            ...current,
            [section]: !current[section],
        }));
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const raw = window.localStorage.getItem(sectionOrderStorageKey);
            if (!raw) return;

            const parsed = JSON.parse(raw) as string[];
            if (!Array.isArray(parsed)) return;

            const known = reorderSectionDefaults.filter((section) => parsed.includes(section));
            const unknown = parsed.filter((section) => !reorderSectionDefaults.includes(section as ReorderSection));

            if (known.length === reorderSectionDefaults.length && unknown.length === 0) {
                setSectionOrder(known);
            }
        } catch {
            // Ignore invalid stored layout.
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(sectionOrderStorageKey, JSON.stringify(sectionOrder));
    }, [sectionOrder]);

    const moveSection = (section: ReorderSection, direction: 'up' | 'down') => {
        setSectionOrder((current) => {
            const index = current.indexOf(section);
            if (index === -1) return current;

            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= current.length) return current;

            const next = [...current];
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return next;
        });
    };

    const sectionOrderMap = useMemo(() => {
        return sectionOrder.reduce((map, section, index) => {
            map[section] = index;
            return map;
        }, {} as Record<ReorderSection, number>);
    }, [sectionOrder]);

    // Agent table filter + sort
    const filteredAgents = useMemo(() => {
        const q = agentQuery.trim().toLowerCase();
        const list = agentStats.filter((a) => {
            if (!q) return true;
            return (
                (a.name ?? '').toLowerCase().includes(q) ||
                (a.email ?? '').toLowerCase().includes(q) ||
                a.specialities.join(' ').toLowerCase().includes(q)
            );
        });
        return [...list].sort((a, b) => {
            const va = a[agentSort.key] as number | string | null;
            const vb = b[agentSort.key] as number | string | null;
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return agentSort.dir === 'asc' ? cmp : -cmp;
        });
    }, [agentStats, agentQuery, agentSort]);

    const toggleAgentSort = (key: keyof AgentStat) => {
        setAgentSort((prev) =>
            prev.key === key
                ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: 'desc' }
        );
    };

    const SortArrow = ({ col }: { col: keyof AgentStat }) => {
        if (agentSort.key !== col) return <span className="text-muted-foreground/30 ml-1">↕</span>;
        return <span className="ml-1">{agentSort.dir === 'asc' ? '↑' : '↓'}</span>;
    };

    // Charts data
    const doughnutData = {
        labels: ['Ouvert', 'En cours', 'En attente', 'Résolu', 'Fermé'],
        datasets: [{
            data: [
                globalStats.open,
                globalStats.in_progress,
                globalStats.pending,
                globalStats.resolved,
                globalStats.closed,
            ],
            backgroundColor: ['hsl(221 83% 53%)', 'hsl(262 83% 58%)', 'hsl(47 96% 53%)', 'hsl(142 71% 45%)', 'hsl(215 16% 47%)'],
            borderWidth: 2,
            borderColor: 'transparent',
        }],
    };

    const statusLineColors = {
        open:        { line: 'hsl(221 83% 53%)',  fill: 'hsla(221,83%,53%,0.06)' },
        in_progress: { line: 'hsl(262 83% 58%)',  fill: 'hsla(262,83%,58%,0.06)' },
        pending:     { line: 'hsl(47 96% 53%)',   fill: 'hsla(47,96%,53%,0.06)'  },
        resolved:    { line: 'hsl(142 71% 45%)',  fill: 'hsla(142,71%,45%,0.06)' },
    } as const;

    // ── Par statut: snapshot count of each status for each day ───────────────
    const lineDataStatut = {
        labels: ticketsByDay.map((d) => d.label),
        datasets: [
            { label: 'Ouvert',      data: ticketsByDay.map((d) => d.open),        borderColor: statusLineColors.open.line,        backgroundColor: statusLineColors.open.fill,        fill: false, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2 },
            { label: 'En cours',    data: ticketsByDay.map((d) => d.in_progress),  borderColor: statusLineColors.in_progress.line,  backgroundColor: statusLineColors.in_progress.fill,  fill: false, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2 },
            { label: 'En attente',  data: ticketsByDay.map((d) => d.pending),      borderColor: statusLineColors.pending.line,      backgroundColor: statusLineColors.pending.fill,      fill: false, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2 },
            { label: 'Résolu',      data: ticketsByDay.map((d) => d.resolved),     borderColor: statusLineColors.resolved.line,     backgroundColor: statusLineColors.resolved.fill,     fill: false, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2 },
        ],
    };

    // ── Cumulé: snapshot total of all tickets (all statuses) per day ─────────
    const lineDataCumule = {
        labels: ticketsByDay.map((d) => d.label),
        datasets: [{
            label: 'Total actifs (hors clôturés)',
            data: ticketsByDay.map((d) => d.open + d.in_progress + d.pending + d.resolved),
            borderColor: 'hsl(221 83% 53%)',
            backgroundColor: 'hsla(221,83%,53%,0.08)',
            fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2,
        }],
    };

    // ── Créés / jour: tickets created that day ─────────────────────────────
    const lineDataCrees = {
        labels: ticketsByDay.map((d) => d.label),
        datasets: [{
            label: 'Tickets créés',
            data: ticketsByDay.map((d) => d.created),
            borderColor: 'hsl(262 83% 58%)',
            backgroundColor: 'hsla(262,83%,58%,0.08)',
            fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 5, borderWidth: 2,
        }],
    };

    const lineData = ticketTrendTab === 'statut' ? lineDataStatut
        : ticketTrendTab === 'cumule' ? lineDataCumule
        : lineDataCrees;

    const barData = {
        labels: filteredAgents.slice(0, 10).map((a) => a.name ?? `Agent ${a.id}`),
        datasets: [
            {
                label: 'Actifs',
                data: filteredAgents.slice(0, 10).map((a) => a.assigned_open + a.assigned_in_prog + a.assigned_pending),
                backgroundColor: 'hsl(221 83% 53% / 0.8)',
                borderRadius: 4,
            },
            {
                label: filters.has_filter ? 'Résolus sur période' : 'Résolus ce mois',
                data: filteredAgents.slice(0, 10).map((a) => a.resolved_month),
                backgroundColor: 'hsl(142 71% 45% / 0.8)',
                borderRadius: 4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, stepSize: 1 } },
        },
    } as const;

    const alertTabClass = (tab: AlertTab) =>
        `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            alertTab === tab
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70'
                : 'text-muted-foreground hover:text-foreground'
        }`;

    const ticketTrendTabClass = (tab: TicketTrendTab) =>
        `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            ticketTrendTab === tab
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70'
                : 'text-muted-foreground hover:text-foreground'
        }`;

    const lineChartOptions = {
        ...chartOptions,
        plugins: {
            legend: {
                display: ticketTrendTab === 'statut',
                position: 'top' as const,
                labels: { font: { size: 11 }, boxWidth: 12 },
            },
        },
        scales: {
            ...chartOptions.scales,
            y: {
                ...chartOptions.scales.y,
                min: ticketTrendTab === 'cumule' ? 0 : undefined,
            },
        },
    };

    const thClass = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none hover:text-foreground whitespace-nowrap';
    const resolvedPeriodLabel = filters.has_filter ? 'Résolus (période)' : 'Résolus (mois)';

    const applyDateFilters = () => {
        const hasRange = Boolean(startDate || endDate);

        router.get('/admin/dashboard', hasRange ? {
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            agent_id: selectedAgentId || undefined,
        } : {
            date: singleDate || undefined,
            agent_id: selectedAgentId || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetDateFilters = () => {
        setSingleDate('');
        setStartDate('');
        setEndDate('');
        setSelectedAgentId('');

        router.get('/admin/dashboard', {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard Admin" />

            <div className="mx-auto flex w-full max-w-none flex-col gap-5 px-4 py-4 md:px-6 lg:px-8 xl:px-10">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-primary" />
                            Dashboard Administrateur
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Vue globale · {agentStats.length} agent{agentStats.length !== 1 ? 's' : ''} actifs · {totalAlerts} alerte{totalAlerts !== 1 ? 's' : ''} en cours
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/tickets/create">
                            <Button size="sm" variant="outline" className="gap-1.5">
                                <Zap className="h-3.5 w-3.5" /> Nouveau ticket
                            </Button>
                        </Link>
                        <Link href="/tickets">
                            <Button size="sm" variant="outline" className="gap-1.5">
                                <Inbox className="h-3.5 w-3.5" /> Tous les tickets
                            </Button>
                        </Link>
                        <Link href="/agents">
                            <Button size="sm" variant="outline" className="gap-1.5">
                                <Users className="h-3.5 w-3.5" /> Gérer les agents
                            </Button>
                        </Link>
                        <Link href="/tickets/bulk-distribution">
                            <Button size="sm" variant="outline" className="gap-1.5">
                                <ArrowRight className="h-3.5 w-3.5" /> Distribution massive
                            </Button>
                        </Link>
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">Filtrer les statistiques</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,220px)_minmax(0,220px)_auto]">
                            <label className="flex flex-col gap-1.5 text-sm">
                                <span className="text-xs font-medium text-muted-foreground">Date précise</span>
                                <input
                                    type="date"
                                    value={singleDate}
                                    onChange={(event) => {
                                        setSingleDate(event.target.value);
                                        if (event.target.value) {
                                            setStartDate('');
                                            setEndDate('');
                                        }
                                    }}
                                    className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </label>
                            <label className="flex flex-col gap-1.5 text-sm">
                                <span className="text-xs font-medium text-muted-foreground">Du</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => {
                                        setStartDate(event.target.value);
                                        if (event.target.value) {
                                            setSingleDate('');
                                        }
                                    }}
                                    className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </label>
                            <label className="flex flex-col gap-1.5 text-sm">
                                <span className="text-xs font-medium text-muted-foreground">Au</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) => {
                                        setEndDate(event.target.value);
                                        if (event.target.value) {
                                            setSingleDate('');
                                        }
                                    }}
                                    className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </label>
                            <label className="flex flex-col gap-1.5 text-sm">
                                <span className="text-xs font-medium text-muted-foreground">Agent</span>
                                <select
                                    value={selectedAgentId}
                                    onChange={(event) => setSelectedAgentId(event.target.value)}
                                    className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">Tous les agents</option>
                                    {agentOptions.map((agent) => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="flex flex-wrap items-end gap-2">
                                <Button type="button" size="sm" onClick={applyDateFilters}>Appliquer</Button>
                                <Button type="button" size="sm" variant="outline" onClick={resetDateFilters}>Réinitialiser</Button>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {filters.has_filter && filters.label
                                ? `Période active : ${filters.label}`
                                : 'Aucun filtre actif. Le dashboard affiche actuellement toutes les données, avec une courbe limitée aux 14 derniers jours.'}
                        </p>
                    </CardContent>
                </Card>

                {/* ── KPI Cards ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <KpiCard
                        label="Total tickets"
                        value={globalStats.total}
                        sub={`Et ${globalStats.closed} clôturé${globalStats.closed > 1 ? 's' : ''}`}
                        icon={Inbox}
                    />
                    <KpiCard label="Ouverts" value={globalStats.open} icon={TrendingUp} highlight={globalStats.open > 10 ? 'warning' : undefined} />
                    <KpiCard label="En cours" value={globalStats.in_progress} icon={Clock} highlight="info" />
                    <KpiCard label="Non assignés" value={globalStats.unassigned} icon={AlertTriangle} highlight={globalStats.unassigned > 0 ? 'danger' : 'success'} />
                    <KpiCard label="Haute priorité" value={globalStats.high_priority} icon={ShieldAlert} highlight={globalStats.high_priority > 0 ? 'danger' : 'success'} />
                    <KpiCard label="Alertes actives" value={totalAlerts} icon={Zap} highlight={totalAlerts > 0 ? 'danger' : 'success'} />
                </div>

                {/* ── Secondary KPIs ────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KpiCard label={filters.has_filter ? 'Aujourd\'hui' : 'Ce mois'} value={filters.has_filter ? globalStats.today : globalStats.this_month} sub="tickets créés" icon={BarChart3} />
                    <KpiCard label={filters.has_filter ? 'Cette semaine' : 'Cette semaine'} value={globalStats.this_week} sub="tickets créés" icon={TrendingUp} />
                    <KpiCard label="Résolus" value={globalStats.resolved} icon={CheckCircle2} highlight="success" />
                    <KpiCard label="Commandes" value={commandeStats.total} sub={`${commandeStats.new} nouvelles`} icon={ShoppingCart} />
                </div>

                {/* ── Charts row ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" style={{ order: sectionOrderMap.chartsRow + 10 }}>

                    <div className="col-span-full -mb-1 flex items-center justify-end gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveSection('chartsRow', 'up')}
                            disabled={sectionOrderMap.chartsRow === 0}
                            aria-label="Monter le bloc graphiques"
                        >
                            <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveSection('chartsRow', 'down')}
                            disabled={sectionOrderMap.chartsRow === sectionOrder.length - 1}
                            aria-label="Descendre le bloc graphiques"
                        >
                            <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Line chart: tickets par jour */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    {ticketTrendTab === 'statut' ? 'Par statut' : ticketTrendTab === 'cumule' ? 'Cumulé' : 'Créés par jour'} — {filters.has_filter && filters.label ? filters.label : '14 derniers jours'}
                                </CardTitle>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleSection('ticketsTrend')}
                                    aria-expanded={!collapsedSections.ticketsTrend}
                                    aria-controls="admin-section-ticketsTrend"
                                >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsedSections.ticketsTrend ? '' : 'rotate-180'}`} />
                                </Button>
                            </div>
                        </CardHeader>
                        {!collapsedSections.ticketsTrend && (
                            <CardContent id="admin-section-ticketsTrend">
                                <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-muted p-1 w-fit">
                                    <button type="button" className={ticketTrendTabClass('statut')} onClick={() => setTicketTrendTab('statut')}>
                                        Par statut
                                    </button>
                                    <button type="button" className={ticketTrendTabClass('cumule')} onClick={() => setTicketTrendTab('cumule')}>
                                        Cumulé
                                    </button>
                                    <button type="button" className={ticketTrendTabClass('crees')} onClick={() => setTicketTrendTab('crees')}>
                                        Créés / jour
                                    </button>
                                </div>
                                <div className={ticketTrendTab === 'statut' ? 'h-56' : 'h-44'}>
                                    <Line data={lineData} options={lineChartOptions} />
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* Doughnut: statuts */}
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-primary" />
                                    Répartition des statuts
                                </CardTitle>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleSection('statusSplit')}
                                    aria-expanded={!collapsedSections.statusSplit}
                                    aria-controls="admin-section-statusSplit"
                                >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsedSections.statusSplit ? '' : 'rotate-180'}`} />
                                </Button>
                            </div>
                        </CardHeader>
                        {!collapsedSections.statusSplit && (
                            <CardContent id="admin-section-statusSplit" className="flex flex-col items-center gap-3">
                                <div className="h-44 w-44">
                                    <Doughnut
                                        data={doughnutData}
                                        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                                    />
                                </div>
                                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                                    {['Ouvert', 'En cours', 'En attente', 'Résolu', 'Fermé'].map((label, i) => (
                                        <span key={label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <span
                                                className="inline-block h-2 w-2 rounded-full"
                                                style={{ backgroundColor: doughnutData.datasets[0].backgroundColor[i] }}
                                            />
                                            {label}
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </div>

                {/* ── Bar chart: tickets par agent ──────────────────────── */}
                {agentStats.length > 0 && (
                    <Card style={{ order: sectionOrderMap.agentLoad + 10 }}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" />
                                    Charge par agent (top 10)
                                </CardTitle>
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => moveSection('agentLoad', 'up')}
                                        disabled={sectionOrderMap.agentLoad === 0}
                                        aria-label="Monter le bloc charge par agent"
                                    >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => moveSection('agentLoad', 'down')}
                                        disabled={sectionOrderMap.agentLoad === sectionOrder.length - 1}
                                        aria-label="Descendre le bloc charge par agent"
                                    >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => toggleSection('agentLoad')}
                                        aria-expanded={!collapsedSections.agentLoad}
                                        aria-controls="admin-section-agentLoad"
                                    >
                                        <ChevronDown className={`h-4 w-4 transition-transform ${collapsedSections.agentLoad ? '' : 'rotate-180'}`} />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        {!collapsedSections.agentLoad && (
                            <CardContent id="admin-section-agentLoad">
                                <div className="h-52">
                                    <Bar
                                        data={barData}
                                        options={{
                                            ...chartOptions,
                                            plugins: {
                                                legend: {
                                                    display: true,
                                                    position: 'top',
                                                    labels: { font: { size: 11 }, boxWidth: 12 },
                                                },
                                            },
                                        }}
                                    />
                                </div>
                            </CardContent>
                        )}
                    </Card>
                )}

                {/* ── Alerts panel ──────────────────────────────────────── */}
                <Card style={{ order: sectionOrderMap.alerts + 10 }}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                Alertes
                                {totalAlerts > 0 && (
                                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                                        {totalAlerts}
                                    </span>
                                )}
                            </CardTitle>
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection('alerts', 'up')}
                                    disabled={sectionOrderMap.alerts === 0}
                                    aria-label="Monter le bloc alertes"
                                >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection('alerts', 'down')}
                                    disabled={sectionOrderMap.alerts === sectionOrder.length - 1}
                                    aria-label="Descendre le bloc alertes"
                                >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleSection('alerts')}
                                    aria-expanded={!collapsedSections.alerts}
                                    aria-controls="admin-section-alerts"
                                >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsedSections.alerts ? '' : 'rotate-180'}`} />
                                </Button>
                            </div>
                        </div>

                        {/* Tabs */}
                        {!collapsedSections.alerts && (
                            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 mt-2 w-fit">
                                <button className={alertTabClass('unassigned')} onClick={() => setAlertTab('unassigned')}>
                                    Non assignés <AlertBadge count={unassignedTickets.length} />
                                </button>
                                <button className={alertTabClass('stalled')} onClick={() => setAlertTab('stalled')}>
                                    Bloqués <AlertBadge count={stalledTickets.length} />
                                </button>
                                <button className={alertTabClass('pending')} onClick={() => setAlertTab('pending')}>
                                    En attente trop long <AlertBadge count={pendingTooLongTickets.length} />
                                </button>
                                <button className={alertTabClass('commandes')} onClick={() => setAlertTab('commandes')}>
                                    Commandes <AlertBadge count={stalledCommandes.length} />
                                </button>
                            </div>
                        )}
                    </CardHeader>
                    {!collapsedSections.alerts && (
                    <CardContent id="admin-section-alerts" className="space-y-2">

                        {alertTab === 'unassigned' && (
                            <>
                                {unassignedTickets.length === 0 ? (
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aucun ticket non assigné.
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Ces tickets actifs n'ont pas encore d'agent assigné.
                                        </p>
                                        {unassignedTickets.map((t) => (
                                            <TicketRow key={t.id} ticket={t}
                                                extraCol={
                                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                                                        ⚠ {t.age_label}
                                                    </p>
                                                }
                                            />
                                        ))}
                                    </>
                                )}
                            </>
                        )}

                        {alertTab === 'stalled' && (
                            <>
                                {stalledTickets.length === 0 ? (
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aucun ticket bloqué.
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Tickets ouverts ou en cours sans aucune mise à jour depuis plus de 3 jours.
                                        </p>
                                        {stalledTickets.map((t) => (
                                            <TicketRow key={t.id} ticket={t}
                                                extraCol={
                                                    <p className="text-[11px] text-destructive mt-0.5">
                                                        ⛔ {t.stalled_since}
                                                    </p>
                                                }
                                            />
                                        ))}
                                    </>
                                )}
                            </>
                        )}

                        {alertTab === 'pending' && (
                            <>
                                {pendingTooLongTickets.length === 0 ? (
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aucun ticket en attente trop longtemps.
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Tickets en statut "En attente" depuis plus de 24h sans relance.
                                        </p>
                                        {pendingTooLongTickets.map((t) => (
                                            <TicketRow key={t.id} ticket={t}
                                                extraCol={
                                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                                                        ⏳ {t.pending_since}
                                                    </p>
                                                }
                                            />
                                        ))}
                                    </>
                                )}
                            </>
                        )}

                        {alertTab === 'commandes' && (
                            <>
                                {stalledCommandes.length === 0 ? (
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aucune commande bloquée.
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            Commandes en statut "nouveau" ou "panier" sans mise à jour depuis 2+ jours.
                                        </p>
                                        {stalledCommandes.map((c) => (
                                            <div key={c.id} className="flex flex-wrap items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors">
                                                <span className="font-mono text-xs text-muted-foreground w-10 shrink-0 pt-0.5">#{c.id}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate leading-snug">{c.nom ?? 'Commande sans nom'}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                                        {c.ticket_title ? `Ticket: ${c.ticket_title}` : `Ticket #${c.ticket_id}`}
                                                        {c.fournisseur ? ` · ${c.fournisseur}` : ' · Fournisseur manquant'}
                                                    </p>
                                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">⏳ {c.stalled_since}</p>
                                                </div>
                                                <Badge className="text-[11px] px-1.5 py-0 bg-muted text-foreground border-border">
                                                    {commandeStatutLabel(c.statut)}
                                                </Badge>
                                                <Link href={`/commandes/${c.id}`} className="shrink-0 self-center">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </>
                        )}
                    </CardContent>
                    )}
                </Card>

                {/* ── Agent Performance Table ───────────────────────────── */}
                <Card style={{ order: sectionOrderMap.agentPerformance + 10 }}>
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" />
                                    Performance des agents
                                </CardTitle>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection('agentPerformance', 'up')}
                                    disabled={sectionOrderMap.agentPerformance === 0}
                                    aria-label="Monter le bloc performance des agents"
                                >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection('agentPerformance', 'down')}
                                    disabled={sectionOrderMap.agentPerformance === sectionOrder.length - 1}
                                    aria-label="Descendre le bloc performance des agents"
                                >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleSection('agentPerformance')}
                                    aria-expanded={!collapsedSections.agentPerformance}
                                    aria-controls="admin-section-agentPerformance"
                                >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsedSections.agentPerformance ? '' : 'rotate-180'}`} />
                                </Button>
                            </div>
                            {!collapsedSections.agentPerformance && (
                                <input
                                    type="text"
                                    value={agentQuery}
                                    onChange={(e) => setAgentQuery(e.target.value)}
                                    placeholder="Filtrer par nom, email, spécialité..."
                                    className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            )}
                        </div>
                    </CardHeader>
                    {!collapsedSections.agentPerformance && (
                    <CardContent id="admin-section-agentPerformance" className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-border">
                                    <tr>
                                        <th className={thClass} onClick={() => toggleAgentSort('name')}>Agent <SortArrow col="name" /></th>
                                        <th className={thClass} onClick={() => toggleAgentSort('assigned_total')}>Total <SortArrow col="assigned_total" /></th>
                                        <th className={thClass} onClick={() => toggleAgentSort('assigned_open')}>Ouverts <SortArrow col="assigned_open" /></th>
                                        <th className={thClass} onClick={() => toggleAgentSort('assigned_in_prog')}>En cours <SortArrow col="assigned_in_prog" /></th>
                                        <th className={thClass} onClick={() => toggleAgentSort('assigned_pending')}>En attente <SortArrow col="assigned_pending" /></th>
                                        <th className={thClass} onClick={() => toggleAgentSort('resolved_month')}>{resolvedPeriodLabel} <SortArrow col="resolved_month" /></th>
                                        <th className={thClass} onClick={() => toggleAgentSort('high_priority')}>Haute prio <SortArrow col="high_priority" /></th>
                                        <th className={thClass} onClick={() => toggleAgentSort('alert_count')}>Alertes <SortArrow col="alert_count" /></th>
                                        <th className={thClass} onClick={() => toggleAgentSort('last_activity')}>Dernière activité <SortArrow col="last_activity" /></th>
                                        <th className={`${thClass} cursor-default`}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAgents.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="px-3 py-6 text-center text-sm text-muted-foreground">
                                                Aucun agent trouvé
                                            </td>
                                        </tr>
                                    )}
                                    {filteredAgents.map((agent) => (
                                        <tr key={agent.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                            <td className="px-3 py-2.5">
                                                <div>
                                                    <p className="font-medium leading-snug flex items-center gap-1.5">
                                                        {agent.name ?? `Agent #${agent.id}`}
                                                        {agent.is_admin && (
                                                            <Badge className="text-[10px] px-1 py-0 bg-primary text-primary-foreground">Admin</Badge>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{agent.email}</p>
                                                    {agent.specialities.length > 0 && (
                                                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[160px]">
                                                            {agent.specialities.join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-mono text-sm">{agent.assigned_total}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`font-mono text-sm ${agent.assigned_open > 5 ? 'text-amber-500 font-semibold' : ''}`}>
                                                    {agent.assigned_open}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-mono text-sm">{agent.assigned_in_prog}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`font-mono text-sm ${agent.assigned_pending > 3 ? 'text-amber-500 font-semibold' : ''}`}>
                                                    {agent.assigned_pending}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`font-mono text-sm font-semibold ${agent.resolved_month > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                                    {agent.resolved_month}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                {agent.high_priority > 0 ? (
                                                    <span className="inline-flex items-center justify-center rounded-full bg-destructive/15 px-1.5 py-0.5 text-xs font-bold text-destructive">
                                                        {agent.high_priority}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground font-mono text-sm">0</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                {agent.alert_count > 0 ? (
                                                    <span className="inline-flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                                                        {agent.alert_count}
                                                    </span>
                                                ) : (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {agent.last_activity_label}
                                                </p>
                                                {agent.last_activity && (
                                                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                                        {formatDateTimeFr(agent.last_activity)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1">
                                                    <Link href={`/tickets?assignee_id=${agent.user_id}`}>
                                                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs px-2">
                                                            Tickets <ArrowRight className="h-3 w-3" />
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/agents/${agent.id}/edit`}>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                    )}
                </Card>

                {/* ── Recent Tickets ────────────────────────────────────── */}
                <Card style={{ order: sectionOrderMap.recentTickets + 10 }}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    {filters.has_filter ? 'Activité récente (15 derniers tickets filtrés)' : 'Activité récente (15 derniers tickets)'}
                                </CardTitle>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection('recentTickets', 'up')}
                                    disabled={sectionOrderMap.recentTickets === 0}
                                    aria-label="Monter le bloc activité récente"
                                >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection('recentTickets', 'down')}
                                    disabled={sectionOrderMap.recentTickets === sectionOrder.length - 1}
                                    aria-label="Descendre le bloc activité récente"
                                >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleSection('recentTickets')}
                                    aria-expanded={!collapsedSections.recentTickets}
                                    aria-controls="admin-section-recentTickets"
                                >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsedSections.recentTickets ? '' : 'rotate-180'}`} />
                                </Button>
                            </div>
                            {!collapsedSections.recentTickets && (
                                <Link href="/tickets">
                                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                                        Voir tout <ArrowRight className="h-3 w-3" />
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </CardHeader>
                    {!collapsedSections.recentTickets && (
                    <CardContent id="admin-section-recentTickets" className="space-y-2">
                        {recentTickets.map((t) => (
                            <TicketRow key={t.id} ticket={t}
                                extraCol={
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        {t.messages_count} message{t.messages_count !== 1 ? 's' : ''} · {formatDateTimeFr(t.updated_at)}
                                    </p>
                                }
                            />
                        ))}
                        {recentTickets.length === 0 && (
                            <p className="text-sm text-muted-foreground">Aucun ticket récent.</p>
                        )}
                    </CardContent>
                    )}
                </Card>

                {/* ── Commandes overview ────────────────────────────────── */}
                <Card style={{ order: sectionOrderMap.commandesOverview + 10 }}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <ShoppingCart className="h-4 w-4 text-primary" />
                                    Vue d'ensemble des commandes
                                </CardTitle>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection('commandesOverview', 'up')}
                                    disabled={sectionOrderMap.commandesOverview === 0}
                                    aria-label="Monter le bloc commandes"
                                >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => moveSection('commandesOverview', 'down')}
                                    disabled={sectionOrderMap.commandesOverview === sectionOrder.length - 1}
                                    aria-label="Descendre le bloc commandes"
                                >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => toggleSection('commandesOverview')}
                                    aria-expanded={!collapsedSections.commandesOverview}
                                    aria-controls="admin-section-commandesOverview"
                                >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsedSections.commandesOverview ? '' : 'rotate-180'}`} />
                                </Button>
                            </div>
                            {!collapsedSections.commandesOverview && (
                                <Link href="/commandes">
                                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                                        Toutes les commandes <ArrowRight className="h-3 w-3" />
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </CardHeader>
                    {!collapsedSections.commandesOverview && (
                    <CardContent id="admin-section-commandesOverview">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                                { label: 'Nouvelles', value: commandeStats.new, color: 'text-primary' },
                                { label: 'Panier', value: commandeStats.panier, color: 'text-amber-500' },
                                { label: 'Commandées', value: commandeStats.ordered, color: 'text-blue-500' },
                                { label: 'Reçues', value: commandeStats.received, color: 'text-emerald-500' },
                            ].map(({ label, value, color }) => (
                                <div key={label} className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
                                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    )}
                </Card>

            </div>
        </AppLayout>
    );
}
