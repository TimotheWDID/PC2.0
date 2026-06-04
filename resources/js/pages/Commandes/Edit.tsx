import { useForm, Head, Link, router } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { useState, useEffect, useMemo } from 'react';

type User = {
  id: number;
  name?: string;
  email?: string | null;
};

type Ticket = {
  id: number;
  title: string;
  uuid: string;
  user?: {
    id: number;
    name?: string;
    first_name?: string;
    last_name?: string;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type Commande = {
  id: number;
  user_id: number;
  ticket_id: number | null;
  nom: string;
  fournisseur: string;
  command_number: string;
  invoice_id: string | null;
  statut: string;
};

import MobileNativeNav from '@/components/mobile-native-nav';

const breadcrumbs = (commandeId: number): BreadcrumbItem[] => [
  { title: 'Commandes', href: '/commandes' },
  { title: `Commande #${commandeId}`, href: `/commandes/${commandeId}` },
  { title: 'Modifier', href: `/commandes/${commandeId}/edit` },
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

export default function Edit({ commande, users, tickets }: { commande: Commande; users: User[]; tickets: Ticket[] }) {
  const { data, setData, put, processing, errors } = useForm({
    user_id: commande.user_id.toString(),
    ticket_id: commande.ticket_id?.toString() || '',
    nom: commande.nom,
    fournisseur: commande.fournisseur,
    command_number: commande.command_number,
    invoice_id: commande.invoice_id || '',
    statut: commande.statut,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [showTicketDropdown, setShowTicketDropdown] = useState(false);
  const [showTicketDetails, setShowTicketDetails] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((user) => {
      const name = (user.name ?? '').toLowerCase();
      const email = (user.email ?? '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [searchQuery, users]);

  const getTicketCustomerName = (ticket: Ticket): string => {
    return ticket.user?.name?.trim()
      || `${ticket.user?.first_name ?? ''} ${ticket.user?.last_name ?? ''}`.trim()
      || '';
  };

  const filteredTickets = useMemo(() => {
    const query = ticketSearchQuery.trim().toLowerCase();

    if (!query) return tickets;

    return tickets.filter((ticket) => {
      const customerName = getTicketCustomerName(ticket).toLowerCase();
      const email = (ticket.user?.email ?? '').toLowerCase();
      const phone = (ticket.user?.phone ?? '').toLowerCase();
      const title = (ticket.title ?? '').toLowerCase();
      const id = ticket.id.toString();

      return id.includes(query)
        || title.includes(query)
        || customerName.includes(query)
        || email.includes(query)
        || phone.includes(query);
    });
  }, [ticketSearchQuery, tickets]);

  const selectedTicket = useMemo(() => {
    if (!data.ticket_id) return null;
    return tickets.find((ticket) => ticket.id.toString() === data.ticket_id) ?? null;
  }, [data.ticket_id, tickets]);

  const formatTicketOption = (ticket: Ticket): string => {
    const customerName = getTicketCustomerName(ticket);

    return [
      `#${ticket.id}`,
      ticket.title,
      customerName || null,
      ticket.user?.email || null,
      ticket.user?.phone || null,
    ]
      .filter(Boolean)
      .join(' - ');
  };

  useEffect(() => {
    const currentUser = users.find(u => u.id === commande.user_id);
    if (currentUser) {
      setSelectedUser(currentUser);
    }
  }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    setTicketSearchQuery(formatTicketOption(selectedTicket));
  }, [selectedTicket]);

  const handleCreateUser = () => {
    window.open('/users/create', '_blank');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    put(`/commandes/${commande.id}`);
  };

  const handleStatusChange = (newStatus: string) => {
    router.patch(`/commandes/${commande.id}/status`, { statut: newStatus }, {
      preserveScroll: true,
      onSuccess: () => {
        setData('statut', newStatus);
      },
    });
  };

  // Fonction pour vérifier si un statut peut être sélectionné
  const canChangeToStatus = (status: string): boolean => {
    switch (status) {
      case 'new':
        return true;
      case 'panier':
        return !!data.fournisseur;
      case 'commandé':
      case 'réceptionner':
      case 'traité':
        return !!data.fournisseur && !!data.command_number;
      default:
        return false;
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs(commande.id)}>
      <Head title={`Modifier commande #${commande.id}`} />
      <div className="space-y-6">
        <Heading title={`Modifier la commande #${commande.id}`} description="Modifiez les informations de la commande" />

        <Card>
          <CardHeader>
            <CardTitle>Informations de la commande</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <Label htmlFor="search_user">Utilisateur *</Label>
                <Input
                  id="search_user"
                  type="text"
                  placeholder="Tapez un nom ou email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedUser) {
                      setSelectedUser(null);
                      setData('user_id', '');
                    }
                  }}
                />

                {selectedUser && (
                  <div className="mt-3 p-3 bg-background border rounded-md">
                    <p className="font-medium">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.email || "Pas d'email"}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchQuery('');
                        setData('user_id', '');
                      }}
                      className="mt-2"
                    >
                      Changer d'utilisateur
                    </Button>
                  </div>
                )}

                {searchQuery && !selectedUser && filteredUsers.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-48 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUser(user);
                          setData('user_id', user.id.toString());
                          setSearchQuery('');
                        }}
                        className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0"
                      >
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email || "Pas d'email"}</p>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery && !selectedUser && filteredUsers.length === 0 && (
                  <div className="mt-2 p-3 bg-background border rounded-md">
                    <p className="text-sm">Aucun utilisateur trouvé.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateUser}
                      className="mt-2"
                    >
                      Créer un nouvel utilisateur
                    </Button>
                  </div>
                )}

                <input type="hidden" name="user_id" value={data.user_id} />
                {errors.user_id && <div className="text-destructive text-sm mt-1">{errors.user_id}</div>}
              </div>

              <div>
                <Label htmlFor="ticket_id">Ticket (optionnel)</Label>
                <div className="relative">
                  <Input
                    id="ticket_id"
                    type="text"
                    placeholder="Rechercher et selectionner un ticket (id, titre, client, email, tel)..."
                    value={ticketSearchQuery}
                    onChange={(e) => {
                      setTicketSearchQuery(e.target.value);
                      setShowTicketDropdown(true);
                      setShowTicketDetails(false);
                      setData('ticket_id', '');
                    }}
                    onFocus={() => setShowTicketDropdown(true)}
                    onBlur={() => {
                      window.setTimeout(() => setShowTicketDropdown(false), 150);
                    }}
                  />

                  {showTicketDropdown && (
                    <div className="absolute z-20 mt-1 w-full border rounded-md bg-background shadow max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        className="w-full text-left p-3 hover:bg-muted border-b"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setData('ticket_id', '');
                          setTicketSearchQuery('');
                          setShowTicketDetails(false);
                          setShowTicketDropdown(false);
                        }}
                      >
                        -- Aucun --
                      </button>

                      {filteredTickets.map((ticket) => {
                        const label = formatTicketOption(ticket);

                        return (
                          <button
                            key={ticket.id}
                            type="button"
                            className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setData('ticket_id', ticket.id.toString());
                              setTicketSearchQuery(label);
                              setShowTicketDetails(false);
                              setShowTicketDropdown(false);
                            }}
                          >
                            <span className="text-sm">{label}</span>
                          </button>
                        );
                      })}

                      {filteredTickets.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground">Aucun ticket ne correspond a votre recherche.</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedTicket && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => setShowTicketDetails((prev) => !prev)}
                      >
                        {showTicketDetails ? 'Masquer les details' : 'Afficher plus de details'}
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/tickets/${selectedTicket.id}`}>
                          Afficher le ticket
                        </Link>
                      </Button>
                    </div>

                    {showTicketDetails && (
                      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                        <p className="text-sm font-medium">Details du ticket</p>
                        <div className="grid gap-2 text-xs sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">ID:</span>{' '}
                            <span className="font-medium">#{selectedTicket.id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">UUID:</span>{' '}
                            <span className="font-medium">{selectedTicket.uuid}</span>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-muted-foreground">Titre:</span>{' '}
                            <span className="font-medium">{selectedTicket.title}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Client:</span>{' '}
                            <span className="font-medium">{getTicketCustomerName(selectedTicket) || 'Non renseigne'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Email:</span>{' '}
                            <span className="font-medium">{selectedTicket.user?.email || 'Non renseigne'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Telephone:</span>{' '}
                            <span className="font-medium">{selectedTicket.user?.phone || 'Non renseigne'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {errors.ticket_id && <div className="text-destructive text-sm mt-1">{errors.ticket_id}</div>}
              </div>

              <div>
                <Label htmlFor="nom">Nom de la commande *</Label>
                <Input
                  id="nom"
                  value={data.nom}
                  onChange={(e) => setData('nom', e.target.value)}
                  placeholder="Ex: Matériel informatique"
                  required
                />
                {errors.nom && <div className="text-destructive text-sm mt-1">{errors.nom}</div>}
              </div>

              <div>
                <Label htmlFor="fournisseur">
                  Fournisseur {data.statut !== 'new' && '*'}
                  {data.statut === 'new' && <span className="text-xs text-muted-foreground">(requis pour passer à "Panier")</span>}
                </Label>
                <Input
                  id="fournisseur"
                  value={data.fournisseur}
                  onChange={(e) => setData('fournisseur', e.target.value)}
                  required={data.statut !== 'new'}
                />
                {errors.fournisseur && <div className="text-destructive text-sm mt-1">{errors.fournisseur}</div>}
              </div>

              <div>
                <Label htmlFor="command_number">
                  Numéro de commande {!['new', 'panier'].includes(data.statut) && '*'}
                  {['new', 'panier'].includes(data.statut) && <span className="text-xs text-muted-foreground">(requis pour passer à "Commandé")</span>}
                </Label>
                <Input
                  id="command_number"
                  value={data.command_number}
                  onChange={(e) => setData('command_number', e.target.value)}
                  required={!['new', 'panier'].includes(data.statut)}
                />
                {errors.command_number && <div className="text-destructive text-sm mt-1">{errors.command_number}</div>}
              </div>

              <div>
                <Label htmlFor="invoice_id">Numéro de facture</Label>
                <Input
                  id="invoice_id"
                  value={data.invoice_id}
                  onChange={(e) => setData('invoice_id', e.target.value)}
                />
                {errors.invoice_id && <div className="text-destructive text-sm mt-1">{errors.invoice_id}</div>}
              </div>

              <div>
                <Label htmlFor="statut">Statut *</Label>
                <select
                  id="statut"
                  name="statut"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={data.statut}
                  onChange={(e) => setData('statut', e.target.value)}
                  required
                >
                  <option value="new">Nouveau</option>
                  <option value="panier">Panier</option>
                  <option value="commandé">Commandé</option>
                  <option value="réceptionner">Réceptionné</option>
                  <option value="traité">Traité</option>
                </select>
                {errors.statut && <div className="text-destructive text-sm mt-1">{errors.statut}</div>}
              </div>

              <div className="flex space-x-2 pt-4">
                <Button type="submit" disabled={processing} variant="default">
                  Mettre à jour
                </Button>
                <Button asChild variant="secondary">
                  <Link href={`/commandes/${commande.id}`}>Annuler</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changer le statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="text-sm font-medium text-muted-foreground mb-2">Statut actuel</div>
              <Badge className={statutColors[data.statut]}>
                {statutLabels[data.statut]}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statutLabels).map(([value, label]) => {
                const isDisabled = !canChangeToStatus(value);
                const isCurrent = data.statut === value;

                return (
                  <div key={value} className="flex flex-col items-start gap-1 min-w-[120px]">
                    <Button
                      variant={isCurrent ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(value)}
                      disabled={isCurrent || isDisabled}
                      className={`w-full ${isDisabled && !isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {label}
                    </Button>
                    {isDisabled && !isCurrent && (
                      <div className="text-xs text-muted-foreground whitespace-normal">
                        {value === 'panier' && !data.fournisseur && 'Fournisseur requis'}
                        {['commandé', 'réceptionner', 'traité'].includes(value) &&
                         (!data.fournisseur || !data.command_number) &&
                         'Fournisseur et N° requis'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}

