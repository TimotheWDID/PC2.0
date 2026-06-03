import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Ticket, ArrowUpDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { formatDateTimeFr } from '@/lib/datetime';

// Fonction pour traduire les statuts en français
const translateStatus = (status: string): string => {
    const translations: Record<string, string> = {
        'open': 'Ouvert',
        'in_progress': 'En cours',
        'pending': 'En attente',
        'resolved': 'Résolu',
        'closed': 'Fermé',
    };
    return translations[status] || status;
};

// Fonction pour traduire les priorités en français
const translatePriority = (priority: string): string => {
    const translations: Record<string, string> = {
        'low': 'Basse',
        'medium': 'Moyenne',
        'high': 'Haute',
    };
    return translations[priority] || priority;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

export default function Dashboard({ stats, openTickets, userTickets, userStats }: { stats?: { total?: number; open?: number; pending?: number; in_progress?: number; closed?: number }; openTickets?: any[]; userTickets?: any[]; userStats?: { total?: number; open?: number; closed?: number } }) {
    // fallback values (useful if server controller doesn't provide props yet)
    const s = {
        total: stats?.total ?? 0,
        open: stats?.open ?? 0,
        pending: stats?.pending ?? 0,
        in_progress: stats?.in_progress ?? 0,
        closed: stats?.closed ?? 0,
    };

    const tickets = openTickets ?? [];
    const myTickets = userTickets ?? [];
    const myStats = userStats ?? { total: 0, open: 0, closed: 0 };

    // States for sorting and filtering
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<'id' | 'title' | 'status' | 'created_at'>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // If the current user is not an agent, render a blank dashboard (no info)
    // to match the requirement that non-agent users see an empty UI for now.
    const page = usePage();
    const user = (page.props as any).auth?.user ?? null;
    const isAgent = !!user?.agent;

    const handleSort = (field: 'id' | 'title' | 'status' | 'created_at') => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const filteredAndSortedTickets = useMemo(() => {
        let result = [...tickets];

        // Filter by search query
        if (searchQuery) {
            result = result.filter(t =>
                t.id.toString().includes(searchQuery.toLowerCase()) ||
                (t.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.status ?? '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Sort
        result.sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];

            if (sortField === 'id') {
                aValue = parseInt(aValue);
                bValue = parseInt(bValue);
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [tickets, searchQuery, sortField, sortDirection]);

    const filteredAndSortedMyTickets = useMemo(() => {
        let result = [...myTickets];

        // Filter by search query
        if (searchQuery) {
            result = result.filter(t =>
                t.id.toString().includes(searchQuery.toLowerCase()) ||
                (t.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.status ?? '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Sort
        result.sort((a, b) => {
            let aValue = a[sortField];
            let bValue = b[sortField];

            if (sortField === 'id') {
                aValue = parseInt(aValue);
                bValue = parseInt(bValue);
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [myTickets, searchQuery, sortField, sortDirection]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tableau de bord" />

            {isAgent ? (
                <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                    <div className="grid auto-rows-min gap-4 md:grid-cols-4">
                        <Card className="relative overflow-hidden">
                            <CardHeader>
                                <CardTitle>Tickets ouverts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-semibold">{s.open}</div>
                                    <Badge variant="default">Ouverts</Badge>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">Tickets actuellement ouverts.</p>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden">
                            <CardHeader>
                                <CardTitle>En attente</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-semibold">{s.pending}</div>
                                    <Badge variant="secondary">En attente</Badge>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">Tickets en attente de traitement.</p>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden">
                            <CardHeader>
                                <CardTitle>En cours</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-semibold">{s.in_progress}</div>
                                    <Badge variant="default">En cours</Badge>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">Tickets en cours de traitement.</p>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden">
                            <CardHeader>
                                <CardTitle>Tickets fermés</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-semibold">{s.closed}</div>
                                    <Badge variant="outline">Fermés</Badge>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">Tickets résolus ou fermés.</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="relative flex-1 overflow-hidden">
                        <Card>
                            <CardHeader className="space-y-4">
                                <CardTitle>Tickets ouverts</CardTitle>
                                <Input
                                    placeholder="Rechercher par ID, sujet ou statut..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="max-w-sm"
                                />
                            </CardHeader>
                            <CardContent>
                                {filteredAndSortedTickets.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">
                                        {searchQuery ? 'Aucun ticket trouvé.' : 'Aucun ticket ouvert pour le moment.'}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full table-auto">
                                            <thead>
                                                <tr className="text-left text-sm text-muted-foreground">
                                                    <th className="pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('id')}>
                                                        <div className="flex items-center gap-1">
                                                            ID <ArrowUpDown className="h-3 w-3" />
                                                        </div>
                                                    </th>
                                                    <th className="pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('title')}>
                                                        <div className="flex items-center gap-1">
                                                            Sujet <ArrowUpDown className="h-3 w-3" />
                                                        </div>
                                                    </th>
                                                    <th className="pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
                                                        <div className="flex items-center gap-1">
                                                            Statut <ArrowUpDown className="h-3 w-3" />
                                                        </div>
                                                    </th>
                                                    <th className="pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('created_at')}>
                                                        <div className="flex items-center gap-1">
                                                            Créé le <ArrowUpDown className="h-3 w-3" />
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAndSortedTickets.map((t: any) => (
                                                    <tr key={t.id} className="border-t cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = `/tickets/${t.id}`}>
                                                        <td className="py-3 pr-4">{t.id}</td>
                                                        <td className="py-3 pr-4">{t.title ?? '-'}</td>
                                                        <td className="py-3 pr-4"><Badge variant={t.status === 'open' ? 'destructive' : t.status === 'in_progress' ? 'default' : t.status === 'pending' ? 'secondary' : 'outline'}>{translateStatus(t.status ?? '-')}</Badge></td>
                                                        <td className="py-3 pr-4">{formatDateTimeFr(t.created_at, { timeZone: 'Europe/Paris' })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                // Dashboard for non-agent users with their tickets
                <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                    <div className="text-center space-y-2 mb-4">
                        <h2 className="text-2xl font-bold">Mes Tickets</h2>
                        <p className="text-muted-foreground">Consultez et gérez vos demandes de support</p>
                    </div>

                    {/* User Stats */}
                    <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Tickets ouverts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-semibold">{myStats.open}</div>
                                    <Badge variant="destructive">Ouverts</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Total</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-semibold">{myStats.total}</div>
                                    <Badge variant="secondary">Tous</Badge>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tickets fermés</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="text-3xl font-semibold">{myStats.closed}</div>
                                    <Badge variant="outline">Fermés</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Create Ticket Button */}
                    <div className="flex justify-center py-4">
                        <Link href="/tickets/create">
                            <Button size="lg">
                                <Plus className="mr-2 h-5 w-5" />
                                Créer un nouveau ticket
                            </Button>
                        </Link>
                    </div>

                    {/* User Tickets List */}
                    <Card className="flex-1">
                        <CardHeader className="space-y-4">
                            <CardTitle>Mes tickets récents</CardTitle>
                            <Input
                                placeholder="Rechercher par ID, sujet ou statut..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="max-w-sm"
                            />
                        </CardHeader>
                        <CardContent>
                            {filteredAndSortedMyTickets.length === 0 && !searchQuery ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="rounded-full bg-muted p-6">
                                        <Ticket className="h-12 w-12 text-muted-foreground" />
                                    </div>
                                    <p className="text-center text-muted-foreground">
                                        Vous n'avez pas encore créé de ticket.
                                    </p>
                                    <Link href="/tickets/create">
                                        <Button variant="outline">
                                            <Plus className="mr-2 h-4 w-4" />
                                            Créer mon premier ticket
                                        </Button>
                                    </Link>
                                </div>
                            ) : filteredAndSortedMyTickets.length === 0 ? (
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                    Aucun ticket trouvé.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full table-auto">
                                        <thead>
                                            <tr className="text-left text-sm text-muted-foreground">
                                                <th className="pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('id')}>
                                                    <div className="flex items-center gap-1">
                                                        ID <ArrowUpDown className="h-3 w-3" />
                                                    </div>
                                                </th>
                                                <th className="pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('title')}>
                                                    <div className="flex items-center gap-1">
                                                        Sujet <ArrowUpDown className="h-3 w-3" />
                                                    </div>
                                                </th>
                                                <th className="pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
                                                    <div className="flex items-center gap-1">
                                                        Statut <ArrowUpDown className="h-3 w-3" />
                                                    </div>
                                                </th>
                                                <th className="pb-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('created_at')}>
                                                    <div className="flex items-center gap-1">
                                                        Créé le <ArrowUpDown className="h-3 w-3" />
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAndSortedMyTickets.map((t: any) => (
                                                <tr key={t.id} className="border-t cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = `/tickets/${t.id}`}>
                                                    <td className="py-3 pr-4">{t.id}</td>
                                                    <td className="py-3 pr-4">{t.title ?? '-'}</td>
                                                    <td className="py-3 pr-4">
                                                        <Badge variant={t.status === 'open' ? 'destructive' : t.status === 'in_progress' ? 'default' : t.status === 'pending' ? 'secondary' : 'outline'}>
                                                            {translateStatus(t.status ?? '-')}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 pr-4">{formatDateTimeFr(t.created_at, { timeZone: 'Europe/Paris' })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </AppLayout>
    );
}
