import Heading from '@/components/heading';
import MobileNativeNav from '@/components/mobile-native-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { formatDateTimeFr } from '@/lib/datetime';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Link2, Stethoscope, Trash2 } from 'lucide-react';
import { useState } from 'react';

type QuickDiagnostic = {
    id: number;
    machine_name: string | null;
    serial: string | null;
    overall: string | null;
    overall_label: string | null;
    viability_score: number | null;
    viability_level: string | null;
    viability_label: string | null;
    created_at: string | null;
    technician: string | null;
    report_url: string;
};

type TicketOption = {
    id: number;
    title: string | null;
    client: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Diag rapide', href: '/diag' }];

const diagnosticBadgeClass: Record<string, string> = {
    good: 'border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    warn: 'border-amber-600/40 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    crit: 'border-red-600/40 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

export default function DiagnosticsIndex({
    diagnostics,
    tickets,
    toolUrl,
}: {
    diagnostics: QuickDiagnostic[];
    tickets: TicketOption[];
    toolUrl: string;
}) {
    const [attachingId, setAttachingId] = useState<number | null>(null);
    const [ticketInput, setTicketInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const startAttach = (id: number) => {
        setAttachingId(id);
        setTicketInput('');
        setError(null);
    };

    const submitAttach = (diagnosticId: number) => {
        const ticketId = Number((ticketInput.match(/\d+/) ?? [''])[0]);
        if (!ticketId) {
            setError('Indiquez un numéro de ticket.');
            return;
        }

        router.post(
            `/diag/diagnostics/${diagnosticId}/attach`,
            { ticket_id: ticketId },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (errors) =>
                    setError(errors.ticket_id ?? 'Rattachement impossible.'),
            },
        );
    };

    const handleDelete = (diagnosticId: number) => {
        if (!window.confirm('Supprimer ce diagnostic et ses fichiers ?')) {
            return;
        }

        router.delete(`/diag/diagnostics/${diagnosticId}`, {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Diag rapide" />
            <div className="space-y-4 py-2 sm:py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        title="Diag rapide"
                        description="Lancez le Diag Atelier sans ticket, puis rattachez le diagnostic à un ticket si besoin."
                    />
                    <Button asChild>
                        <a href={toolUrl}>
                            <Stethoscope className="mr-2 h-4 w-4" />
                            Nouveau diag
                        </a>
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            Diags non rattachés ({diagnostics.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {diagnostics.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Aucun diag rapide. Cliquez sur « Nouveau diag »,
                                déposez les exports du poste puis « Enregistrer
                                le diag » : il apparaîtra ici.
                            </p>
                        ) : (
                            diagnostics.map((diagnostic) => (
                                <div
                                    key={diagnostic.id}
                                    className="rounded-md border p-3"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    diagnosticBadgeClass[
                                                        diagnostic.overall ?? ''
                                                    ] ?? ''
                                                }
                                            >
                                                {diagnostic.overall_label ??
                                                    'Diagnostic partiel'}
                                            </Badge>
                                            {diagnostic.viability_score !==
                                                null && (
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        diagnosticBadgeClass[
                                                            diagnostic.viability_level ??
                                                                ''
                                                        ] ?? ''
                                                    }
                                                >
                                                    Viabilité{' '}
                                                    {diagnostic.viability_score}
                                                    /100
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDateTimeFr(
                                                diagnostic.created_at,
                                            )}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm font-medium">
                                        {diagnostic.machine_name ??
                                            'Poste sans nom'}
                                        {diagnostic.serial
                                            ? ` · S/N ${diagnostic.serial}`
                                            : ''}
                                        {diagnostic.viability_label
                                            ? ` · ${diagnostic.viability_label}`
                                            : ''}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-[11px] text-muted-foreground">
                                            {diagnostic.technician ?? ''}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1">
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                            >
                                                <a href={diagnostic.report_url}>
                                                    Ouvrir
                                                </a>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() =>
                                                    startAttach(diagnostic.id)
                                                }
                                            >
                                                <Link2 className="mr-1 h-3 w-3" />
                                                Rattacher à un ticket
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs text-muted-foreground"
                                                onClick={() =>
                                                    handleDelete(diagnostic.id)
                                                }
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                <span className="sr-only">
                                                    Supprimer
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                    {attachingId === diagnostic.id && (
                                        <form
                                            className="mt-3 space-y-2 border-t pt-3"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                submitAttach(diagnostic.id);
                                            }}
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Input
                                                    className="h-8 max-w-sm flex-1"
                                                    list={`diag-tickets-${diagnostic.id}`}
                                                    value={ticketInput}
                                                    onChange={(event) =>
                                                        setTicketInput(
                                                            event.target.value,
                                                        )
                                                    }
                                                    placeholder="N° de ticket ou recherche (client, titre)"
                                                    autoFocus
                                                />
                                                <datalist
                                                    id={`diag-tickets-${diagnostic.id}`}
                                                >
                                                    {tickets.map((ticket) => (
                                                        <option
                                                            key={ticket.id}
                                                            value={`#${ticket.id} · ${ticket.client ?? 'Sans client'} · ${ticket.title ?? ''}`}
                                                        />
                                                    ))}
                                                </datalist>
                                                <Button
                                                    type="submit"
                                                    size="sm"
                                                    className="h-8"
                                                    disabled={processing}
                                                >
                                                    Rattacher
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={() =>
                                                        setAttachingId(null)
                                                    }
                                                >
                                                    Annuler
                                                </Button>
                                            </div>
                                            {error && (
                                                <p className="text-xs text-red-600">
                                                    {error}
                                                </p>
                                            )}
                                            <p className="text-[11px] text-muted-foreground">
                                                Le diagnostic passe sur le
                                                ticket et la fiche inventaire
                                                complète l’appareil du ticket,
                                                comme un envoi depuis le ticket.
                                            </p>
                                        </form>
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
            <MobileNativeNav showFab={false} />
        </AppLayout>
    );
}
