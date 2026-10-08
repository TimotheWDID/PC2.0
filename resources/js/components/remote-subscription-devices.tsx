import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Link, router } from '@inertiajs/react';
import { X } from 'lucide-react';
import React from 'react';

export type SubscriptionDevice = {
    id: number;
    display_name: string;
    device_type: string;
    asset_tag: string | null;
    status: string;
};

export function RemoteSubscriptionDevices({
    subscriptionId,
    clientId,
    coveredCount,
    devices,
    availableDevices,
}: {
    subscriptionId: number;
    clientId: number | null;
    coveredCount: number | null;
    devices: SubscriptionDevice[];
    availableDevices: SubscriptionDevice[];
}) {
    const [deviceId, setDeviceId] = React.useState('');

    const attach = () => {
        if (!deviceId) return;

        router.post(
            `/remote-subscriptions/${subscriptionId}/devices`,
            { device_id: Number(deviceId) },
            { preserveScroll: true, onSuccess: () => setDeviceId('') },
        );
    };

    const detach = (device: SubscriptionDevice) => {
        if (
            !window.confirm(
                `Retirer ${device.display_name} de l'abonnement ? L'appareil reste dans le parc.`,
            )
        ) {
            return;
        }

        router.delete(
            `/remote-subscriptions/${subscriptionId}/devices/${device.id}`,
            { preserveScroll: true },
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    Appareils couverts ({devices.length}
                    {coveredCount ? ` / ${coveredCount} postes` : ''})
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {devices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Aucun appareil lié pour le moment.
                    </p>
                ) : (
                    <div className="divide-y rounded-md border">
                        {devices.map((device) => (
                            <div
                                key={device.id}
                                className="flex items-center gap-3 px-3 py-2 text-sm"
                            >
                                <Link
                                    href={`/devices/${device.id}`}
                                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                                >
                                    {device.display_name}
                                </Link>
                                {device.asset_tag && (
                                    <Badge variant="outline">
                                        {device.asset_tag}
                                    </Badge>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => detach(device)}
                                    aria-label="Retirer l'appareil de l'abonnement"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {availableDevices.length > 0 ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Select value={deviceId} onValueChange={setDeviceId}>
                            <SelectTrigger className="sm:flex-1">
                                <SelectValue placeholder="Choisir un appareil du client" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableDevices.map((device) => (
                                    <SelectItem
                                        key={device.id}
                                        value={String(device.id)}
                                    >
                                        {device.display_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            onClick={attach}
                            disabled={!deviceId}
                        >
                            Lier l'appareil
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {devices.length > 0
                            ? 'Tous les appareils du client sont liés.'
                            : 'Ce client n’a aucun appareil enregistré.'}{' '}
                        {clientId && (
                            <Link
                                href={`/users/${clientId}/edit`}
                                className="text-primary hover:underline"
                            >
                                Ajouter un appareil sur sa fiche client
                            </Link>
                        )}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
