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

export type RemoteSubscriptionRow = {
    id: number;
    plan: string;
    status: string;
    started_on: string | null;
    ends_on: string | null;
    is_expired: boolean;
    included_minutes: number;
    used_minutes: number;
    remaining_minutes: number;
    price: string | null;
    devices_count: number | null;
    ninjaone_reference: string | null;
    notes: string | null;
    interventions_count: number;
    last_intervention_at: string | null;
    user: {
        id: number;
        name: string;
        email: string | null;
        phone?: string | null;
    } | null;
};

export type SubscriptionFormData = {
    plan: string;
    status: string;
    started_on: string;
    ends_on: string;
    included_hours: string;
    price: string;
    devices_count: string;
    ninjaone_reference: string;
    notes: string;
};

export const subscriptionStatusLabels: Record<string, string> = {
    active: 'Actif',
    suspended: 'Suspendu',
    ended: 'Terminé',
};

export const formatMinutes = (minutes: number): string => {
    const sign = minutes < 0 ? '-' : '';
    const abs = Math.abs(minutes);
    const hours = Math.floor(abs / 60);
    const rest = abs % 60;

    if (hours === 0) {
        return `${sign}${rest} min`;
    }

    return `${sign}${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}`;
};

export const emptySubscriptionForm = (): SubscriptionFormData => ({
    plan: '',
    status: 'active',
    started_on: new Date().toISOString().slice(0, 10),
    ends_on: '',
    included_hours: '',
    price: '',
    devices_count: '',
    ninjaone_reference: '',
    notes: '',
});

export const subscriptionToForm = (
    subscription: RemoteSubscriptionRow,
): SubscriptionFormData => ({
    plan: subscription.plan,
    status: subscription.status,
    started_on: subscription.started_on ?? '',
    ends_on: subscription.ends_on ?? '',
    included_hours: String(
        Math.round((subscription.included_minutes / 60) * 100) / 100,
    ),
    price: subscription.price ?? '',
    devices_count:
        subscription.devices_count !== null
            ? String(subscription.devices_count)
            : '',
    ninjaone_reference: subscription.ninjaone_reference ?? '',
    notes: subscription.notes ?? '',
});

export const formToPayload = (data: SubscriptionFormData) => ({
    plan: data.plan,
    status: data.status,
    started_on: data.started_on,
    ends_on: data.ends_on || null,
    included_minutes: Math.round(
        (Number(data.included_hours.replace(',', '.')) || 0) * 60,
    ),
    price: data.price ? data.price.replace(',', '.') : null,
    devices_count: data.devices_count ? Number(data.devices_count) : null,
    ninjaone_reference: data.ninjaone_reference || null,
    notes: data.notes || null,
});

export function RemoteSubscriptionFields({
    data,
    setData,
    errors,
}: {
    data: SubscriptionFormData;
    setData: (key: keyof SubscriptionFormData, value: string) => void;
    errors: Partial<Record<string, string>>;
}) {
    const error = (key: string) =>
        errors[key] ? (
            <p className="text-sm text-destructive">{errors[key]}</p>
        ) : null;

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
                <Label htmlFor="plan">Formule *</Label>
                <Input
                    id="plan"
                    value={data.plan}
                    onChange={(e) => setData('plan', e.target.value)}
                    placeholder="Ex. NinjaOne Essentiel"
                />
                {error('plan')}
            </div>
            <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select
                    value={data.status}
                    onValueChange={(value) => setData('status', value)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(subscriptionStatusLabels).map(
                            ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ),
                        )}
                    </SelectContent>
                </Select>
                {error('status')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="started_on">Début *</Label>
                <Input
                    id="started_on"
                    type="date"
                    value={data.started_on}
                    onChange={(e) => setData('started_on', e.target.value)}
                />
                {error('started_on')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="ends_on">Fin / renouvellement</Label>
                <Input
                    id="ends_on"
                    type="date"
                    value={data.ends_on}
                    onChange={(e) => setData('ends_on', e.target.value)}
                />
                {error('ends_on')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="included_hours">
                    Temps d'intervention inclus (heures)
                </Label>
                <Input
                    id="included_hours"
                    inputMode="decimal"
                    value={data.included_hours}
                    onChange={(e) => setData('included_hours', e.target.value)}
                    placeholder="Ex. 5 ou 2,5"
                />
                {error('included_minutes')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="price">Prix (€)</Label>
                <Input
                    id="price"
                    inputMode="decimal"
                    value={data.price}
                    onChange={(e) => setData('price', e.target.value)}
                />
                {error('price')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="devices_count">Postes couverts</Label>
                <Input
                    id="devices_count"
                    type="number"
                    min={0}
                    value={data.devices_count}
                    onChange={(e) => setData('devices_count', e.target.value)}
                />
                {error('devices_count')}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="ninjaone_reference">
                    Référence NinjaOne (organisation)
                </Label>
                <Input
                    id="ninjaone_reference"
                    value={data.ninjaone_reference}
                    onChange={(e) =>
                        setData('ninjaone_reference', e.target.value)
                    }
                />
                {error('ninjaone_reference')}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                    id="notes"
                    value={data.notes}
                    onChange={(e) => setData('notes', e.target.value)}
                    rows={3}
                />
                {error('notes')}
            </div>
        </div>
    );
}

export function RemainingTimeBar({
    included,
    used,
}: {
    included: number;
    used: number;
}) {
    const ratio =
        included > 0 ? Math.min(used / included, 1) : used > 0 ? 1 : 0;
    const remaining = included - used;
    const color =
        remaining < 0
            ? 'bg-red-500'
            : ratio >= 0.8
              ? 'bg-amber-500'
              : 'bg-emerald-500';

    return (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
                className={`h-full ${color}`}
                style={{ width: `${Math.round(ratio * 100)}%` }}
            />
        </div>
    );
}
