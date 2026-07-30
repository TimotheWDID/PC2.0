import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { formatDateTimeFr } from '@/lib/datetime';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, Bell, BellRing, CheckCircle2, Clock3, Home, Info, Inbox, ListFilter, MailWarning, Plus, Search, Settings, TriangleAlert, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type DashboardMode = 'agent' | 'user';
type Severity = 'all' | 'critical' | 'warning' | 'info' | 'notification';

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
    severity: 'critical' | 'warning' | 'info' | 'notification';
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

type TicketSignal = {
    severity: Exclude<Severity, 'all'>;
    messages: string[];
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

const statusBadgeClass = (status?: string | null): string => {
    if (status === 'open') return 'border-transparent bg-primary text-primary-foreground';
    if (status === 'in_progress') return 'border-transparent bg-secondary text-secondary-foreground';
    if (status === 'pending') return 'border-border bg-muted text-foreground';
    if (status === 'resolved') return 'border-transparent bg-accent text-accent-foreground';
    if (status === 'closed') return 'border-border bg-background text-muted-foreground';
    return 'border-border bg-background text-muted-foreground';
};

const priorityLabel = (priority?: string | null): string => {
    const map: Record<string, string> = {
        high: 'Haute',
        medium: 'Moyenne',
        low: 'Basse',
    };

    if (!priority) return 'Non précisée';
    return map[priority] ?? priority;
};

const priorityBadgeClass = (priority?: string | null): string => {
    if (priority === 'high') return 'bg-primary text-primary-foreground';
    if (priority === 'medium') return 'bg-secondary text-secondary-foreground';
    if (priority === 'low') return 'bg-muted text-foreground';
    return 'bg-muted text-muted-foreground';
};

const severityLabel = (severity: Severity): string => {
    if (severity === 'critical') return 'Critique';
    if (severity === 'warning') return 'Attention';
    if (severity === 'info') return 'Info';
    if (severity === 'notification') return 'Notification';
    return 'Toutes';
};

const signalOrder: Exclude<Severity, 'all'>[] = ['critical', 'warning', 'info', 'notification'];

const signalIcon = (severity: Exclude<Severity, 'all'>) => {
    if (severity === 'critical') return TriangleAlert;
    if (severity === 'warning') return AlertCircle;
    if (severity === 'info') return Info;
    return Bell;
};

const signalIconClass = (severity: Exclude<Severity, 'all'>) => {
    if (severity === 'critical') return 'text-destructive';
    if (severity === 'warning') return 'text-chart-3';
    if (severity === 'info') return 'text-chart-2';
    return 'text-primary';
};

const sectionTitleClass = 'relative pl-3 text-sm font-semibold tracking-tight before:absolute before:left-0 before:top-1 before:h-4 before:w-1 before:rounded-full before:bg-primary/60';

export default function Dashboard({ mode, summary, actionItems, assignedTickets, recentTickets, quickActions }: DashboardProps) {
    const page = usePage();
    const user = (page.props as any).auth?.user ?? null;
    const isAgent = mode ? mode === 'agent' : !!user?.agent;
    const currentUrl = page.url ?? '/';
    const currentPath = (page.url ?? '/').split('?')[0] || '/';
    const isNotificationView = currentUrl.includes('severity=notification');

    const stats = summary ?? {};
    const actions = quickActions ?? [];
    const allActionItems = actionItems ?? [];
    const assigned = assignedTickets ?? [];
    const recent = recentTickets ?? [];

    const [query, setQuery] = useState('');
    const [notificationKind, setNotificationKind] = useState<'all' | 'ticket_reply' | 'mention' | 'inbound'>('all');
    const [validatingTicketId, setValidatingTicketId] = useState<number | null>(null);
    const severityOrder = useMemo<Severity[]>(() => ['notification', 'critical', 'warning', 'info', 'all'], []);
    const severityRank = useMemo<Record<Exclude<Severity, 'all'>, number>>(
        () => ({ notification: 4, critical: 3, warning: 2, info: 1 }),
        [],
    );

    const initialSeverity = useMemo<Severity>(() => {
        const queryString = (page.url ?? '').split('?')[1] ?? '';
        const fromQuery = new URLSearchParams(queryString).get('severity');
        return severityOrder.includes(fromQuery as Severity) ? (fromQuery as Severity) : 'all';
    }, [page.url, severityOrder]);

    const [severity, setSeverity] = useState<Severity>(initialSeverity);

    useEffect(() => {
        setSeverity(initialSeverity);
    }, [initialSeverity]);

    const assignedTicketIds = useMemo(() => new Set(assigned.map((ticket) => ticket.id)), [assigned]);

    const ticketSignalsById = useMemo(() => {
        const signalMap = new Map<number, Map<Exclude<Severity, 'all'>, string[]>>();

        allActionItems.forEach((item) => {
            let ticketId: number | null = null;

            if (item.kind === 'ticket' && item.ticket?.id) {
                const candidate = Number(item.ticket.id);
                ticketId = Number.isFinite(candidate) ? candidate : null;
            } else if (item.kind === 'commande' && item.commande?.ticket_id) {
                const candidate = Number(item.commande.ticket_id);
                ticketId = Number.isFinite(candidate) ? candidate : null;
            }

            if (!ticketId) {
                return;
            }

            const current = signalMap.get(ticketId) ?? new Map<Exclude<Severity, 'all'>, string[]>();
            const key = item.severity as Exclude<Severity, 'all'>;
            const messages = current.get(key) ?? [];
            messages.push(item.reason);
            current.set(key, messages);
            signalMap.set(ticketId, current);
        });

        const flatMap = new Map<number, TicketSignal[]>();

        signalMap.forEach((bySeverity, ticketId) => {
            const signals: TicketSignal[] = signalOrder
                .map((level) => ({ severity: level, messages: bySeverity.get(level) ?? [] }))
                .filter((entry) => entry.messages.length > 0)
                .map((entry) => ({
                    severity: entry.severity,
                    messages: Array.from(new Set(entry.messages)),
                }));

            flatMap.set(ticketId, signals);
        });

        return flatMap;
    }, [allActionItems]);

    const mentionOutsideAssignedTickets = useMemo(() => {
        const byId = new Map<number, TicketItem>();

        allActionItems
            .filter((item) => item.kind === 'ticket' && item.severity === 'notification' && !!item.ticket?.id)
            .forEach((item) => {
                const ticket = item.ticket as TicketItem;
                const ticketId = Number(ticket.id);

                if (!Number.isFinite(ticketId) || assignedTicketIds.has(ticketId)) {
                    return;
                }

                if (!byId.has(ticketId)) {
                    byId.set(ticketId, { ...ticket, id: ticketId });
                }
            });

        return Array.from(byId.values());
    }, [allActionItems, assignedTicketIds]);

    const filteredMentionOutsideAssignedTickets = useMemo(() => {
        const q = query.trim().toLowerCase();

        if (severity !== 'all' && severity !== 'notification') {
            return [] as TicketItem[];
        }

        return mentionOutsideAssignedTickets.filter((ticket) => {
            const signals = ticketSignalsById.get(ticket.id) ?? [];

            if (severity === 'notification' && !signals.some((signal) => signal.severity === 'notification')) {
                return false;
            }

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
                ...signals.flatMap((signal) => signal.messages),
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [mentionOutsideAssignedTickets, query, severity, ticketSignalsById]);

    const commandOutsideAssignedTickets = useMemo(() => {
        const byId = new Map<number, TicketItem>();

        allActionItems
            .filter((item) => item.kind === 'commande' && !!item.commande?.ticket_id)
            .forEach((item) => {
                const ticketId = Number(item.commande?.ticket_id);

                if (!Number.isFinite(ticketId) || assignedTicketIds.has(ticketId)) {
                    return;
                }

                if (!byId.has(ticketId)) {
                    byId.set(ticketId, {
                        id: ticketId,
                        title: item.commande?.ticket_title ?? `Ticket n°${ticketId}`,
                        status: null,
                        priority: null,
                        requester_name: null,
                        updated_at: item.commande?.updated_at ?? null,
                    });
                }
            });

        return Array.from(byId.values());
    }, [allActionItems, assignedTicketIds]);

    const allAssignedCommandes = useMemo(() => {
        const byId = new Map<number, ActionItem>();

        allActionItems
            .filter((item) => item.kind === 'commande' && !!item.commande?.id)
            .forEach((item) => {
                const commandId = Number(item.commande?.id);
                if (!Number.isFinite(commandId)) {
                    return;
                }

                if (!byId.has(commandId)) {
                    byId.set(commandId, item);
                }
            });

        return Array.from(byId.values());
    }, [allActionItems]);

    const filteredAssignedCommandes = useMemo(() => {
        const q = query.trim().toLowerCase();

        return allAssignedCommandes.filter((item) => {
            if (severity !== 'all' && item.severity !== severity) {
                return false;
            }

            if (!q) {
                return true;
            }

            const haystack = [
                item.commande?.id?.toString() ?? '',
                item.commande?.nom ?? '',
                item.commande?.statut ?? '',
                item.commande?.fournisseur ?? '',
                item.commande?.command_number ?? '',
                item.commande?.ticket_title ?? '',
                item.reason ?? '',
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [allAssignedCommandes, query, severity]).sort((a, b) => {
        const rankDiff = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
        if (rankDiff !== 0) {
            return rankDiff;
        }

        const aDate = a.commande?.updated_at ? new Date(a.commande.updated_at).getTime() : 0;
        const bDate = b.commande?.updated_at ? new Date(b.commande.updated_at).getTime() : 0;
        return bDate - aDate;
    });

    const filteredCommandOutsideAssignedTickets = useMemo(() => {
        const q = query.trim().toLowerCase();

        if (severity !== 'all' && severity !== 'critical' && severity !== 'warning') {
            return [] as TicketItem[];
        }

        return commandOutsideAssignedTickets.filter((ticket) => {
            const signals = ticketSignalsById.get(ticket.id) ?? [];

            if (severity === 'critical' && !signals.some((signal) => signal.severity === 'critical')) {
                return false;
            }

            if (severity === 'warning' && !signals.some((signal) => signal.severity === 'warning')) {
                return false;
            }

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
                ...signals.flatMap((signal) => signal.messages),
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [commandOutsideAssignedTickets, query, severity, ticketSignalsById]);

    const filteredAssignedTickets = useMemo(() => {
        const q = query.trim().toLowerCase();

        return assigned.filter((ticket) => {
            const signals = ticketSignalsById.get(ticket.id) ?? [];

            if (severity !== 'all' && !signals.some((signal) => signal.severity === severity)) {
                return false;
            }

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
                ...signals.flatMap((signal) => signal.messages),
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [assigned, query, severity, ticketSignalsById]);

    const mergedAssignedTickets = useMemo(() => {
        const byId = new Map<number, TicketItem>();

        filteredAssignedTickets.forEach((ticket) => {
            byId.set(ticket.id, ticket);
        });

        filteredMentionOutsideAssignedTickets.forEach((ticket) => {
            if (!byId.has(ticket.id)) {
                byId.set(ticket.id, ticket);
            }
        });

        filteredCommandOutsideAssignedTickets.forEach((ticket) => {
            if (!byId.has(ticket.id)) {
                byId.set(ticket.id, ticket);
            }
        });

        return Array.from(byId.values()).sort((a, b) => {
            const rankFor = (ticketId: number) => {
                const signals = ticketSignalsById.get(ticketId) ?? [];
                if (signals.length === 0) {
                    return 0;
                }

                return Math.max(...signals.map((signal) => severityRank[signal.severity] ?? 0));
            };

            const rankDiff = rankFor(b.id) - rankFor(a.id);
            if (rankDiff !== 0) {
                return rankDiff;
            }

            const aDate = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const bDate = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return bDate - aDate;
        });
    }, [filteredAssignedTickets, filteredMentionOutsideAssignedTickets, filteredCommandOutsideAssignedTickets, ticketSignalsById, severityRank]);

    const mentionOutsideTicketIds = useMemo(() => {
        return new Set(mentionOutsideAssignedTickets.map((ticket) => ticket.id));
    }, [mentionOutsideAssignedTickets]);

    const commandOutsideTicketIds = useMemo(() => {
        return new Set(commandOutsideAssignedTickets.map((ticket) => ticket.id));
    }, [commandOutsideAssignedTickets]);

    const assignedPanelCount = useMemo(() => {
        const ids = new Set<number>();
        assigned.forEach((ticket) => ids.add(ticket.id));
        mentionOutsideAssignedTickets.forEach((ticket) => ids.add(ticket.id));
        commandOutsideAssignedTickets.forEach((ticket) => ids.add(ticket.id));
        return ids.size + allAssignedCommandes.length;
    }, [assigned, mentionOutsideAssignedTickets, commandOutsideAssignedTickets, allAssignedCommandes.length]);

    const unreadCount = Number((page.props as any).notifications?.unread_count ?? 0);

    const notificationItems = useMemo(() => {
        const onlyNotifications = allActionItems.filter((item) => item.severity === 'notification');

        return [...onlyNotifications].sort((left, right) => {
            const leftDate = left.ticket?.updated_at
                ? new Date(left.ticket.updated_at).getTime()
                : left.commande?.updated_at
                  ? new Date(left.commande.updated_at).getTime()
                  : 0;

            const rightDate = right.ticket?.updated_at
                ? new Date(right.ticket.updated_at).getTime()
                : right.commande?.updated_at
                  ? new Date(right.commande.updated_at).getTime()
                  : 0;

            return rightDate - leftDate;
        });
    }, [allActionItems]);

    const filteredNotificationItems = useMemo(() => {
        const q = query.trim().toLowerCase();

        return notificationItems.filter((item) => {
            const tags = item.tags ?? [];
            const isMention = tags.includes('Mention @');
            const isTicketReply = tags.includes('Reponse ticket');
            const isInbound = tags.includes('Mail entrant');

            if (notificationKind === 'mention' && !isMention) {
                return false;
            }

            if (notificationKind === 'ticket_reply' && !isTicketReply) {
                return false;
            }

            if (notificationKind === 'inbound' && !isInbound) {
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
                item.ticket?.requester_name ?? '',
                item.commande?.id?.toString() ?? '',
                item.commande?.ticket_title ?? '',
                ...tags,
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(q);
        });
    }, [notificationItems, notificationKind, query]);

    const notificationSummary = useMemo(() => {
        const summaryMap = {
            mention: 0,
            ticket_reply: 0,
            inbound: 0,
        };

        notificationItems.forEach((item) => {
            const tags = item.tags ?? [];

            if (tags.includes('Mention @')) {
                summaryMap.mention += 1;
            }

            if (tags.includes('Reponse ticket')) {
                summaryMap.ticket_reply += 1;
            }

            if (tags.includes('Mail entrant')) {
                summaryMap.inbound += 1;
            }
        });

        return summaryMap;
    }, [notificationItems]);

    const validateTicketNotification = (ticketId: number) => {
        if (validatingTicketId !== null) {
            return;
        }

        setValidatingTicketId(ticketId);

        router.post(
            `/dashboard/notifications/validate-ticket/${ticketId}`,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setValidatingTicketId(null),
            },
        );
    };

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

    const renderSignalIcons = (ticketId: number) => {
        const signals = ticketSignalsById.get(ticketId) ?? [];

        if (signals.length === 0) {
            return null;
        }

        return (
            <div className="flex items-center gap-1">
                {signals.map((signal) => {
                    const Icon = signalIcon(signal.severity);

                    return (
                        <Tooltip key={`${ticketId}-${signal.severity}`}>
                            <TooltipTrigger asChild>
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/80">
                                    <Icon className={`h-4 w-4 ${signalIconClass(signal.severity)}`} />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <div className="space-y-1">
                                    <div className="font-semibold">{severityLabel(signal.severity)}</div>
                                    {signal.messages.slice(0, 3).map((message, idx) => (
                                        <div key={`${ticketId}-${signal.severity}-${idx}`}>{message}</div>
                                    ))}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        );
    };

    const renderTicketCard = (ticket: TicketItem, compact = false, isOutsideMention = false, isOutsideCommand = false) => (
        <Link
            key={ticket.id}
            href={`/tickets/${ticket.id}`}
            className={`block rounded-lg border transition-all duration-200 hover:bg-muted/40 active:scale-[0.99] ${
                isOutsideCommand
                    ? 'border-[#e6892e]'
                    : isOutsideMention
                      ? 'border-[#2a3ff5]'
                      : 'border-border'
            } ${
                compact ? 'p-3' : 'rounded-xl p-4'
            }`}
        >
            {(ticketSignalsById.get(ticket.id) ?? []).some((signal) => signal.severity === 'notification') && (
                <div className="mb-2 flex justify-end">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            validateTicketNotification(ticket.id);
                        }}
                        disabled={validatingTicketId === ticket.id}
                        className="inline-flex items-center rounded-md border border-primary/40 bg-background px-2 py-1 text-[11px] font-medium text-primary hover:bg-muted disabled:opacity-60"
                    >
                        {validatingTicketId === ticket.id ? 'Validation...' : 'Valider la notification'}
                    </button>
                </div>
            )}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className={`${compact ? 'text-[11px]' : 'text-xs'} text-muted-foreground`}>{ticket.requester_name ?? 'Demandeur inconnu'}</div>
                    <div className={`break-words ${compact ? 'text-sm leading-snug' : 'font-medium leading-tight'}`}>Ticket n°{ticket.id} · {ticket.title ?? 'Sans titre'}</div>
                </div>
                <div className="flex items-center gap-2">
                    {renderSignalIcons(ticket.id)}
                    {isOutsideMention && (
                        <Badge variant="outline" className="shrink-0">
                            Mention @
                        </Badge>
                    )}
                    <Badge className={`shrink-0 ${statusBadgeClass(ticket.status)}`} variant="outline">
                        {statusLabel(ticket.status)}
                    </Badge>
                </div>
            </div>

            <p className={`mt-2 break-words ${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(ticket.priority)}`}>
                    Priorité {priorityLabel(ticket.priority)}
                </span>
                {ticket.updated_at ? ` · Mis à jour le ${formatDateTimeFr(ticket.updated_at, { timeZone: 'Europe/Paris' })}` : ''}
            </p>
        </Link>
    );

    const renderCommandeCard = (item: ActionItem, compact = false) => {
        const commande = item.commande;
        if (!commande) {
            return null;
        }

        const CommandSignalIcon = signalIcon(item.severity as Exclude<Severity, 'all'>);

        return (
            <Link
                key={`commande-${commande.id}`}
                href={item.href}
                className={`block rounded-lg border border-[#22a06b] transition-all duration-200 hover:bg-muted/40 active:scale-[0.99] ${
                    compact ? 'p-3' : 'rounded-xl p-4'
                }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className={`${compact ? 'text-[11px]' : 'text-xs'} text-muted-foreground`}>{commande.fournisseur || 'Fournisseur non renseigne'}</div>
                        <div className={`break-words ${compact ? 'text-sm leading-snug' : 'font-medium leading-tight'}`}>Commande n°{commande.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/80">
                                    <CommandSignalIcon className={`h-4 w-4 ${signalIconClass(item.severity as Exclude<Severity, 'all'>)}`} />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <div className="space-y-1">
                                    <div className="font-semibold">{severityLabel(item.severity)}</div>
                                    <div>{item.reason}</div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                        <Badge variant="outline" className="shrink-0 border-[#22a06b] text-[#1c7a53]">
                            Commande
                        </Badge>
                    </div>
                </div>

                <p className={`mt-2 break-words ${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                    {commande.ticket_title ? `Ticket: ${commande.ticket_title}` : 'Aucun ticket lie'}
                    {commande.command_number ? ` · Ref: ${commande.command_number}` : ''}
                </p>
            </Link>
        );
    };

    const renderNotificationCard = (item: ActionItem) => {
        const tags = item.tags ?? [];
        const isMention = tags.includes('Mention @');
        const isTicketReply = tags.includes('Reponse ticket');
        const isInbound = tags.includes('Mail entrant');
        const ticketId = item.ticket?.id ? Number(item.ticket.id) : null;

        const accentClass = isInbound
            ? 'border-[#e6892e]/50 bg-[#fff4e8]'
            : isTicketReply
              ? 'border-[#22a06b]/40 bg-[#ecfdf3]'
              : 'border-[#2a3ff5]/30 bg-[#eef1ff]';

        return (
            <div key={item.id} className={`rounded-xl border p-4 ${accentClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-foreground">{item.reason}</p>
                        {item.age_label && <p className="text-xs text-muted-foreground">{item.age_label}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {isMention && <Badge variant="outline">Mention</Badge>}
                        {isTicketReply && <Badge variant="outline" className="border-[#22a06b] text-[#1c7a53]">Reponse client</Badge>}
                        {isInbound && <Badge variant="outline" className="border-[#e6892e] text-[#b55f00]">Mail non lie</Badge>}
                    </div>
                </div>

                {item.ticket && (
                    <div className="mt-3 rounded-lg border border-border/60 bg-background/70 p-3 text-sm">
                        <p className="font-medium">Ticket n°{item.ticket.id} · {item.ticket.title ?? 'Sans titre'}</p>
                        <p className="text-xs text-muted-foreground">
                            {item.ticket.requester_name ?? 'Demandeur inconnu'}
                            {item.ticket.updated_at ? ` · ${formatDateTimeFr(item.ticket.updated_at, { timeZone: 'Europe/Paris' })}` : ''}
                        </p>
                    </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                        <Link href={item.href}>{item.action_label || 'Ouvrir'}</Link>
                    </Button>

                    {ticketId && (isMention || isTicketReply) && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => validateTicketNotification(ticketId)}
                            disabled={validatingTicketId === ticketId}
                        >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                            {validatingTicketId === ticketId ? 'Validation...' : 'Marquer lue'}
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    if (isNotificationView) {
        return (
            <AppLayout breadcrumbs={[{ title: 'Notifications', href: '/dashboard?severity=notification' }]}>
                <Head title="Notifications" />

                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-2 py-2 pb-24 sm:px-4 sm:py-4 md:px-6 lg:pb-6">
                    <section className="rounded-2xl border border-border/70 bg-gradient-to-r from-[#141d3a] via-[#1f2b57] to-[#2a3ff5] p-4 text-white shadow-sm sm:p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="space-y-2">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                                    <BellRing className="h-3.5 w-3.5" />
                                    Centre de notifications
                                </div>
                                <h1 className="text-xl font-semibold sm:text-2xl">Notifications agents</h1>
                                <p className="max-w-2xl text-sm text-white/85">
                                    Reponses client, mentions internes et mails entrants non lies. Tout est centralise ici pour traitement rapide.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2">
                                    <div className="text-[11px] text-white/80">Non lues</div>
                                    <p className="text-lg font-semibold leading-none">{unreadCount}</p>
                                </div>
                                <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2">
                                    <div className="text-[11px] text-white/80">Mentions</div>
                                    <p className="text-lg font-semibold leading-none">{notificationSummary.mention}</p>
                                </div>
                                <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2">
                                    <div className="text-[11px] text-white/80">Reponses client</div>
                                    <p className="text-lg font-semibold leading-none">{notificationSummary.ticket_reply}</p>
                                </div>
                                <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2">
                                    <div className="text-[11px] text-white/80">Mails non lies</div>
                                    <p className="text-lg font-semibold leading-none">{notificationSummary.inbound}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <Card className="border-border/70">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Filtrer les notifications</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Rechercher dans les notifications"
                                        className="pl-9"
                                    />
                                </div>
                                <Button type="button" variant="outline" onClick={() => router.reload({ only: ['actionItems', 'summary', 'notifications'] })}>
                                    Actualiser
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button type="button" size="sm" variant={notificationKind === 'all' ? 'default' : 'outline'} onClick={() => setNotificationKind('all')}>
                                    Toutes
                                </Button>
                                <Button type="button" size="sm" variant={notificationKind === 'mention' ? 'default' : 'outline'} onClick={() => setNotificationKind('mention')}>
                                    Mentions
                                </Button>
                                <Button type="button" size="sm" variant={notificationKind === 'ticket_reply' ? 'default' : 'outline'} onClick={() => setNotificationKind('ticket_reply')}>
                                    Reponses client
                                </Button>
                                <Button type="button" size="sm" variant={notificationKind === 'inbound' ? 'default' : 'outline'} onClick={() => setNotificationKind('inbound')}>
                                    Mails non lies
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <section className="space-y-3">
                        {filteredNotificationItems.length === 0 ? (
                            <Card className="border-border/70">
                                <CardContent className="flex items-center gap-3 pt-6 text-sm text-muted-foreground">
                                    <Inbox className="h-5 w-5" />
                                    <span>Aucune notification pour ce filtre.</span>
                                </CardContent>
                            </Card>
                        ) : (
                            filteredNotificationItems.map((item) => renderNotificationCard(item))
                        )}
                    </section>

                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href="/dashboard">
                                <Home className="mr-1.5 h-4 w-4" />
                                Retour dashboard
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/tickets/inbound-mails">
                                <MailWarning className="mr-1.5 h-4 w-4" />
                                Traiter les mails entrants
                            </Link>
                        </Button>
                    </div>
                </div>
            </AppLayout>
        );
    }

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
                                    <CardTitle className="text-sm">Attitré ({assignedPanelCount})</CardTitle>
                                </div>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder="Rechercher dans attitré"
                                            className="h-9 pl-9 text-sm"
                                        />
                                    </div>
                                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                                        {(['notification', 'critical', 'warning', 'info', 'all'] as Severity[]).map((value) => (
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
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 p-3 pt-1">
                                {mergedAssignedTickets.length === 0 && filteredAssignedCommandes.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                                        Aucun element attitre ne correspond a la recherche actuelle.
                                    </div>
                                ) : (
                                    <>
                                        {mergedAssignedTickets.map((ticket) =>
                                            renderTicketCard(ticket, true, mentionOutsideTicketIds.has(ticket.id), commandOutsideTicketIds.has(ticket.id)),
                                        )}
                                        {filteredAssignedCommandes.map((item) => renderCommandeCard(item, true))}
                                    </>
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
                        <div className="mx-auto grid w-full max-w-md grid-cols-5 gap-2">
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
                            <Link href="/dashboard?severity=notification" className={mobileNavItemClass(currentUrl.includes('severity=notification'))}>
                                <span className="relative inline-flex">
                                    <Bell className="h-4 w-4" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </span>
                                    )}
                                </span>
                                Notifications
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
                                <CardTitle className={sectionTitleClass}>Attitré ({assignedPanelCount})</CardTitle>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Rechercher dans attitré"
                                        className="pl-9"
                                    />
                                </div>
                                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                                    {(['notification', 'critical', 'warning', 'info', 'all'] as Severity[]).map((value) => (
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
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {mergedAssignedTickets.length === 0 && filteredAssignedCommandes.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                                    Aucun element attitre ne correspond a votre recherche.
                                </div>
                            ) : (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {mergedAssignedTickets.map((ticket) =>
                                        renderTicketCard(ticket, false, mentionOutsideTicketIds.has(ticket.id), commandOutsideTicketIds.has(ticket.id)),
                                    )}
                                    {filteredAssignedCommandes.map((item) => renderCommandeCard(item, false))}
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
