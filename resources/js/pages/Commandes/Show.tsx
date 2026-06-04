import { Head, Link, router } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { useState } from 'react';
import { formatDateFr, formatDateTimeFr } from '@/lib/datetime';
import MobileNativeNav from '@/components/mobile-native-nav';

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
  'new': 'status-badge-new',
  'panier': 'status-badge-panier',
  'commandé': 'status-badge-commande',
  'réceptionner': 'status-badge-reception',
  'traité': 'status-badge-traite',
};

export default function Show({ commande }: { commande: Commande }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [fournisseurInput, setFournisseurInput] = useState(commande.fournisseur ?? '');
  const [commandNumberInput, setCommandNumberInput] = useState(commande.command_number ?? '');

  const handleDelete = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) {
      setIsDeleting(true);
      router.delete(`/commandes/${commande.id}`);
    }
  };

  const requiresFournisseur = (status: string) => status !== 'new';
  const requiresCommandNumber = (status: string) => ['commandé', 'réceptionner', 'traité'].includes(status);

  const openStatusModal = (newStatus: string) => {
    setPendingStatus(newStatus);
    setStatusError(null);
    setStatusModalOpen(true);
  };

  const handleStatusChange = () => {
    if (!pendingStatus) return;

    const fournisseur = fournisseurInput.trim();
    const commandNumber = commandNumberInput.trim();

    if (requiresFournisseur(pendingStatus) && !fournisseur) {
      setStatusError('Le fournisseur est requis pour ce statut.');
      return;
    }

    if (requiresCommandNumber(pendingStatus) && !commandNumber) {
      setStatusError('Le numero de commande est requis pour ce statut.');
      return;
    }

    setStatusSubmitting(true);

    router.put(`/commandes/${commande.id}`, {
      user_id: commande.user_id,
      ticket_id: commande.ticket_id,
      nom: commande.nom,
      fournisseur,
      command_number: commandNumber,
      invoice_id: commande.invoice_id,
      statut: pendingStatus,
    }, {
      preserveScroll: true,
      onSuccess: () => {
        setStatusModalOpen(false);
        setPendingStatus(null);
        setStatusError(null);
      },
      onError: (errors) => {
        const firstError = (errors.statut || errors.fournisseur || errors.command_number || errors.nom) as string | undefined;
        setStatusError(firstError || 'Impossible de modifier le statut pour le moment.');
      },
      onFinish: () => {
        setStatusSubmitting(false);
      },
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs(commande.id)}>
      <Head title={`Commande #${commande.id}`} />
      <div className="space-y-6 pb-24 lg:pb-0">
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
                    <Link href={`/tickets/${commande.ticket.id}`} className="text-primary hover:underline">
                      #{commande.ticket.id} - {commande.ticket.title}
                    </Link>
                  ) : '-'}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Créée le</div>
                <div className="text-lg">
                  {formatDateFr(commande.created_at, {
                    timeZone: 'Europe/Paris',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground">Dernière modification</div>
                <div className="text-lg">
                  {formatDateTimeFr(commande.updated_at, {
                    timeZone: 'Europe/Paris',
                    month: 'long',
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
                  onClick={() => openStatusModal(value)}
                  disabled={commande.statut === value}
                >
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer le changement de statut</DialogTitle>
              <DialogDescription>
                Vous allez passer la commande au statut{' '}
                <span className="font-semibold">{pendingStatus ? statutLabels[pendingStatus] : '-'}</span>.
                Renseignez les prerequis ci-dessous si necessaire.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {pendingStatus && requiresFournisseur(pendingStatus) && (
                <div className="space-y-2">
                  <Label htmlFor="modal_fournisseur">Fournisseur *</Label>
                  <Input
                    id="modal_fournisseur"
                    value={fournisseurInput}
                    onChange={(e) => {
                      setFournisseurInput(e.target.value);
                      if (statusError) setStatusError(null);
                    }}
                    placeholder="Nom du fournisseur"
                  />
                </div>
              )}

              {pendingStatus && requiresCommandNumber(pendingStatus) && (
                <div className="space-y-2">
                  <Label htmlFor="modal_command_number">Numero de commande *</Label>
                  <Input
                    id="modal_command_number"
                    value={commandNumberInput}
                    onChange={(e) => {
                      setCommandNumberInput(e.target.value);
                      if (statusError) setStatusError(null);
                    }}
                    placeholder="Ex: CMD-2026-001"
                  />
                </div>
              )}

              {pendingStatus === 'new' && (
                <p className="text-sm text-muted-foreground">Aucun prerequis obligatoire pour ce statut.</p>
              )}

              {statusError && (
                <p className="text-sm text-destructive">{statusError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusModalOpen(false);
                  setStatusError(null);
                }}
                disabled={statusSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleStatusChange}
                disabled={statusSubmitting}
              >
                {statusSubmitting ? 'Mise à jour...' : 'Valider le changement'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <MobileNativeNav fabHref="/commandes/create" fabLabel="Nouvelle commande" />
    </AppLayout>
  );
}

