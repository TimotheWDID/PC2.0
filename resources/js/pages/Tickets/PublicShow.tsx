import AppLogoIcon from '@/components/app-logo-icon';
import TicketChat from '@/components/TicketChat';
import TicketFiles from '@/components/TicketFiles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTimeFr } from '@/lib/datetime';
import { Head } from '@inertiajs/react';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type PublicShowProps = {
    ticket: {
        id: number;
        title: string;
        message: string | null;
        status: string;
        priority: string;
        created_at: string | null;
        updated_at: string | null;
        notify_by: 'SMS' | 'Email' | 'None' | null;
        contact_email: string | null;
        contact_phone: string | null;
        category: { id: number; name: string } | null;
        user: {
            id: number;
            name: string;
            email: string | null;
            phone: string | null;
        } | null;
        device: {
            id: number;
            display_name: string | null;
            serial_number: string | null;
            asset_tag: string | null;
        } | null;
    };
    commandes?: PublicCommande[];
    magicAccess: {
        enabled: boolean;
        token: string;
        read_only: boolean;
    };
};

type PublicCommande = {
    id: number;
    nom: string;
    statut: string;
    created_at: string | null;
    updated_at: string | null;
};

const commandeSteps = [
    'Preparation',
    'Commandee',
    'Recue',
    'Terminee',
] as const;

const commandeStepIndex = (statut: string): number => {
    switch (statut) {
        case 'commandé':
            return 1;
        case 'réceptionner':
            return 2;
        case 'traité':
            return 3;
        default:
            return 0;
    }
};

const commandeStatusLabel = (statut: string): string => {
    const labels: Record<string, string> = {
        new: 'En preparation',
        panier: 'En preparation',
        commandé: 'Commandee aupres du fournisseur',
        réceptionner: "Recue a l'atelier",
        traité: 'Terminee',
    };

    return labels[statut] ?? statut;
};

