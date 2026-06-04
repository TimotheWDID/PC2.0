import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTimeFr } from '@/lib/datetime';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Form, Head } from '@inertiajs/react';

interface DeviceSession {
    id: string;
    ip_address: string;
    user_agent: string;
    last_active_at: string;
    is_current_device: boolean;
    device_type: string;
}

interface DeviceSessionsProps {
    sessions: DeviceSession[];
    status?: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Appareils connectes',
        href: '/settings/device-sessions',
    },
];

export default function DeviceSessions({ sessions, status }: DeviceSessionsProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Appareils connectes" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Appareils connectes"
                        description="Consultez les sessions actives et protegez votre compte sur les appareils partages"
                    />

                    {status && (
                        <div role="status" aria-live="polite" className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                            {status}
                        </div>
                    )}

                    <div className="space-y-3">
                        {sessions.length === 0 ? (
                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                Aucune session active detectee.
                            </div>
                        ) : (
                            sessions.map((session) => (
                                <div key={session.id} className="rounded-lg border p-4">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <Badge variant={session.is_current_device ? 'default' : 'secondary'}>
                                            {session.is_current_device ? 'Cet appareil' : session.device_type}
                                        </Badge>
                                    </div>

                                    <p className="text-sm font-medium">{session.ip_address}</p>
                                    <p className="mt-1 break-words text-xs text-muted-foreground">{session.user_agent}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        Derniere activite: {formatDateTimeFr(session.last_active_at, { timeZone: 'Europe/Paris' })}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="rounded-lg border p-4">
                        <p className="mb-3 text-sm text-muted-foreground">
                            Pour garder la connexion sur cet appareil (ex: votre telephone), utilisez cette action depuis cet appareil. Tous les autres appareils seront deconnectes.
                        </p>

                        <Form
                            action="/settings/device-sessions/others"
                            method="delete"
                            resetOnSuccess={['password']}
                            className="space-y-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Confirmez votre mot de passe</Label>
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            autoComplete="current-password"
                                            placeholder="Mot de passe"
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    <Button type="submit" variant="destructive" disabled={processing}>
                                        Deconnecter les autres appareils
                                    </Button>
                                </>
                            )}
                        </Form>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}

