import { formatMinutes } from '@/components/remote-subscription-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateFr } from '@/lib/datetime';
import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import React from 'react';

export type TimePurchaseRow = {
    id: number;
    purchased_on: string | null;
    minutes: number;
    price: string | null;
    note: string | null;
    recorded_by: string | null;
};

const quickHours = [1, 2, 5, 10];

const today = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
};

const emptyPurchase = () => ({
    purchased_on: today(),
    hours: '',
    price: '',
    note: '',
});

export function RemoteTimePurchases({
    subscriptionId,
    purchases,
}: {
    subscriptionId: number;
    purchases: TimePurchaseRow[];
}) {
    const [form, setForm] = React.useState(emptyPurchase);
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [saving, setSaving] = React.useState(false);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        router.post(
            `/remote-subscriptions/${subscriptionId}/time-purchases`,
            {
                purchased_on: form.purchased_on,
                minutes:
                    Math.round(
                        (Number(form.hours.replace(',', '.')) || 0) * 60,
                    ) || null,
                price: form.price ? form.price.replace(',', '.') : null,
                note: form.note || null,
            },
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => {
                    setErrors({});
                    setForm(emptyPurchase());
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    const remove = (purchase: TimePurchaseRow) => {
        if (
            !window.confirm(
                `Supprimer cet ajout de ${formatMinutes(purchase.minutes)} ? Le temps sera retiré du solde.`,
            )
        ) {
            return;
        }

        router.delete(
            `/remote-subscriptions/${subscriptionId}/time-purchases/${purchase.id}`,
            { preserveScroll: true },
        );
    };

    const error = (key: string) =>
        errors[key] ? (
            <p className="text-sm text-destructive">{errors[key]}</p>
        ) : null;

    return (
        <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-1">
                <CardHeader>
                    <CardTitle>Ajouter des heures</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="purchase-hours">
                                Heures achetées *
                            </Label>
                            <Input
                                id="purchase-hours"
                                inputMode="decimal"
                                value={form.hours}
                                onChange={(e) =>
                                    setForm({ ...form, hours: e.target.value })
                                }
                                placeholder="Ex. 2 ou 1,5"
                            />
                            <div className="flex flex-wrap gap-1">
                                {quickHours.map((hours) => (
                                    <Button
                                        key={hours}
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() =>
                                            setForm({
                                                ...form,
                                                hours: String(hours),
                                            })
                                        }
                                    >
                                        {hours} h
                                    </Button>
                                ))}
                            </div>
                            {error('minutes')}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="purchase-date">Date *</Label>
                                <Input
                                    id="purchase-date"
                                    type="date"
                                    value={form.purchased_on}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            purchased_on: e.target.value,
                                        })
                                    }
                                />
                                {error('purchased_on')}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="purchase-price">
                                    Montant payé (€)
                                </Label>
                                <Input
                                    id="purchase-price"
                                    inputMode="decimal"
                                    value={form.price}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            price: e.target.value,
                                        })
                                    }
                                />
                                {error('price')}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="purchase-note">Note</Label>
                            <Input
                                id="purchase-note"
                                value={form.note}
                                onChange={(e) =>
                                    setForm({ ...form, note: e.target.value })
                                }
                                placeholder="Ex. facture n°..."
                            />
                            {error('note')}
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={saving}
                        >
                            Ajouter au solde
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="xl:col-span-2">
                <CardHeader>
                    <CardTitle>Heures achetées ({purchases.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {purchases.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                            Aucune heure supplémentaire achetée.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {purchases.map((purchase) => (
                                <div
                                    key={purchase.id}
                                    className="flex items-start gap-3 px-4 py-3"
                                >
                                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                                +
                                                {formatMinutes(
                                                    purchase.minutes,
                                                )}
                                            </span>
                                            <span className="text-muted-foreground">
                                                le{' '}
                                                {formatDateFr(
                                                    purchase.purchased_on,
                                                )}
                                            </span>
                                            {purchase.price && (
                                                <span className="text-muted-foreground">
                                                    · {purchase.price} €
                                                </span>
                                            )}
                                            {purchase.recorded_by && (
                                                <span className="text-xs text-muted-foreground">
                                                    · {purchase.recorded_by}
                                                </span>
                                            )}
                                        </div>
                                        {purchase.note && (
                                            <p className="text-muted-foreground">
                                                {purchase.note}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(purchase)}
                                        aria-label="Supprimer l'ajout d'heures"
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
    );
}
