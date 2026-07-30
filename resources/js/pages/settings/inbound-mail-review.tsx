import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTimeFr } from '@/lib/datetime';
import { MailWarning, Search, Inbox, Link2, CircleSlash, RefreshCw, MessageSquareText } from 'lucide-react';

type ReviewEmail = {
  id: number;
  mailbox_uid: string | null;
  message_id: string | null;
  sender_email: string | null;
  subject: string | null;
  body_text: string | null;
  status: string;
  error: string | null;
  received_at: string | null;
  processed_at: string | null;
  ticket_id: number | null;
  ticket_ref_from_subject: number | null;
};

type PageProps = {
  filters: {
    q: string;
  };
  emails: {
    data: ReviewEmail[];
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
    links: {
      prev: string | null;
      next: string | null;
    };
  };
  flash?: {
    success?: string;
  };
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets', href: '/tickets' },
  { title: 'Mails entrants', href: '/tickets/inbound-mails' },
];

const statusLabels: Record<string, string> = {
  skipped_ambiguous_ticket: 'Plusieurs tickets possibles',
  skipped_no_matching_ticket: 'Aucun ticket trouve',
  skipped_ticket_not_found: 'Ticket de l objet introuvable',
  skipped_no_ticket_reference: 'Pas de reference ticket',
  skipped_sender_mismatch: 'Expediteur different du client ticket',
};

