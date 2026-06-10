import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDateFr } from '@/lib/datetime';
import MobileNativeNav from '@/components/mobile-native-nav';
import { SortableTh, useSortableData } from '@/components/sortable-table';

type User = {
  id: number;
  name: string;
  email: string;
  first_name?: string;
  last_name?: string;
};

type Ticket = {
  id: number;
  title: string;
  uuid: string;
};

type Commande = {
  id: number;
  user_id: number;
  ticket_id: number | null;
  nom: string;
  fournisseur: string;
  command_number: string;
  invoice_id: string | null;
  statut: 'new' | 'panier' | 'commandé' | 'réceptionner' | 'traité';
  created_at: string;
  user?: User;
  ticket?: Ticket;
};

type PaginatedCommandes = {
  data: Commande[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

type Filters = {
  statut?: string;
  fournisseur?: string;
  search?: string;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Commandes', href: '/commandes' },
];

const statutLabels: Record<string, string> = {
  'new': 'Nouveau',
  'panier': 'Panier',
  'commandé': 'Commandé',
  'réceptionner': 'Réceptionné',
  'traité': 'Traité',
};

const statutColors: Record<string, string> = {
  'new': 'status-badge-new',
  'panier': 'status-badge-panier',
  'commandé': 'status-badge-commande',
  'réceptionner': 'status-badge-reception',
  'traité': 'status-badge-traite',
};

export default function Index({ commandes, filters }: { commandes: PaginatedCommandes; filters: Filters }) {
  const [search, setSearch] = useState(filters?.search || '');
  const [statut, setStatut] = useState(filters?.statut || '');
  const [fournisseur, setFournisseur] = useState(filters?.fournisseur || '');

  const { sortedItems: sortedCommandes, sortState, requestSort } = useSortableData(commandes.data ?? [], {
    id: (commande) => commande.id,
    nom: (commande) => commande.nom ?? '',
    command_number: (commande) => commande.command_number ?? '',
    fournisseur: (commande) => commande.fournisseur ?? '',
    user: (commande) => commande.user
      ? (commande.user.name || `${commande.user.first_name ?? ''} ${commande.user.last_name ?? ''}`.trim() || commande.user.email)
      : '',
    ticket: (commande) => commande.ticket?.id ?? 0,
    statut: (commande) => commande.statut ?? '',
    created_at: (commande) => commande.created_at ?? '',
  });

  const handleFilter = () => {
    router.get('/commandes', { search, statut, fournisseur }, { preserveState: true });
  };

  const handleReset = () => {
    setSearch('');
    setStatut('');
    setFournisseur('');
    router.get('/commandes');
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Commandes" />
      <div className="py-2 sm:py-4 w-full">
        <Heading title="Commandes" description="Gestion des commandes" />

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
              <Input
                placeholder="Rechercher ID, sujet, demandeur, ticket..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Input
                placeholder="Fournisseur"
                value={fournisseur}
                onChange={(e) => setFournisseur(e.target.value)}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={statut}
                onChange={(e) => setStatut(e.target.value)}
              >
                <option value="">Tous</option>
                <option value="new">Nouveau</option>
                <option value="panier">Panier</option>
                <option value="commandé">Commandé</option>
                <option value="réceptionner">Réceptionné</option>
                <option value="traité">Traité</option>
              </select>
              <div className="flex gap-2">
                <Button onClick={handleFilter} className="flex-1 md:flex-none">Filtrer</Button>
                <Button variant="outline" onClick={handleReset} className="flex-1 md:flex-none">Réinitialiser</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Liste des commandes ({commandes.total})</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Link href="/commandes/create-bulk">
                <Button variant="outline" className="w-full sm:w-auto">Commande groupée</Button>
              </Link>
              <Link href="/commandes/create">
                <Button className="w-full sm:w-auto">Nouvelle commande</Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="space-y-2 p-3 sm:hidden">
              {commandes.data && commandes.data.length > 0 ? (
                commandes.data.map((commande) => (
                  <div key={commande.id} className="rounded-md border p-3 transition-colors hover:bg-muted/40">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold">#{commande.id} - {commande.nom}</p>
                      <Badge className={statutColors[commande.statut]}>{statutLabels[commande.statut]}</Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>N° commande: {commande.command_number || '-'}</p>
                      <p>Fournisseur: {commande.fournisseur || '-'}</p>
                      <p>
                        Utilisateur: {commande.user
                          ? (commande.user.name || `${commande.user.first_name ?? ''} ${commande.user.last_name ?? ''}`.trim() || commande.user.email)
                          : '-'}
                      </p>
                      <p>Date: {formatDateFr(commande.created_at, { timeZone: 'Europe/Paris' })}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Link href={`/commandes/${commande.id}/edit`}>
                        <Button size="sm" variant="secondary">Ouvrir</Button>
                      </Link>
                      {commande.ticket ? (
                        <Link href={`/tickets/${commande.ticket.id}`} className="text-xs link-readable">
                          Ticket #{commande.ticket.id}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pas de ticket</span>
                      )}
                      <Link href={`/commandes/${commande.id}`}>
                        <Button size="sm" variant="outline">Voir</Button>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">Aucune commande trouvée</div>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <SortableTh label="ID" sortKey="id" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Nom" sortKey="nom" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="N° Commande" sortKey="command_number" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Fournisseur" sortKey="fournisseur" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Utilisateur" sortKey="user" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Ticket" sortKey="ticket" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Statut" sortKey="statut" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Date" sortKey="created_at" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCommandes && sortedCommandes.length > 0 ? (
                    sortedCommandes.map((commande) => (
                      <tr
                        key={commande.id}
                        onClick={() => router.get(`/commandes/${commande.id}/edit`)}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 text-sm">{commande.id}</td>
                        <td className="px-4 py-4 text-sm font-medium">{commande.nom}</td>
                        <td className="px-4 py-4 text-sm">{commande.command_number || '-'}</td>
                        <td className="px-4 py-4 text-sm">{commande.fournisseur || '-'}</td>
                        <td className="px-4 py-4 text-sm">
                          {commande.user
                            ? (commande.user.name || `${commande.user.first_name ?? ''} ${commande.user.last_name ?? ''}`.trim() || commande.user.email)
                            : '-'}
                        </td>
                        <td className="px-4 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                          {commande.ticket ? (
                               <Link href={`/tickets/${commande.ticket.id}`} className="link-readable">
                                 #{commande.ticket.id}
                            </Link>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <Badge className={statutColors[commande.statut]}>
                            {statutLabels[commande.statut]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {formatDateFr(commande.created_at, { timeZone: 'Europe/Paris' })}
                        </td>
                        <td className="px-4 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <Link href={`/commandes/${commande.id}`}>
                              <Button size="sm" variant="outline">Voir</Button>
                            </Link>
                            <Link href={`/commandes/${commande.id}/edit`}>
                              <Button size="sm" variant="outline">Modifier</Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        Aucune commande trouvée
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {commandes.last_page > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Page {commandes.current_page} sur {commandes.last_page}
                </div>
                <div className="flex gap-2">
                  {commandes.current_page > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.get(`/commandes?page=${commandes.current_page - 1}`)}
                    >
                      Précédent
                    </Button>
                  )}
                  {commandes.current_page < commandes.last_page && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.get(`/commandes?page=${commandes.current_page + 1}`)}
                    >
                      Suivant
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav fabHref="/commandes/create" fabLabel="Nouvelle commande" />
    </AppLayout>
  );
}

