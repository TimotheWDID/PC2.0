import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type User = {
  id: number;
  name: string;
  email: string;
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
  'new': 'bg-blue-500',
  'panier': 'bg-yellow-500',
  'commandé': 'bg-purple-500',
  'réceptionner': 'bg-green-500',
  'traité': 'bg-gray-500',
};

export default function Index({ commandes, filters }: { commandes: PaginatedCommandes; filters: Filters }) {
  const [search, setSearch] = useState(filters?.search || '');
  const [statut, setStatut] = useState(filters?.statut || '');
  const [fournisseur, setFournisseur] = useState(filters?.fournisseur || '');

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
      <div className="py-4 w-full">
        <Heading title="Commandes" description="Gestion des commandes" />

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Rechercher..."
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
                <Button onClick={handleFilter}>Filtrer</Button>
                <Button variant="outline" onClick={handleReset}>Réinitialiser</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Liste des commandes ({commandes.total})</CardTitle>
            <div className="flex gap-2">
              <Link href="/commandes/create-bulk">
                <Button variant="outline">Commande groupée</Button>
              </Link>
              <Link href="/commandes/create">
                <Button>Nouvelle commande</Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Nom</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">N° Commande</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Fournisseur</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Utilisateur</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Ticket</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Statut</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commandes.data && commandes.data.length > 0 ? (
                    commandes.data.map((commande) => (
                      <tr
                        key={commande.id}
                        onClick={() => router.get(`/commandes/${commande.id}/edit`)}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4 text-sm">{commande.id}</td>
                        <td className="px-4 py-4 text-sm font-medium">{commande.nom}</td>
                        <td className="px-4 py-4 text-sm">{commande.command_number || '-'}</td>
                        <td className="px-4 py-4 text-sm">{commande.fournisseur || '-'}</td>
                        <td className="px-4 py-4 text-sm">{commande.user?.name || '-'}</td>
                        <td className="px-4 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                          {commande.ticket ? (
                            <Link href={`/tickets/${commande.ticket.id}`} className="text-blue-600 hover:underline">
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
                          {new Date(commande.created_at).toLocaleDateString('fr-FR')}
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
    </AppLayout>
  );
}
