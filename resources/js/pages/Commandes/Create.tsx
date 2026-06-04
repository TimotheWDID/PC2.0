import { useForm, Head, Link, router } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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

import MobileNativeNav from '@/components/mobile-native-nav';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Commandes', href: '/commandes' },
  { title: 'Créer une commande', href: '/commandes/create' },
];

export default function Create({
  users,
  tickets,
  ticketId,
  ticketUserId,
}: {
  users: User[];
  tickets: Ticket[];
  ticketId?: string;
  ticketUserId?: number | null;
}) {
  const { data, setData, post, processing, errors } = useForm({
    user_id: '',
    ticket_id: ticketId || '',
    nom: '',
    fournisseur: '',
    command_number: '',
    invoice_id: '',
    statut: 'new',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [showTicketDropdown, setShowTicketDropdown] = useState(false);
  const isTicketPreselected = Boolean(ticketId);

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
    // If ticket_id is provided via URL, set it in the form
    if (ticketId) {
      setData('ticket_id', ticketId);
    }

    if (ticketUserId) {
      const ticketUser = users.find((user) => user.id === ticketUserId) || null;
      if (ticketUser) {
        setData('user_id', ticketUser.id.toString());
        setSelectedUser(ticketUser);
        setSearchQuery('');
      }
    }
  }, [ticketId, ticketUserId, users]);

  useEffect(() => {
    if (!selectedTicket) return;
    setTicketSearchQuery(formatTicketOption(selectedTicket));
  }, [selectedTicket]);

  const handleCreateUser = () => {
    // Ouvrir la page de création d'utilisateur dans un nouvel onglet
    window.open('/users/create', '_blank');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/commandes');
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Créer une commande" />
      <div className="space-y-6">
        <Heading title="Créer une commande" description="Remplissez le formulaire pour créer une nouvelle commande" />

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle commande</CardTitle>
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
                      setData('ticket_id', '');
                    }}
                    onFocus={() => {
                      if (!isTicketPreselected) {
                        setShowTicketDropdown(true);
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setShowTicketDropdown(false), 150);
                    }}
                    disabled={isTicketPreselected}
                  />

                  {showTicketDropdown && !isTicketPreselected && (
                    <div className="absolute z-20 mt-1 w-full border rounded-md bg-background shadow max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        className="w-full text-left p-3 hover:bg-muted border-b"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setData('ticket_id', '');
                          setTicketSearchQuery('');
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

                {!isTicketPreselected && selectedTicket && (
                  <p className="text-xs text-muted-foreground mt-1">Ticket selectionne: #{selectedTicket.id}</p>
                )}
                {isTicketPreselected && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ticket pré-sélectionné depuis la page du ticket
                  </p>
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
                  Créer
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/commandes">Annuler</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}

