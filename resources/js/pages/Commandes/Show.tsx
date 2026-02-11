import { Head, Link, router } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { useState } from 'react';

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
  updated_at: string;
  user?: User;
  ticket?: Ticket;
};

const breadcrumbs = (commandeId: number): BreadcrumbItem[] => [
  { title: 'Commandes', href: '/commandes' },
  { title: `Commande #${commandeId}`, href: `/commandes/${commandeId}` },
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

export default function Show({ commande }: { commande: Commande }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) {
      setIsDeleting(true);
      router.delete(`/commandes/${commande.id}`);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    router.patch(`/commandes/${commande.id}/status`, { statut: newStatus }, {
      preserveScroll: true,
      onSuccess: () => {
        // Optional: Show success message
      },
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs(commande.id)}>
      <Head title={`Commande #${commande.id}`} />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Heading title={`Commande #${commande.id}`} description={`N° ${commande.command_number}`} />
          <div className="flex gap-2">
            <Link href={`/commandes/${commande.id}/edit`}>
              <Button variant="outline">Modifier</Button>
            </Link>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Nom de la commande</div>
                <div className="text-lg font-semibold">{commande.nom}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Numéro de commande</div>
                <div className="text-lg font-semibold">{commande.command_number}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Fournisseur</div>
                <div className="text-lg">{commande.fournisseur}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Numéro de facture</div>
                <div className="text-lg">{commande.invoice_id || '-'}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Statut</div>
                <div className="mt-2">
                  <Badge className={statutColors[commande.statut]}>
                    {statutLabels[commande.statut]}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Relations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Utilisateur</div>
                <div className="text-lg">
                  {commande.user ? (
                    <div>
                      <div className="font-semibold">{commande.user.name}</div>
                      <div className="text-sm text-muted-foreground">{commande.user.email}</div>
                    </div>
                  ) : '-'}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Ticket associé</div>
                <div className="text-lg">
                  {commande.ticket ? (
                    <Link href={`/tickets/${commande.ticket.id}`} className="text-blue-600 hover:underline">
                      #{commande.ticket.id} - {commande.ticket.title}
                    </Link>
                  ) : '-'}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Créée le</div>
                <div className="text-lg">
                  {new Date(commande.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Dernière modification</div>
                <div className="text-lg">
                  {new Date(commande.updated_at).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Changer le statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statutLabels).map(([value, label]) => (
                <Button
                  key={value}
                  variant={commande.statut === value ? 'default' : 'outline'}
                  onClick={() => handleStatusChange(value)}
                  disabled={commande.statut === value}
                >
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