function CommandeProgress({ commande }: { commande: PublicCommande }) {
    const current = commandeStepIndex(commande.statut);

    return (
        <li className="rounded-md border border-border p-2.5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium">{commande.nom}</p>
                <Badge
                    variant={
                        current === commandeSteps.length - 1
                            ? 'default'
                            : 'secondary'
                    }
                    className="w-fit"
                >
                    {commandeStatusLabel(commande.statut)}
                </Badge>
            </div>
            <ol
                className="mt-2.5 grid grid-cols-4 gap-1"
                aria-label={`Avancement de la commande ${commande.nom}`}
            >
                {commandeSteps.map((step, index) => (
                    <li
                        key={step}
                        className="flex flex-col gap-1"
                        aria-current={index === current ? 'step' : undefined}
                    >
                        <span
                            className={`h-1.5 rounded-full ${index <= current ? 'bg-[#2a3ff5] dark:bg-[#5162ff]' : 'bg-muted'}`}
                        />
                        <span
                            className={`text-[11px] sm:text-xs ${index <= current ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                        >
                            {step}
                        </span>
                    </li>
                ))}
            </ol>
            <p className="mt-1.5 text-xs text-muted-foreground">
                Derniere mise a jour :{' '}
                {formatDateTimeFr(commande.updated_at, {
                    timeZone: 'Europe/Paris',
                })}
            </p>
        </li>
    );
}

const statusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        open: 'Ouvert',
        in_progress: 'En cours',
        pending: 'En attente',
        resolved: 'Resolu',
        closed: 'Ferme',
    };

    return labels[status] ?? status;
};

export default function PublicShow({
    ticket,
    commandes = [],
    magicAccess,
}: PublicShowProps) {
    const [copied, setCopied] = useState(false);
    const [isDarkTheme, setIsDarkTheme] = useState(false);

    useEffect(() => {
        const savedTheme = window.localStorage.getItem('public-ticket-theme');

        if (savedTheme === 'dark') {
            setIsDarkTheme(true);
            document.documentElement.classList.add('dark');
            document.documentElement.style.colorScheme = 'dark';
            return;
        }

        if (savedTheme === 'light') {
            setIsDarkTheme(false);
            document.documentElement.classList.remove('dark');
            document.documentElement.style.colorScheme = 'light';
            return;
        }

        const prefersDark = window.matchMedia(
            '(prefers-color-scheme: dark)',
        ).matches;
        setIsDarkTheme(prefersDark);
        document.documentElement.classList.toggle('dark', prefersDark);
        document.documentElement.style.colorScheme = prefersDark
            ? 'dark'
            : 'light';
    }, []);

    const toggleTheme = () => {
        const nextTheme = !isDarkTheme;
        setIsDarkTheme(nextTheme);
        document.documentElement.classList.toggle('dark', nextTheme);
        document.documentElement.style.colorScheme = nextTheme
            ? 'dark'
            : 'light';
        window.localStorage.setItem(
            'public-ticket-theme',
            nextTheme ? 'dark' : 'light',
        );
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    return (
        <>
            <Head title={`Ticket #${ticket.id}`}>
                <meta name="robots" content="noindex,nofollow" />
            </Head>

            <main
                className="min-h-screen bg-background text-foreground"
                style={{ fontFamily: 'Verdana, Tahoma, Arial, sans-serif' }}
            >
                <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-6 sm:py-4">
                    <Card>
                        <CardHeader className="relative pr-16 pb-2 sm:pr-20">
                            <div
                                className="absolute top-0 right-3 flex flex-col items-end gap-2 sm:right-4"
                                style={{ top: 'calc(var(--spacing) * -2)' }}
                            >
                                <AppLogoIcon className="h-8 w-auto opacity-90 sm:h-9" />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-2 rounded-full border-border/70 bg-background/90 px-3 text-xs shadow-sm backdrop-blur-sm"
                                    onClick={toggleTheme}
                                >
                                    {isDarkTheme ? (
                                        <Sun className="h-3.5 w-3.5" />
                                    ) : (
                                        <Moon className="h-3.5 w-3.5" />
                                    )}
                                    {isDarkTheme
                                        ? 'Theme clair'
                                        : 'Theme fonce'}
                                </Button>
                            </div>
                            <CardTitle className="text-2xl">
                                Suivi de votre ticket
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Reference #{ticket.id}
                            </p>
                            <p className="text-lg font-semibold">
                                {ticket.title}
                            </p>
                            <div className="pt-0.5">
                                <Badge className="bg-[#63d7ca] text-[#141d3a]">
                                    Statut: {statusLabel(ticket.status)}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {ticket.message ? (
                                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                                        Description
                                    </p>
                                    <p className="mt-1 text-sm whitespace-pre-wrap sm:text-base">
                                        {ticket.message}
                                    </p>
                                </div>
                            ) : null}

                            <div className="grid gap-1.5 rounded-md border border-border p-2.5 text-sm sm:grid-cols-2 sm:text-base">
                                <p>
                                    <strong>Client:</strong>{' '}
                                    {ticket.user?.name ?? 'Non renseigne'}
                                </p>
                                <p>
                                    <strong>Categorie:</strong>{' '}
                                    {ticket.category?.name ?? 'Non renseignee'}
                                </p>
                                <p>
                                    <strong>Telephone:</strong>{' '}
                                    {ticket.contact_phone ??
                                        ticket.user?.phone ??
                                        'Non renseigne'}
                                </p>
                                <p>
                                    <strong>Email:</strong>{' '}
                                    {ticket.contact_email ??
                                        ticket.user?.email ??
                                        'Non renseigne'}
                                </p>
                                <p>
                                    <strong>Cree le:</strong>{' '}
                                    {formatDateTimeFr(ticket.created_at, {
                                        timeZone: 'Europe/Paris',
                                    })}
                                </p>
                                <p>
                                    <strong>Mis a jour:</strong>{' '}
                                    {formatDateTimeFr(ticket.updated_at, {
                                        timeZone: 'Europe/Paris',
                                    })}
                                </p>
                            </div>

                            <div className="flex flex-col gap-1.5 rounded-md border border-[#2a3ff5]/30 bg-[#eff3ff] p-2.5 text-[#141d3a] sm:flex-row sm:items-center sm:justify-between dark:border-[#3a4dff]/30 dark:bg-[#15213f] dark:text-[#dce2ff]">
                                <p className="text-sm font-medium">
                                    Acces client securise par token
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="bg-[#2a3ff5] text-white hover:bg-[#1f32cc] dark:bg-[#3a4dff] dark:hover:bg-[#5162ff]"
                                    onClick={copyLink}
                                >
                                    {copied ? 'Lien copie' : 'Copier le lien'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {commandes.length > 0 ? (
                        <Card className="mt-2.5">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">
                                    Suivi de vos commandes
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    {commandes.length > 1
                                        ? `${commandes.length} pieces commandees pour ce ticket`
                                        : '1 piece commandee pour ce ticket'}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {commandes.map((commande) => (
                                        <CommandeProgress
                                            key={commande.id}
                                            commande={commande}
                                        />
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    ) : null}

                    <section className="mt-2.5">
                        <TicketChat
                            ticketId={ticket.id}
                            currentUserId={ticket.user?.id ?? 0}
                            isAgent={false}
                            notifyBy={ticket.notify_by ?? 'None'}
                            contactEmail={ticket.contact_email}
                            contactPhone={ticket.contact_phone}
                            requesterEmail={ticket.user?.email ?? null}
                            requesterPhone={ticket.user?.phone ?? null}
                            mentionCandidates={[]}
                            magicToken={magicAccess.token}
                            canSend={!magicAccess.read_only}
                        />
                    </section>

                    <section className="mt-2.5">
                        <TicketFiles
                            ticketId={ticket.id}
                            isAgent={false}
                            magicToken={magicAccess.token}
                        />
                    </section>
                </div>
            </main>
        </>
    );
}