export default function InboundMailReviewPage({ filters, emails }: PageProps) {
  const page = usePage<PageProps>();
  const flashSuccess = page.props.flash?.success;
  const [search, setSearch] = useState(filters.q ?? '');
  const [selectedId, setSelectedId] = useState<number | null>(emails.data[0]?.id ?? null);

  const totalPending = emails.meta.total;

  useEffect(() => {
    if (emails.data.length === 0) {
      setSelectedId(null);
      return;
    }

    const stillExists = emails.data.some((item) => item.id === selectedId);
    if (!stillExists) {
      setSelectedId(emails.data[0].id);
    }
  }, [emails.data, selectedId]);

  const selectedEmail = useMemo(() => {
    if (selectedId === null) {
      return null;
    }

    return emails.data.find((item) => item.id === selectedId) ?? null;
  }, [emails.data, selectedId]);

  const needsReferenceCount = useMemo(
    () => emails.data.filter((item) => item.status === 'skipped_no_ticket_reference').length,
    [emails.data],
  );

  const ambiguousCount = useMemo(
    () => emails.data.filter((item) => item.status === 'skipped_ambiguous_ticket').length,
    [emails.data],
  );

  const senderMismatchCount = useMemo(
    () => emails.data.filter((item) => item.status === 'skipped_sender_mismatch').length,
    [emails.data],
  );

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();

    router.get('/tickets/inbound-mails', {
      q: search,
    }, {
      preserveScroll: true,
      preserveState: true,
    });
  };

  const emptyStateMessage = useMemo(() => {
    if ((filters.q ?? '').trim() !== '') {
      return 'Aucun mail en attente pour cette recherche.';
    }

    return 'Aucun mail en attente de validation humaine.';
  }, [filters.q]);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Mails entrants" />

      <div className="space-y-4 px-2 py-2 pb-24 sm:px-0 sm:py-4 lg:pb-0">
        <section className="rounded-2xl border border-border/70 bg-gradient-to-r from-[#141d3a] via-[#1f2b57] to-[#2a3ff5] p-4 text-white shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium tracking-wide">
                <MailWarning className="h-3.5 w-3.5" />
                Validation humaine
              </div>
              <h1 className="text-xl font-semibold sm:text-2xl">Mails entrants non lies</h1>
              <p className="max-w-2xl text-sm text-white/85">
                Traite les mails qui n ont pas ete rattaches automatiquement a un ticket: lier au bon ticket ou ignorer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatChip label="En attente" value={String(totalPending)} icon={Inbox} />
              <StatChip label="Sans reference" value={String(needsReferenceCount)} icon={MessageSquareText} />
              <StatChip label="Ambigus" value={String(ambiguousCount)} icon={Link2} />
              <StatChip label="Expediteur KO" value={String(senderMismatchCount)} icon={CircleSlash} />
            </div>
          </div>
        </section>

        {flashSuccess && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {flashSuccess}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="h-fit border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">File d attente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={handleSearch} className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Expediteur, sujet, erreur..."
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm">Filtrer</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearch('');
                      router.get('/tickets/inbound-mails', {}, { preserveScroll: true });
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => router.reload({ only: ['emails', 'filters'] })}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Rafraichir
                  </Button>
                </div>
              </form>

              <p className="text-xs text-muted-foreground">
                {totalPending} mails en attente, page {emails.meta.current_page}/{Math.max(1, emails.meta.last_page)}
              </p>

              {emails.data.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  {emptyStateMessage}
                </div>
              ) : (
                <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                  {emails.data.map((email) => {
                    const active = selectedId === email.id;

                    return (
                      <button
                        type="button"
                        key={email.id}
                        onClick={() => setSelectedId(email.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-[#2a3ff5] bg-[#2a3ff5]/5' : 'border-border bg-background hover:bg-muted/20'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{email.sender_email || 'Expediteur inconnu'}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">#{email.id}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{email.subject || '(sans objet)'}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="max-w-[72%] truncate text-[10px]">{statusLabels[email.status] ?? email.status}</Badge>
                          <span className="text-[10px] text-muted-foreground">{formatDateTimeFr(email.received_at, { timeZone: 'Europe/Paris' })}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!emails.links.prev}
                  onClick={() => {
                    if (emails.links.prev) {
                      router.visit(emails.links.prev, { preserveScroll: true, preserveState: true });
                    }
                  }}
                >
                  Precedent
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!emails.links.next}
                  onClick={() => {
                    if (emails.links.next) {
                      router.visit(emails.links.next, { preserveScroll: true, preserveState: true });
                    }
                  }}
                >
                  Suivant
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Traitement manuel</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedEmail ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Selectionne un mail dans la file pour le traiter.
                </div>
              ) : (
                <InboundReviewDetail email={selectedEmail} />
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppLayout>
  );
}

function InboundReviewDetail({ email }: { email: ReviewEmail }) {
  const [ticketId, setTicketId] = useState(email.ticket_ref_from_subject ? String(email.ticket_ref_from_subject) : '');
  const [dismissReason, setDismissReason] = useState('');
  const [isSubmittingAttach, setIsSubmittingAttach] = useState(false);
  const [isSubmittingDismiss, setIsSubmittingDismiss] = useState(false);

  const handleAttach = (event: React.FormEvent) => {
    event.preventDefault();

    if (!ticketId.trim()) {
      window.alert('Renseignez un ID ticket pour lier ce mail.');
      return;
    }

    setIsSubmittingAttach(true);

    router.post(`/tickets/inbound-mails/${email.id}/attach`, {
      ticket_id: Number(ticketId),
    }, {
      preserveScroll: true,
      onFinish: () => setIsSubmittingAttach(false),
    });
  };

  const handleDismiss = (event: React.FormEvent) => {
    event.preventDefault();

    setIsSubmittingDismiss(true);

    router.post(`/tickets/inbound-mails/${email.id}/dismiss`, {
      reason: dismissReason,
    }, {
      preserveScroll: true,
      onFinish: () => setIsSubmittingDismiss(false),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/10 p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Expediteur</p>
          <p className="text-sm font-medium text-foreground">{email.sender_email || 'Inconnu'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recu le</p>
          <p className="text-sm font-medium text-foreground">{formatDateTimeFr(email.received_at, { timeZone: 'Europe/Paris' })}</p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Objet</p>
          <p className="text-sm font-medium text-foreground">{email.subject || '(sans objet)'}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Statut auto</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{statusLabels[email.status] ?? email.status}</Badge>
            {email.ticket_ref_from_subject && (
              <Badge variant="secondary">Ticket detecte: #{email.ticket_ref_from_subject}</Badge>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Message-ID</p>
          <p className="truncate text-xs text-muted-foreground">{email.message_id || 'n/a'}</p>
        </div>
        {email.error && (
          <div className="space-y-1 sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Raison auto</p>
            <p className="text-sm text-foreground">{email.error}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Contenu du mail</Label>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm whitespace-pre-wrap">
          {email.body_text?.trim() ? email.body_text : 'Contenu indisponible (importe avant stockage body_text).'}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={handleAttach} className="space-y-3 rounded-xl border border-[#2a3ff5]/25 bg-[#2a3ff5]/5 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Lier ce mail a un ticket</p>
            <p className="text-xs text-muted-foreground">Le contenu sera ajoute comme reponse publique sur le ticket cible.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`ticket-id-${email.id}`}>ID ticket</Label>
            <Input
              id={`ticket-id-${email.id}`}
              type="number"
              min={1}
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="Ex: 123"
            />
          </div>
          {ticketId.trim() && (
            <Link href={`/tickets/${ticketId.trim()}`} className="inline-flex text-xs text-primary underline underline-offset-2" target="_blank">
              Ouvrir le ticket #{ticketId.trim()}
            </Link>
          )}
          <Button type="submit" disabled={isSubmittingAttach}>
            {isSubmittingAttach ? 'Liaison en cours...' : 'Lier au ticket'}
          </Button>
        </form>

        <form onSubmit={handleDismiss} className="space-y-3 rounded-xl border border-border bg-muted/15 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Ignorer ce mail</p>
            <p className="text-xs text-muted-foreground">Le mail sortira de la file de validation humaine.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`dismiss-reason-${email.id}`}>Raison (optionnel)</Label>
            <Textarea
              id={`dismiss-reason-${email.id}`}
              rows={4}
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Ex: spam, hors perimetre, destinataire incorrect"
            />
          </div>
          <Button type="submit" variant="outline" disabled={isSubmittingDismiss}>
            {isSubmittingDismiss ? 'Traitement...' : 'Marquer comme ignore'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function StatChip({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-white/80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
    </div>
  );
}
