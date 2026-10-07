import Heading from '@/components/heading';
import MobileNativeNav from '@/components/mobile-native-nav';
import {
    emptySubscriptionForm,
    formatMinutes,
    formToPayload,
    RemainingTimeBar,
    RemoteSubscriptionFields,
    subscriptionStatusLabels,
    type RemoteSubscriptionRow,
    type SubscriptionFormData,
} from '@/components/remote-subscription-form';
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
import AppLayout from '@/layouts/app-layout';
import { formatDateFr } from '@/lib/datetime';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import React from 'react';

type ClientOption = {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Abonnements NinjaOne', href: '/remote-subscriptions' },
];

const clientName = (client: ClientOption) =>
    `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() ||
    client.email ||
    `#${client.id}`;

function StatusBadge({
    subscription,
}: {
    subscription: RemoteSubscriptionRow;
}) {
    if (subscription.status === 'active' && subscription.is_expired) {
        return <Badge variant="destructive">Expiré</Badge>;
    }

    return (
        <Badge
            variant={subscription.status === 'active' ? 'default' : 'outline'}
        >
            {subscriptionStatusLabels[subscription.status] ??
                subscription.status}
        </Badge>
    );
}

export default function RemoteSubscriptionsIndex({
    subscriptions,
    users,
    filters,
}: {
    subscriptions: RemoteSubscriptionRow[];
    users: ClientOption[];
    filters: { q?: string; status?: string };
}) {
    const [q, setQ] = React.useState(filters.q ?? '');
    const [status, setStatus] = React.useState(filters.status || 'all');

    const [createOpen, setCreateOpen] = React.useState(false);
    const [clientQuery, setClientQuery] = React.useState('');
    const [clientId, setClientId] = React.useState<number | null>(null);
    const [form, setForm] = React.useState<SubscriptionFormData>(
        emptySubscriptionForm(),
    );
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [processing, setProcessing] = React.useState(false);

    const selectedClient = users.find((user) => user.id === clientId) ?? null;
    const matchingClients = React.useMemo(() => {
        const needle = clientQuery.trim().toLowerCase();
        if (!needle) return [];

        return users
            .filter((user) =>
                `${clientName(user)} ${user.email ?? ''}`
                    .toLowerCase()
                    .includes(needle),
            )
            .slice(0, 8);
    }, [users, clientQuery]);

    const totals = React.useMemo(() => {
        const active = subscriptions.filter(
            (subscription) => subscription.status === 'active',
        );

        return {
            active: active.length,
            remaining: active.reduce(
                (sum, subscription) =>
                    sum + Math.max(subscription.remaining_minutes, 0),
                0,
            ),
            overrun: active.filter(
                (subscription) => subscription.remaining_minutes < 0,
            ).length,
        };
    }, [subscriptions]);

    const applyFilters = (next?: Partial<{ q: string; status: string }>) => {
        const payload = { q, status, ...next };

        router.get(
            '/remote-subscriptions',
            {
                q: payload.q || undefined,
                status: payload.status !== 'all' ? payload.status : undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        router.post(
            '/remote-subscriptions',
            { user_id: clientId, ...formToPayload(form) },
            {
                onError: (nextErrors) => setErrors(nextErrors),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const openCreate = () => {
        setForm(emptySubscriptionForm());
        setClientId(null);
        setClientQuery('');
        setErrors({});
        setCreateOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Abonnements NinjaOne" />
            <div className="w-full space-y-4 py-2 sm:py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        title="Abonnements NinjaOne"
                        description="Clients sous contrat de télémaintenance, temps restant et interventions à distance"
                    />
                    <Button type="button" onClick={openCreate}>
                        <Plus className="h-4 w-4" />
                        Nouvel abonnement
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Abonnements actifs
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">
                                {totals.active}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Temps restant cumulé
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">
                                {formatMinutes(totals.remaining)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Forfaits dépassés
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">
                                {totals.overrun}
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
                                    placeholder="Client, email, formule, référence NinjaOne..."
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
                                        {Object.entries(
                                            subscriptionStatusLabels,
                                        ).map(([value, label]) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </SelectItem>
                                        ))}
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
                        <CardTitle>
                            Abonnements ({subscriptions.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {subscriptions.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                Aucun abonnement pour le moment.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {subscriptions.map((subscription) => (
                                    <Link
                                        key={subscription.id}
                                        href={`/remote-subscriptions/${subscription.id}`}
                                        className="grid gap-3 px-4 py-3 hover:bg-muted/50 md:grid-cols-[2fr_1fr_2fr_1fr] md:items-center"
                                    >
                                        <div>
                                            <p className="font-medium">
                                                {subscription.user?.name ||
                                                    subscription.user?.email ||
                                                    '-'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {subscription.plan}
                                                {subscription.ninjaone_reference
                                                    ? ` · ${subscription.ninjaone_reference}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div>
                                            <StatusBadge
                                                subscription={subscription}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs">
                                                <span
                                                    className={
                                                        subscription.remaining_minutes <
                                                        0
                                                            ? 'font-medium text-red-600'
                                                            : 'font-medium'
                                                    }
                                                >
                                                    {subscription.remaining_minutes <
                                                    0
                                                        ? `Dépassé de ${formatMinutes(-subscription.remaining_minutes)}`
                                                        : `${formatMinutes(subscription.remaining_minutes)} restant`}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {formatMinutes(
                                                        subscription.used_minutes,
                                                    )}{' '}
                                                    /{' '}
                                                    {formatMinutes(
                                                        subscription.included_minutes,
                                                    )}
                                                </span>
                                            </div>
                                            <RemainingTimeBar
                                                included={
                                                    subscription.included_minutes
                                                }
                                                used={subscription.used_minutes}
                                            />
                                        </div>
                                        <div className="text-xs text-muted-foreground md:text-right">
                                            {subscription.ends_on
                                                ? `Fin ${formatDateFr(subscription.ends_on)}`
                                                : 'Sans échéance'}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Nouvel abonnement NinjaOne</DialogTitle>
                        <DialogDescription>
                            Associez un client à sa formule et à son temps
                            d'intervention inclus.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="client-search">Client *</Label>
                            {selectedClient ? (
                                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                    <div>
                                        <p className="font-medium">
                                            {clientName(selectedClient)}
                                        </p>
                                        {selectedClient.email && (
                                            <p className="text-xs text-muted-foreground">
                                                {selectedClient.email}
                                            </p>
                                        )}
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
                                        placeholder="Rechercher un client par nom ou email..."
                                        value={clientQuery}
                                        onChange={(e) =>
                                            setClientQuery(e.target.value)
                                        }
                                    />
                                    {matchingClients.length > 0 && (
                                        <div className="max-h-56 overflow-y-auto rounded-md border">
                                            {matchingClients.map((user) => (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setClientId(user.id)
                                                    }
                                                    className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                                                >
                                                    <p className="font-medium">
                                                        {clientName(user)}
                                                    </p>
                                                    {user.email && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {user.email}
                                                        </p>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                            {errors.user_id && (
                                <p className="text-sm text-destructive">
                                    {errors.user_id}
                                </p>
                            )}
                        </div>

                        <RemoteSubscriptionFields
                            data={form}
                            setData={(key, value) =>
                                setForm((current) => ({
                                    ...current,
                                    [key]: value,
                                }))
                            }
                            errors={errors}
                        />

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" disabled={processing}>
                                Créer l'abonnement
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            <MobileNativeNav showFab={false} />
        </AppLayout>
    );
}
