import Heading from '@/components/heading';
import MobileNativeNav from '@/components/mobile-native-nav';
import {
    formatMinutes,
    formToPayload,
    RemainingTimeBar,
    RemoteSubscriptionFields,
    subscriptionStatusLabels,
    subscriptionToForm,
    type RemoteSubscriptionRow,
    type SubscriptionFormData,
} from '@/components/remote-subscription-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatDateFr, formatDateTimeFr } from '@/lib/datetime';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import React from 'react';

type InterventionRow = {
    id: number;
    performed_at: string | null;
    duration_minutes: number;
    description: string;
    technician: string | null;
    ticket: { id: number; title: string } | null;
};

type TicketOption = { id: number; title: string; status: string };

const quickDurations = [15, 30, 45, 60, 90, 120];

const nowForInput = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
};

const emptyIntervention = () => ({
    performed_at: nowForInput(),
    duration_minutes: '',
    description: '',
    ticket_id: 'none',
});

export default function RemoteSubscriptionShow({
    subscription,
    interventions,
    tickets,
}: {
    subscription: RemoteSubscriptionRow;
    interventions: InterventionRow[];
    tickets: TicketOption[];
}) {
    const clientLabel =
        subscription.user?.name || subscription.user?.email || 'Client';

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Abonnements NinjaOne', href: '/remote-subscriptions' },
        {
            title: clientLabel,
            href: `/remote-subscriptions/${subscription.id}`,
        },
    ];

    const [editing, setEditing] = React.useState(false);
    const [form, setForm] = React.useState<SubscriptionFormData>(() =>
        subscriptionToForm(subscription),
    );
    const [formErrors, setFormErrors] = React.useState<Record<string, string>>(
        {},
    );

    const [intervention, setIntervention] = React.useState(emptyIntervention);
    const [interventionErrors, setInterventionErrors] = React.useState<
        Record<string, string>
    >({});
    const [saving, setSaving] = React.useState(false);

    const remaining = subscription.remaining_minutes;

    const submitUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        router.patch(
            `/remote-subscriptions/${subscription.id}`,
            formToPayload(form),
            {
                preserveScroll: true,
                onError: (errors) => setFormErrors(errors),
                onSuccess: () => {
                    setFormErrors({});
                    setEditing(false);
                },
            },
        );
    };

    const submitIntervention = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const performedAt = new Date(intervention.performed_at);

        router.post(
            `/remote-subscriptions/${subscription.id}/interventions`,
            {
                performed_at: Number.isNaN(performedAt.getTime())
                    ? intervention.performed_at
                    : performedAt.toISOString(),
                duration_minutes: Number(intervention.duration_minutes) || null,
                description: intervention.description,
                ticket_id:
                    intervention.ticket_id !== 'none'
                        ? Number(intervention.ticket_id)
                        : null,
            },
            {
                preserveScroll: true,
                onError: (errors) => setInterventionErrors(errors),
                onSuccess: () => {
                    setInterventionErrors({});
                    setIntervention(emptyIntervention());
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    const deleteIntervention = (row: InterventionRow) => {
        if (
            !window.confirm(
                `Supprimer cette intervention de ${formatMinutes(row.duration_minutes)} ? Le temps sera recrédité.`,
            )
        ) {
            return;
        }

        router.delete(
            `/remote-subscriptions/${subscription.id}/interventions/${row.id}`,
            { preserveScroll: true },
        );
    };

    const deleteSubscription = () => {
        if (
            !window.confirm(
                'Supprimer cet abonnement et tout son historique d’interventions ?',
            )
        ) {
            return;
        }

        router.delete(`/remote-subscriptions/${subscription.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Abonnement NinjaOne · ${clientLabel}`} />
            <div className="space-y-4 py-2 sm:py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        title={clientLabel}
                        description={`${subscription.plan} · ${subscriptionStatusLabels[subscription.status] ?? subscription.status}`}
                    />
                    <div className="flex flex-wrap gap-2">
                        {subscription.user && (
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={`/users/${subscription.user.id}/edit`}
                                >
                                    Fiche client
                                </Link>
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setForm(subscriptionToForm(subscription));
                                setFormErrors({});
                                setEditing((value) => !value);
                            }}
                        >
                            {editing ? 'Fermer' : 'Modifier'}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Temps restant
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <p
                                className={`text-2xl font-semibold ${remaining < 0 ? 'text-red-600' : ''}`}
                            >
                                {remaining < 0
                                    ? `-${formatMinutes(-remaining)}`
                                    : formatMinutes(remaining)}
                            </p>
                            <RemainingTimeBar
                                included={subscription.included_minutes}
                                used={subscription.used_minutes}
                            />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Temps consommé
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">
                                {formatMinutes(subscription.used_minutes)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                sur{' '}
                                {formatMinutes(subscription.included_minutes)}{' '}
                                inclus
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">
                                Interventions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-semibold">
                                {subscription.interventions_count}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Dernière :{' '}
                                {subscription.last_intervention_at
                                    ? formatDateTimeFr(
                                          subscription.last_intervention_at,
                                      )
                                    : 'aucune'}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Période</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            <p className="text-sm">
                                Du {formatDateFr(subscription.started_on)}
                                {subscription.ends_on
                                    ? ` au ${formatDateFr(subscription.ends_on)}`
                                    : ', sans échéance'}
                            </p>
                            {subscription.is_expired && (
                                <Badge variant="destructive">Expiré</Badge>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {editing && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Modifier l'abonnement</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitUpdate} className="space-y-4">
                                <RemoteSubscriptionFields
                                    data={form}
                                    setData={(key, value) =>
                                        setForm((current) => ({
                                            ...current,
                                            [key]: value,
                                        }))
                                    }
                                    errors={formErrors}
                                />
                                <div className="flex flex-wrap justify-between gap-2">
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={deleteSubscription}
                                    >
                                        Supprimer l'abonnement
                                    </Button>
                                    <Button type="submit">Enregistrer</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-4 xl:grid-cols-3">
                    <Card className="xl:col-span-1">
                        <CardHeader>
                            <CardTitle>
                                Nouvelle intervention à distance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={submitIntervention}
                                className="space-y-3"
                            >
                                <div className="space-y-1.5">
                                    <Label htmlFor="performed_at">Date *</Label>
                                    <Input
                                        id="performed_at"
                                        type="datetime-local"
                                        value={intervention.performed_at}
                                        onChange={(e) =>
                                            setIntervention({
                                                ...intervention,
                                                performed_at: e.target.value,
                                            })
                                        }
                                    />
                                    {interventionErrors.performed_at && (
                                        <p className="text-sm text-destructive">
                                            {interventionErrors.performed_at}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="duration_minutes">
                                        Durée (minutes) *
                                    </Label>
                                    <Input
                                        id="duration_minutes"
                                        type="number"
                                        min={1}
                                        value={intervention.duration_minutes}
                                        onChange={(e) =>
                                            setIntervention({
                                                ...intervention,
                                                duration_minutes:
                                                    e.target.value,
                                            })
                                        }
                                    />
                                    <div className="flex flex-wrap gap-1">
                                        {quickDurations.map((minutes) => (
                                            <Button
                                                key={minutes}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() =>
                                                    setIntervention({
                                                        ...intervention,
                                                        duration_minutes:
                                                            String(minutes),
                                                    })
                                                }
                                            >
                                                {formatMinutes(minutes)}
                                            </Button>
                                        ))}
                                    </div>
                                    {interventionErrors.duration_minutes && (
                                        <p className="text-sm text-destructive">
                                            {
                                                interventionErrors.duration_minutes
                                            }
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Ticket lié</Label>
                                    <Select
                                        value={intervention.ticket_id}
                                        onValueChange={(value) =>
                                            setIntervention({
                                                ...intervention,
                                                ticket_id: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">
                                                Aucun
                                            </SelectItem>
                                            {tickets.map((ticket) => (
                                                <SelectItem
                                                    key={ticket.id}
                                                    value={String(ticket.id)}
                                                >
                                                    #{ticket.id} {ticket.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {interventionErrors.ticket_id && (
                                        <p className="text-sm text-destructive">
                                            {interventionErrors.ticket_id}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="description">
                                        Travail effectué *
                                    </Label>
                                    <Textarea
                                        id="description"
                                        rows={4}
                                        value={intervention.description}
                                        onChange={(e) =>
                                            setIntervention({
                                                ...intervention,
                                                description: e.target.value,
                                            })
                                        }
                                        placeholder="Ex. Mise à jour Windows, nettoyage des programmes au démarrage..."
                                    />
                                    {interventionErrors.description && (
                                        <p className="text-sm text-destructive">
                                            {interventionErrors.description}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={saving}
                                >
                                    Enregistrer l'intervention
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="xl:col-span-2">
                        <CardHeader>
                            <CardTitle>
                                Historique des interventions (
                                {interventions.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {interventions.length === 0 ? (
                                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                    Aucune intervention enregistrée.
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {interventions.map((row) => (
                                        <div
                                            key={row.id}
                                            className="flex items-start gap-3 px-4 py-3"
                                        >
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                                    <span className="font-medium">
                                                        {formatDateTimeFr(
                                                            row.performed_at,
                                                        )}
                                                    </span>
                                                    <Badge variant="outline">
                                                        {formatMinutes(
                                                            row.duration_minutes,
                                                        )}
                                                    </Badge>
                                                    {row.technician && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {row.technician}
                                                        </span>
                                                    )}
                                                    {row.ticket && (
                                                        <Link
                                                            href={`/tickets/${row.ticket.id}`}
                                                            className="text-xs text-primary underline-offset-2 hover:underline"
                                                        >
                                                            Ticket #
                                                            {row.ticket.id}
                                                        </Link>
                                                    )}
                                                </div>
                                                <p className="text-sm whitespace-pre-line text-muted-foreground">
                                                    {row.description}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    deleteIntervention(row)
                                                }
                                                aria-label="Supprimer l'intervention"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {(subscription.ninjaone_reference ||
                    subscription.devices_count !== null ||
                    subscription.price ||
                    subscription.notes) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Détails du contrat</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
                            <p>
                                <strong>Référence NinjaOne :</strong>{' '}
                                {subscription.ninjaone_reference || '-'}
                            </p>
                            <p>
                                <strong>Postes couverts :</strong>{' '}
                                {subscription.devices_count ?? '-'}
                            </p>
                            <p>
                                <strong>Prix :</strong>{' '}
                                {subscription.price
                                    ? `${subscription.price} €`
                                    : '-'}
                            </p>
                            {subscription.notes && (
                                <p className="whitespace-pre-line sm:col-span-3">
                                    {subscription.notes}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
            <MobileNativeNav showFab={false} />
        </AppLayout>
    );
}
