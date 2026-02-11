import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
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

type Ticket = {
  id: number;
  title: string | null;
  status: string | null;
  created_at: string | null;
  user?: { id: number; name: string } | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets', href: '/tickets' },
]

export default function Index({ tickets, currentStatus }: { tickets: Ticket[]; currentStatus?: string | null }) {
  const [query, setQuery] = useState('');

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

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Tickets" />
      <div className="py-4 w-full">
        <Heading title="Tickets" description={`Liste des tickets - ${statusTitle}`} />

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Liste des tickets</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Rechercher par ID, sujet ou demandeur" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Link href="/tickets/create">
                <Button variant="default">Nouveau ticket</Button>
              </Link>
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
                      <td className="px-4 py-4 text-sm font-medium">{t.title ?? '-'}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{t.user?.name ?? '-'}</td>
                      <td className="px-4 py-4">
                        <Badge variant={t.status === 'open' ? 'destructive' : t.status === 'in_progress' ? 'default' : t.status === 'pending' ? 'secondary' : 'outline'}>{translateStatus(t.status ?? '-')}</Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{t.created_at ?? '-'}</td>
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <form action={`/tickets/${t.id}`} method="POST" style={{ display: 'inline-block' }} onSubmit={(e) => { if(!confirm('Supprimer ce ticket ?')) e.preventDefault(); }}>
                          <input type="hidden" name="_method" value="DELETE" />
                          <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
                          <Button type="submit" variant="destructive" size="sm">Supprimer</Button>
                        </form>
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
      </div>
    </AppLayout>
  );
}
