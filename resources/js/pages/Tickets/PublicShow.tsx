import React, { useEffect, useState } from 'react';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppLogoIcon from '@/components/app-logo-icon';
import TicketChat from '@/components/TicketChat';
import { formatDateTimeFr } from '@/lib/datetime';
import { Moon, Sun } from 'lucide-react';

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
    user: { id: number; name: string; email: string | null; phone: string | null } | null;
    device: { id: number; display_name: string | null; serial_number: string | null; asset_tag: string | null } | null;
  };
  magicAccess: {
    enabled: boolean;
    token: string;
    read_only: boolean;
  };
};

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

export default function PublicShow({ ticket, magicAccess }: PublicShowProps) {
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

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkTheme(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
    document.documentElement.style.colorScheme = prefersDark ? 'dark' : 'light';
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDarkTheme;
    setIsDarkTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme);
    document.documentElement.style.colorScheme = nextTheme ? 'dark' : 'light';
    window.localStorage.setItem('public-ticket-theme', nextTheme ? 'dark' : 'light');
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
            <CardHeader className="relative pb-2 pr-16 sm:pr-20">
              <div className="absolute right-3 top-0 flex flex-col items-end gap-2 sm:right-4" style={{ top: 'calc(var(--spacing) * -2)' }}>
                <AppLogoIcon className="h-8 w-auto opacity-90 sm:h-9" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 rounded-full border-border/70 bg-background/90 px-3 text-xs shadow-sm backdrop-blur-sm"
                  onClick={toggleTheme}
                >
                  {isDarkTheme ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  {isDarkTheme ? 'Theme clair' : 'Theme fonce'}
                </Button>
              </div>
              <CardTitle className="text-2xl">Suivi de votre ticket</CardTitle>
              <p className="text-sm text-muted-foreground">Reference #{ticket.id}</p>
              <p className="text-lg font-semibold">{ticket.title}</p>
              <div className="pt-0.5">
                <Badge className="bg-[#63d7ca] text-[#141d3a]">Statut: {statusLabel(ticket.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticket.message ? (
                <div className="rounded-md border border-border bg-muted/20 p-2.5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm sm:text-base">{ticket.message}</p>
                </div>
              ) : null}

              <div className="grid gap-1.5 rounded-md border border-border p-2.5 text-sm sm:grid-cols-2 sm:text-base">
                <p><strong>Client:</strong> {ticket.user?.name ?? 'Non renseigne'}</p>
                <p><strong>Categorie:</strong> {ticket.category?.name ?? 'Non renseignee'}</p>
                <p><strong>Telephone:</strong> {ticket.contact_phone ?? ticket.user?.phone ?? 'Non renseigne'}</p>
                <p><strong>Email:</strong> {ticket.contact_email ?? ticket.user?.email ?? 'Non renseigne'}</p>
                <p><strong>Cree le:</strong> {formatDateTimeFr(ticket.created_at, { timeZone: 'Europe/Paris' })}</p>
                <p><strong>Mis a jour:</strong> {formatDateTimeFr(ticket.updated_at, { timeZone: 'Europe/Paris' })}</p>
              </div>

              <div className="flex flex-col gap-1.5 rounded-md border border-[#2a3ff5]/30 bg-[#eff3ff] p-2.5 text-[#141d3a] dark:border-[#3a4dff]/30 dark:bg-[#15213f] dark:text-[#dce2ff] sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">Acces client securise par token</p>
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
        </div>
      </main>
    </>
  );
}
