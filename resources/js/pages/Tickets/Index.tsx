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
  device?: {
    id: number;
    display_name: string;
    serial_number: string | null;
    asset_tag: string | null;
  } | null;
  available_devices?: Array<{
    id: number;
    display_name: string;
    serial_number: string | null;
    asset_tag: string | null;
  }>;
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
  deviceQuery,
  filteredUser,
  specialOnly,
}: {
  tickets: Ticket[];
  currentStatus?: string | null;
  linkableCommandes: LinkableCommande[];
  showAllStatuses?: boolean;
  deviceQuery?: string;
  filteredUser?: { id: number; name: string } | null;
  specialOnly?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [deviceSearch, setDeviceSearch] = useState(deviceQuery ?? '');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkTargetTicket, setLinkTargetTicket] = useState<Ticket | null>(null);
  const [commandeSearch, setCommandeSearch] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceTargetTicket, setDeviceTargetTicket] = useState<Ticket | null>(null);
  const [deviceIdToAttach, setDeviceIdToAttach] = useState('');
  const [isAttachingDevice, setIsAttachingDevice] = useState(false);
  const [isCreatingDevice, setIsCreatingDevice] = useState(false);
  const [newDevice, setNewDevice] = useState({
    device_type: 'computer',
    brand: '',
    model: '',
    serial_number: '',
    asset_tag: '',
    purchase_date: '',
    warranty_end_date: '',
  });

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
      (t.user?.name ?? '').toLowerCase().includes(searchLower) ||
      (t.device?.display_name ?? '').toLowerCase().includes(searchLower) ||
      (t.device?.serial_number ?? '').toLowerCase().includes(searchLower) ||
      (t.device?.asset_tag ?? '').toLowerCase().includes(searchLower)
    );
    const matchesDeviceSearch =
      !deviceSearch.trim() ||
      (t.device?.display_name ?? '').toLowerCase().includes(deviceSearch.toLowerCase()) ||
      (t.device?.serial_number ?? '').toLowerCase().includes(deviceSearch.toLowerCase()) ||
      (t.device?.asset_tag ?? '').toLowerCase().includes(deviceSearch.toLowerCase());
    const matchesStatus = statusFilters[t.status as keyof typeof statusFilters] ?? true;
    return matchesSearch && matchesStatus && matchesDeviceSearch;
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

  const openDeviceModal = (ticket: Ticket) => {
    setDeviceTargetTicket(ticket);
    setDeviceIdToAttach(ticket.device?.id ? String(ticket.device.id) : '');
    setNewDevice({
      device_type: 'computer',
      brand: '',
      model: '',
      serial_number: '',
      asset_tag: '',
      purchase_date: '',
      warranty_end_date: '',
    });
    setIsDeviceModalOpen(true);
  };

  const closeDeviceModal = () => {
    setIsDeviceModalOpen(false);
    setDeviceTargetTicket(null);
    setDeviceIdToAttach('');
    setIsAttachingDevice(false);
    setIsCreatingDevice(false);
  };

  const handleAttachDevice = () => {
    if (!deviceTargetTicket) return;

    setIsAttachingDevice(true);
    router.patch(
      `/tickets/${deviceTargetTicket.id}/attach-device`,
      { device_id: deviceIdToAttach || null },
      {
        preserveScroll: true,
        onSuccess: () => closeDeviceModal(),
        onFinish: () => setIsAttachingDevice(false),
      },
    );
  };

  const handleCreateAndAttachDevice = () => {
    if (!deviceTargetTicket) return;

    setIsCreatingDevice(true);
    router.post(
      `/tickets/${deviceTargetTicket.id}/create-device`,
      newDevice,
      {
        preserveScroll: true,
        onSuccess: () => closeDeviceModal(),
        onFinish: () => setIsCreatingDevice(false),
      },
    );
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={pageTitle} />
      <div className="py-2 sm:py-4 w-full">
        <Heading
          title={pageTitle}
          description={clientScope ? `${baseDescription} - ${clientScope}` : baseDescription}
        />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{listTitle}</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input placeholder="Rechercher par ID, sujet, demandeur ou appareil" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Input placeholder="Filtrer par n° serie / suivi" value={deviceSearch} onChange={(e) => setDeviceSearch(e.target.value)} />
              {specialOnly ? (
                <Link href="/tickets/bugs-improvements/create?ticket_kind=bug">
                  <Button variant="default" className="w-full sm:w-auto">Signaler un bug / Proposer une amélioration</Button>
                </Link>
              ) : (
                <Link href="/tickets/create">
                  <Button variant="default" className="w-full sm:w-auto">Nouveau ticket</Button>
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
            <div className="space-y-2 p-3 sm:hidden">
              {filtered && filtered.length ? (
                filtered.map((t) => (
                  <div key={t.id} className="rounded-md border p-3 transition-colors hover:bg-muted/40">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-semibold">#{t.id} - {t.title ?? '-'}</p>
                      <Badge variant={t.status === 'open' ? 'destructive' : t.status === 'in_progress' ? 'default' : t.status === 'pending' ? 'secondary' : 'outline'}>
                        {translateStatus(t.status ?? '-')}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Demandeur: {t.user?.name ?? '-'}</p>
                      <p>Appareil: {t.device?.display_name ?? '-'}</p>
                      <p>Créé le: {t.created_at ?? '-'}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link href={`/tickets/${t.id}`}>
                        <Button type="button" variant="secondary" size="sm">Ouvrir</Button>
                      </Link>
                      {t.commande ? (
                        <Link href={`/commandes/${t.commande.id}`}>
                          <Button type="button" variant="outline" size="sm">Commande #{t.commande.id}</Button>
                        </Link>
                      ) : (
                        <>
                          <Button type="button" variant="outline" size="sm" onClick={() => openLinkModal(t)}>
                            Lier
                          </Button>
                          <Link href={`/commandes/create?ticket_id=${t.id}`}>
                            <Button type="button" variant="default" size="sm">
                              Créer cmd
                            </Button>
                          </Link>
                        </>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => openDeviceModal(t)}>
                        Appareil
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">Aucun ticket trouvé.</div>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Sujet</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Demandeur</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Appareil</th>
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
                      <td className="px-4 py-4 text-sm text-muted-foreground">{t.device?.display_name ?? '-'}</td>
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
                          <Button type="button" variant="outline" size="sm" onClick={() => openDeviceModal(t)}>
                            Appareil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun ticket trouvé.</td>
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

        {isDeviceModalOpen && deviceTargetTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeDeviceModal}>
            <div className="w-full max-w-2xl rounded-lg border bg-background shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-base font-semibold">
                  Appareil du ticket #{deviceTargetTicket.id}
                </h3>
                <Button type="button" variant="ghost" size="sm" onClick={closeDeviceModal}>
                  Fermer
                </Button>
              </div>

              <div className="space-y-4 p-4">
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Lier un appareil existant</p>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={deviceIdToAttach}
                    onChange={(e) => setDeviceIdToAttach(e.target.value)}
                  >
                    <option value="">-- Aucun appareil --</option>
                    {(deviceTargetTicket.available_devices ?? []).map((device) => (
                      <option key={device.id} value={device.id}>{device.display_name}</option>
                    ))}
                  </select>
                  <Button type="button" size="sm" onClick={handleAttachDevice} disabled={isAttachingDevice}>
                    {isAttachingDevice ? 'En cours...' : 'Enregistrer'}
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Créer puis lier un appareil</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Type</Label>
                      <select
                        className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newDevice.device_type}
                        onChange={(e) => setNewDevice({ ...newDevice, device_type: e.target.value })}
                      >
                        <option value="computer">Ordinateur</option>
                        <option value="phone">Telephone</option>
                        <option value="tablet">Tablette</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                    <div>
                      <Label>Marque</Label>
                      <Input value={newDevice.brand} onChange={(e) => setNewDevice({ ...newDevice, brand: e.target.value })} />
                    </div>
                    <div>
                      <Label>Modele *</Label>
                      <Input value={newDevice.model} onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })} />
                    </div>
                    <div>
                      <Label>Numero de serie</Label>
                      <Input value={newDevice.serial_number} onChange={(e) => setNewDevice({ ...newDevice, serial_number: e.target.value })} />
                    </div>
                    <div>
                      <Label>Numero de suivi</Label>
                      <Input value={newDevice.asset_tag} onChange={(e) => setNewDevice({ ...newDevice, asset_tag: e.target.value })} />
                    </div>
                    <div>
                      <Label>Date d'achat</Label>
                      <Input type="date" value={newDevice.purchase_date} onChange={(e) => setNewDevice({ ...newDevice, purchase_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Fin de garantie</Label>
                      <Input type="date" value={newDevice.warranty_end_date} onChange={(e) => setNewDevice({ ...newDevice, warranty_end_date: e.target.value })} />
                    </div>
                  </div>
                  <Button type="button" size="sm" onClick={handleCreateAndAttachDevice} disabled={isCreatingDevice || !newDevice.model.trim()}>
                    {isCreatingDevice ? 'Creation...' : 'Creer et lier'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
