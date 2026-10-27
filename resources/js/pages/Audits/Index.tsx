import Heading from '@/components/heading';
import MobileNativeNav from '@/components/mobile-native-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { formatDateFr } from '@/lib/datetime';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Building2, Plus, User } from 'lucide-react';
import React from 'react';

type ClientOption = {
    id: number;
    name: string;
    client_type: 'person' | 'company';
    email: string | null;
};

export type AuditRow = {
    id: number;
    title: string;
    status: string;
    status_label: string;
    site_name: string | null;
    client: { id: number; name: string; client_type: string } | null;
    technician: string | null;
    created_at: string | null;
    updated_at: string | null;
    completed_at: string | null;
    url: string;
    devices_count: number;
    diagnosed_count: number;
    network_scans_count: number;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Audits', href: '/audits' }];

export function AuditStatusBadge({
    status,
    label,
}: {
    status: string;
    label: string;
}) {
    return (
        <Badge
            variant={
                status === 'in_progress'
                    ? 'default'
                    : status === 'done'
                      ? 'secondary'
                      : 'outline'
            }
        >
            {label}
        </Badge>
    );
}

export default function AuditsIndex({
    audits,
    clients,
    statuses,
    filters,
    defaultClientId,
}: {
    audits: AuditRow[];
    clients: ClientOption[];
    statuses: Record<string, string>;
    filters: { q?: string; status?: string };
    defaultClientId: number | null;
}) {
    const [q, setQ] = React.useState(filters.q ?? '');
    const [status, setStatus] = React.useState(filters.status || 'all');

    const [createOpen, setCreateOpen] = React.useState(!!defaultClientId);
    const [clientQuery, setClientQuery] = React.useState('');
    const [clientId, setClientId] = React.useState<number | null>(
        defaultClientId,
    );
    const [title, setTitle] = React.useState('');
    const [siteName, setSiteName] = React.useState('');
    const [notes, setNotes] = React.useState('');
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [processing, setProcessing] = React.useState(false);

    const selectedClient = clients.find((c) => c.id === clientId) ?? null;
    const matchingClients = React.useMemo(() => {
        const needle = clientQuery.trim().toLowerCase();
        if (!needle) return [];

        return clients
            .filter((c) =>
                `${c.name} ${c.email ?? ''}`.toLowerCase().includes(needle),
            )
            .slice(0, 8);
    }, [clients, clientQuery]);

    const totals = React.useMemo(
        () => ({
            open: audits.filter((a) => a.status !== 'done').length,
            devices: audits
                .filter((a) => a.status !== 'done')
                .reduce((sum, a) => sum + a.devices_count, 0),
            todo: audits
                .filter((a) => a.status !== 'done')
                .reduce(
                    (sum, a) => sum + (a.devices_count - a.diagnosed_count),
                    0,
                ),
        }),
        [audits],
    );

    const applyFilters = (next?: Partial<{ q: string; status: string }>) => {
        const payload = { q, status, ...next };
        router.get(
            '/audits',
            {
                q: payload.q || undefined,
                status: payload.status !== 'all' ? payload.status : undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const openCreate = () => {
        setClientId(null);
        setClientQuery('');
        setTitle('');
        setSiteName('');
        setNotes('');
        setErrors({});
        setCreateOpen(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        router.post(
            '/audits',
            {
                user_id: clientId,
                title:
                    title.trim() ||
                    `Audit ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
                site_name: siteName || null,
                notes: notes || null,
            },
            {
                onError: (nextErrors) => setErrors(nextErrors),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Audits" />
            <div className="w-full space-y-4 py-2 sm:py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        title="Audits"
                        description="Audit complet d'une entreprise ou d'un client : scan du réseau, appareils et diagnostic PC2 Diag de chaque PC"
                    />
                    <Button type="button" onClick={openCreate}>
                        <Plus className="h-4 w-4" />
                        Nouvel audit
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Audits en cours
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">
                                {totals.open}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Appareils audités
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">
                                {totals.devices}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Restant à diagnostiquer
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p
                                className={`text-2xl font-semibold ${totals.todo > 0 ? 'text-amber-600' : ''}`}
                            >
                                {totals.todo}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardContent className="pt-6">
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="md:col-span-2">
                                <Label>Recherche</Label>
                                <Input
                                    placeholder="Client, titre, site..."
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') applyFilters();
                                    }}
                                />
                            </div>
                            <div>
                                <Label>Statut</Label>
                                <Select
                                    value={status}
                                    onValueChange={(value) => {
                                        setStatus(value);
                                        applyFilters({ status: value });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Tous
                                        </SelectItem>
                                        {Object.entries(statuses).map(
                                            ([value, label]) => (
                                                <SelectItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => applyFilters()}
                                >
                                    Rechercher
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Audits ({audits.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {audits.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                Aucun audit pour le moment. Créez-en un, puis
                                choisissez-le dans PC2 Diag (bouton « Audit »)
                                sur chaque PC du client.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {audits.map((audit) => (
                                    <Link
                                        key={audit.id}
                                        href={audit.url}
                                        className="grid gap-3 px-4 py-3 hover:bg-muted/50 md:grid-cols-[2fr_1fr_1.5fr_1fr] md:items-center"
                                    >
                                        <div className="min-w-0">
                                            <p className="flex items-center gap-1.5 font-medium">
                                                {audit.client?.client_type ===
                                                'company' ? (
                                                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                ) : (
                                                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                )}
                                                <span className="truncate">
                                                    {audit.client?.name ?? '-'}
                                                </span>
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {audit.title}
                                                {audit.site_name
                                                    ? ` · ${audit.site_name}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div>
                                            <AuditStatusBadge
                                                status={audit.status}
                                                label={audit.status_label}
                                            />
                                        </div>
                                        <div className="text-sm">
                                            {audit.diagnosed_count} /{' '}
                                            {audit.devices_count} appareil
                                            {audit.devices_count > 1
                                                ? 's'
                                                : ''}{' '}
                                            diagnostiqué
                                            {audit.diagnosed_count > 1
                                                ? 's'
                                                : ''}
                                            <span className="block text-xs text-muted-foreground">
                                                {audit.network_scans_count} scan
                                                {audit.network_scans_count > 1
                                                    ? 's'
                                                    : ''}{' '}
                                                réseau
                                            </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground md:text-right">
                                            {audit.completed_at
                                                ? `Terminé le ${formatDateFr(audit.completed_at)}`
                                                : `Créé le ${formatDateFr(audit.created_at)}`}
                                            {audit.technician
                                                ? ` · ${audit.technician}`
                                                : ''}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Nouvel audit</DialogTitle>
                        <DialogDescription>
                            Choisissez l'entreprise ou le client audité. Les
                            appareils s'ajoutent ensuite depuis PC2 Diag (scan
                            réseau, diagnostic de chaque PC) ou à la main.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="client-search">Client *</Label>
                            {selectedClient ? (
                                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                    <div>
                                        <p className="font-medium">
                                            {selectedClient.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedClient.client_type ===
                                            'company'
                                                ? 'Entreprise'
                                                : 'Particulier'}
                                            {selectedClient.email
                                                ? ` · ${selectedClient.email}`
                                                : ''}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setClientId(null)}
                                    >
                                        Changer
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <Input
                                        id="client-search"
                                        placeholder="Rechercher une entreprise ou un client..."
                                        value={clientQuery}
                                        onChange={(e) =>
                                            setClientQuery(e.target.value)
                                        }
                                    />
                                    {matchingClients.length > 0 && (
                                        <div className="max-h-56 overflow-y-auto rounded-md border">
                                            {matchingClients.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setClientId(c.id)
                                                    }
                                                    className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                                                >
                                                    {c.client_type ===
                                                    'company' ? (
                                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                                    ) : (
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                    <span>
                                                        <span className="block font-medium">
                                                            {c.name}
                                                        </span>
                                                        {c.email && (
                                                            <span className="block text-xs text-muted-foreground">
                                                                {c.email}
                                                            </span>
                                                        )}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Client absent ?{' '}
                                        <Link
                                            href="/users/create?type=company"
                                            className="underline"
                                        >
                                            Créer une entreprise
                                        </Link>{' '}
                                        ou{' '}
                                        <Link
                                            href="/users/create"
                                            className="underline"
                                        >
                                            un client
                                        </Link>
                                        .
                                    </p>
                                </>
                            )}
                            {errors.user_id && (
                                <p className="text-sm text-destructive">
                                    {errors.user_id}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="audit-title">Titre</Label>
                            <Input
                                id="audit-title"
                                placeholder="Audit du parc informatique"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            {errors.title && (
                                <p className="text-sm text-destructive">
                                    {errors.title}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="audit-site">
                                Site (facultatif)
                            </Label>
                            <Input
                                id="audit-site"
                                placeholder="Agence de Lyon, siège…"
                                value={siteName}
                                onChange={(e) => setSiteName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="audit-notes">Notes</Label>
                            <Textarea
                                id="audit-notes"
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                disabled={processing || !clientId}
                            >
                                Créer l'audit
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            <MobileNativeNav showFab={false} />
        </AppLayout>
    );
}
