import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Fonction pour traduire les statuts en français
const translateStatus = (status: string): string => {
  const translations: Record<string, string> = {
    'open': 'Ouvert',
    'in_progress': 'En cours',
    'pending': 'En attente',
    'resolved': 'Résolu',
    'closed': 'Fermé',
  };
  return translations[status] || status;
};

const translateTicketKind = (kind: string | null | undefined): string => {
  if (kind === 'bug') return 'Bug';
  if (kind === 'improvement') return 'Amelioration';
  return 'Support';
};

type Ticket = {
  id: number;
  title: string | null;
  ticket_kind?: 'standard' | 'bug' | 'improvement' | null;
  status: string | null;
  created_at: string | null;
  user?: { id: number; name: string } | null;
  commande?: { id: number; nom: string } | null;
};

type LinkableCommande = {
  id: number;
  nom: string | null;
  fournisseur: string | null;
  command_number: string | null;
  user_name: string | null;
  user_email: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets', href: '/tickets' },
]

export default function Index({
  tickets,
  currentStatus,
  linkableCommandes,
  showAllStatuses,
  filteredUser,
  specialOnly,
}: {
  tickets: Ticket[];
  currentStatus?: string | null;
  linkableCommandes: LinkableCommande[];
  showAllStatuses?: boolean;
  filteredUser?: { id: number; name: string } | null;
  specialOnly?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTargetTicket, setLinkTargetTicket] = useState<Ticket | null>(null);
  const [commandeSearch, setCommandeSearch] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Initialiser les filtres en fonction du currentStatus
  const getInitialFilters = () => {
    if (currentStatus) {
      // Si un statut spécifique est sélectionné dans le menu, n'afficher que celui-là
      return {
        open: currentStatus === 'open',
        in_progress: currentStatus === 'in_progress',
        pending: currentStatus === 'pending',
        resolved: currentStatus === 'resolved',
        closed: currentStatus === 'closed',
      };
    }
    if (showAllStatuses) {
      return {
        open: true,
        in_progress: true,
        pending: true,
        resolved: true,
        closed: true,
      };
    }
    // Par défaut, masquer les résolus et fermés
    return {
      open: true,
      in_progress: true,
      pending: true,
      resolved: false,
      closed: false,
    };
  };

  const [statusFilters, setStatusFilters] = useState(getInitialFilters());

  // Traduction du statut pour l'affichage
  const statusTitle = currentStatus ? translateStatus(currentStatus) : 'Tous les tickets';
  const clientScope = filteredUser
    ? `Client: ${filteredUser.name || `#${filteredUser.id}`}`
    : null;
  const pageTitle = specialOnly ? 'Bug et amelioration' : 'Tickets';
  const listTitle = specialOnly ? 'Liste des bugs et ameliorations' : 'Liste des tickets';
  const baseDescription = specialOnly
    ? `Liste des bugs et ameliorations - ${statusTitle}`
    : `Liste des tickets - ${statusTitle}`;

  const toggleStatus = (status: keyof typeof statusFilters) => {
    setStatusFilters(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const filtered = tickets.filter((t) => {
    const searchLower = query.toLowerCase();
    const matchesSearch = (
      (t.title ?? '').toLowerCase().includes(searchLower) ||
      String(t.id).includes(query) ||
      (t.user?.name ?? '').toLowerCase().includes(searchLower)
    );
    const matchesStatus = statusFilters[t.status as keyof typeof statusFilters] ?? true;
    return matchesSearch && matchesStatus;
  });

  const filteredLinkableCommandes = useMemo(() => {
    const search = commandeSearch.trim().toLowerCase();

    if (!search) return linkableCommandes;

    return linkableCommandes.filter((commande) => {
      return (
        String(commande.id).includes(search)
        || (commande.nom ?? '').toLowerCase().includes(search)
        || (commande.fournisseur ?? '').toLowerCase().includes(search)
        || (commande.command_number ?? '').toLowerCase().includes(search)
        || (commande.user_name ?? '').toLowerCase().includes(search)
        || (commande.user_email ?? '').toLowerCase().includes(search)
      );
    });
  }, [commandeSearch, linkableCommandes]);

  const openLinkModal = (ticket: Ticket) => {
    setLinkTargetTicket(ticket);
    setCommandeSearch('');
    setIsLinkModalOpen(true);
  };

  const closeLinkModal = () => {
    setIsLinkModalOpen(false);
    setLinkTargetTicket(null);
    setCommandeSearch('');
    setIsLinking(false);
  };

  const handleLinkCommande = (commandeId: number) => {
    if (!linkTargetTicket) return;

    setIsLinking(true);

    router.patch(
      `/tickets/${linkTargetTicket.id}/link-commande`,
      { commande_id: commandeId },
      {
        preserveScroll: true,
        onSuccess: () => closeLinkModal(),
        onFinish: () => setIsLinking(false),
      },
    );
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={pageTitle} />
      <div className="py-4 w-full">
        <Heading
          title={pageTitle}
          description={clientScope ? `${baseDescription} - ${clientScope}` : baseDescription}
        />

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{listTitle}</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Rechercher par ID, sujet ou demandeur" value={query} onChange={(e) => setQuery(e.target.value)} />
              {specialOnly ? (
                <Link href="/tickets/bugs-improvements/create?ticket_kind=bug">
                  <Button variant="default">Signaler un bug / Proposer une amélioration</Button>
                </Link>
              ) : (
                <Link href="/tickets/create">
                  <Button variant="default">Nouveau ticket</Button>
                </Link>
              )}
            </div>
          </CardHeader>

          {!currentStatus && (
            <CardContent className="pb-4">
              <div className="flex flex-wrap gap-3 mb-4 px-4 py-2 border-b">
                <span className="text-xs text-muted-foreground mr-2">Filtrer par statut :</span>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="filter-open"
                    checked={statusFilters.open}
                    onCheckedChange={() => toggleStatus('open')}
                  />
                  <Label htmlFor="filter-open" className="cursor-pointer text-xs">Ouvert</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="filter-in_progress"
                    checked={statusFilters.in_progress}
                    onCheckedChange={() => toggleStatus('in_progress')}
                  />
                  <Label htmlFor="filter-in_progress" className="cursor-pointer text-xs">En cours</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="filter-pending"
                    checked={statusFilters.pending}
                    onCheckedChange={() => toggleStatus('pending')}
                  />
                  <Label htmlFor="filter-pending" className="cursor-pointer text-xs">En attente</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="filter-resolved"
                    checked={statusFilters.resolved}
                    onCheckedChange={() => toggleStatus('resolved')}
                  />
                  <Label htmlFor="filter-resolved" className="cursor-pointer text-xs">Résolu</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id="filter-closed"
                    checked={statusFilters.closed}
                    onCheckedChange={() => toggleStatus('closed')}
                  />
                  <Label htmlFor="filter-closed" className="cursor-pointer text-xs">Fermé</Label>
                </div>
              </div>
            </CardContent>
          )}

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Sujet</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Demandeur</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Statut</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Créé le</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
                {filtered && filtered.length ? (
                  filtered.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => window.location.href = `/tickets/${t.id}`}>
                      <td className="px-4 py-4 text-sm font-medium">{t.id}</td>
                      <td className="px-4 py-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span>{t.title ?? '-'}</span>
                          {t.ticket_kind && t.ticket_kind !== 'standard' && (
                            <Badge variant="outline">{translateTicketKind(t.ticket_kind)}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{t.user?.name ?? '-'}</td>
                      <td className="px-4 py-4">
                        <Badge variant={t.status === 'open' ? 'destructive' : t.status === 'in_progress' ? 'default' : t.status === 'pending' ? 'secondary' : 'outline'}>{translateStatus(t.status ?? '-')}</Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{t.created_at ?? '-'}</td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-2">
                          {t.commande ? (
                            <Link href={`/commandes/${t.commande.id}`}>
                              <Button type="button" variant="outline" size="sm">
                                Commande liee #{t.commande.id}
                              </Button>
                            </Link>
                          ) : (
                            <>
                              <Button type="button" variant="outline" size="sm" onClick={() => openLinkModal(t)}>
                                Lier
                              </Button>
                              <Link href={`/commandes/create?ticket_id=${t.id}`}>
                                <Button type="button" variant="default" size="sm">
                                  Creer cmd
                                </Button>
                              </Link>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun ticket trouvé.</td>
                  </tr>
                )}
          </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {isLinkModalOpen && linkTargetTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeLinkModal}>
            <div className="w-full max-w-2xl rounded-lg border bg-background shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-base font-semibold">
                  Lier une commande au ticket #{linkTargetTicket.id}
                </h3>
                <Button type="button" variant="ghost" size="sm" onClick={closeLinkModal}>
                  Fermer
                </Button>
              </div>

              <div className="p-4 space-y-3">
                <Input
                  placeholder="Rechercher commande (id, nom, fournisseur, numero, client, email)..."
                  value={commandeSearch}
                  onChange={(e) => setCommandeSearch(e.target.value)}
                />

                <div className="max-h-80 overflow-y-auto border rounded-md">
                  {filteredLinkableCommandes.length > 0 ? (
                    filteredLinkableCommandes.map((commande) => (
                      <div key={commande.id} className="border-b last:border-b-0 p-3 flex items-start justify-between gap-3">
                        <div className="text-sm">
                          <div className="font-medium">Commande #{commande.id} - {commande.nom ?? '-'}</div>
                          <div className="text-muted-foreground">
                            Fournisseur: {commande.fournisseur ?? '-'} | N°: {commande.command_number ?? '-'}
                          </div>
                          <div className="text-muted-foreground">
                            Client: {commande.user_name ?? '-'} {commande.user_email ? `(${commande.user_email})` : ''}
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isLinking}
                          onClick={() => handleLinkCommande(commande.id)}
                        >
                          Lier
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground">
                      Aucune commande disponible a lier.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Seules les commandes non liees sont affichees ici.
                </p>
                <Button type="button" variant="secondary" onClick={closeLinkModal}>
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
