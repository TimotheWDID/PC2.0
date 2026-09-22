import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';
import axios from 'axios';
import { Save } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/heading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Devis', href: '/devis' },
  { title: 'Nouveau devis', href: '/devis/create' },
];

const INITIAL_STATUSES: Record<string, { label: string; dot: string }> = {
  draft: { label: 'Brouillon', dot: 'bg-muted-foreground' },
  to_validate: { label: 'À valider', dot: 'bg-amber-500' },
  sent: { label: 'Envoyé', dot: 'bg-blue-500' },
};

const RESULTS_LIMIT = 50;

type User = { id: number; name?: string; first_name?: string; last_name?: string; email?: string | null };
type Ticket = { id: number; user_id: number; title: string; status: string };

const userName = (user: User) => user.name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || `Client #${user.id}`;

const emptyNewUser = { first_name: '', last_name: '', email: '', phone: '' };

export default function Create({ users, tickets, ticketId }: { users: User[]; tickets: Ticket[]; ticketId?: number | null }) {
  const { data, setData, post, processing, errors } = useForm<{
    user_id: string;
    ticket_id: string;
    title: string;
    status: string;
    hiboutik_id: string;
    notes: string;
    pdf: File | null;
  }>({
    user_id: '',
    ticket_id: ticketId ? String(ticketId) : '',
    title: '',
    status: 'draft',
    hiboutik_id: '',
    notes: '',
    pdf: null,
  });

  const [userQuery, setUserQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [ticketQuery, setTicketQuery] = useState('');
  const [ticketDropdownOpen, setTicketDropdownOpen] = useState(false);
  const isTicketPreselected = Boolean(ticketId);

  const [createdUsers, setCreatedUsers] = useState<User[]>([]);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [newUserData, setNewUserData] = useState(emptyNewUser);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);

  const allUsers = useMemo(() => [...createdUsers, ...users], [createdUsers, users]);

  const selectedUser = useMemo(() => allUsers.find((user) => String(user.id) === data.user_id) ?? null, [allUsers, data.user_id]);
  const selectedTicket = useMemo(() => tickets.find((ticket) => String(ticket.id) === data.ticket_id) ?? null, [tickets, data.ticket_id]);

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    const results = query
      ? allUsers.filter((user) => userName(user).toLowerCase().includes(query) || (user.email ?? '').toLowerCase().includes(query))
      : allUsers;
    return results.slice(0, RESULTS_LIMIT);
  }, [allUsers, userQuery]);

  const filteredTickets = useMemo(() => {
    const query = ticketQuery.trim().toLowerCase();
    const results = query ? tickets.filter((ticket) => `#${ticket.id} ${ticket.title}`.toLowerCase().includes(query)) : tickets;
    return results.slice(0, RESULTS_LIMIT);
  }, [tickets, ticketQuery]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    post('/devis', { forceFormData: true });
  };

  const handleCreateUser = async () => {
    setCreateUserError(null);
    setCreatingUser(true);

    try {
      const response = await axios.post('/tickets/quick-user', {
        first_name: newUserData.first_name,
        last_name: newUserData.last_name,
        email: newUserData.email,
        phone: newUserData.phone,
      });

      const createdUser = response.data.user as User;

      setCreatedUsers((current) => [createdUser, ...current]);
      setData('user_id', String(createdUser.id));
      setUserQuery('');
      setUserDropdownOpen(false);
      setShowCreateUserDialog(false);
      setNewUserData(emptyNewUser);
    } catch {
      setCreateUserError('Impossible de créer le client pour le moment. Réessayez.');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Nouveau devis" />
      <div className="space-y-6 py-2 sm:py-4">
        <Heading title="Nouveau devis" description="Créer une demande commerciale et importer son PDF Hiboutik." />

        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>Informations du devis</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titre *</Label>
                <Input id="title" value={data.title} onChange={(e) => setData('title', e.target.value)} placeholder="Ex. Remplacement écran iPhone" />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="user-search">Client *</Label>
                <div className="relative">
                  <Input
                    id="user-search"
                    placeholder="Rechercher un client par nom ou email..."
                    value={selectedUser ? userName(selectedUser) : userQuery}
                    onChange={(e) => {
                      setUserQuery(e.target.value);
                      setUserDropdownOpen(true);
                      if (data.user_id) setData('user_id', '');
                    }}
                    onFocus={() => setUserDropdownOpen(true)}
                    onBlur={() => window.setTimeout(() => setUserDropdownOpen(false), 150)}
                  />
                  {userDropdownOpen && !selectedUser && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
                      {filteredUsers.length ? (
                        filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setData('user_id', String(user.id));
                              setUserQuery('');
                              setUserDropdownOpen(false);
                            }}
                            className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                          >
                            <p className="font-medium">{userName(user)}</p>
                            {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Aucun client trouvé.
                          {userQuery.trim() && (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto px-1"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setNewUserData((current) => ({ ...current, first_name: userQuery.trim() }));
                                setShowCreateUserDialog(true);
                              }}
                            >
                              Créer « {userQuery.trim()} »
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedUser ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setData('user_id', '')}
                  >
                    Changer de client
                  </Button>
                ) : (
                  <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs">
                        Le client n’existe pas encore ? Le créer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Créer un nouveau client</DialogTitle>
                        <DialogDescription>Ce client n’existe pas encore. Remplissez le formulaire pour le créer.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="new_first_name">Prénom</Label>
                            <Input
                              id="new_first_name"
                              value={newUserData.first_name}
                              onChange={(e) => setNewUserData({ ...newUserData, first_name: e.target.value })}
                              placeholder="Prénom"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="new_last_name">Nom</Label>
                            <Input
                              id="new_last_name"
                              value={newUserData.last_name}
                              onChange={(e) => setNewUserData({ ...newUserData, last_name: e.target.value })}
                              placeholder="Nom"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="new_email">Email</Label>
                          <Input
                            id="new_email"
                            type="email"
                            value={newUserData.email}
                            onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                            placeholder="Email"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="new_phone">Téléphone</Label>
                          <Input
                            id="new_phone"
                            value={newUserData.phone}
                            onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                            placeholder="Téléphone"
                          />
                        </div>
                        {createUserError && (
                          <Alert variant="destructive">
                            <AlertDescription>{createUserError}</AlertDescription>
                          </Alert>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button type="button" onClick={handleCreateUser} disabled={!newUserData.first_name || creatingUser}>
                            {creatingUser ? <Spinner className="mr-2" /> : null}
                            {creatingUser ? 'Création...' : "Créer le client"}
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => setShowCreateUserDialog(false)} disabled={creatingUser}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {errors.user_id && <p className="text-sm text-destructive">{errors.user_id}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ticket-search">Ticket de réparation lié (optionnel)</Label>
                <div className="relative">
                  <Input
                    id="ticket-search"
                    placeholder="Rechercher un ticket par numéro ou titre..."
                    value={selectedTicket ? `#${selectedTicket.id} - ${selectedTicket.title}` : ticketQuery}
                    disabled={isTicketPreselected}
                    onChange={(e) => {
                      setTicketQuery(e.target.value);
                      setTicketDropdownOpen(true);
                      if (data.ticket_id) setData('ticket_id', '');
                    }}
                    onFocus={() => !isTicketPreselected && setTicketDropdownOpen(true)}
                    onBlur={() => window.setTimeout(() => setTicketDropdownOpen(false), 150)}
                  />
                  {ticketDropdownOpen && !isTicketPreselected && !selectedTicket && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
                      {filteredTickets.length ? (
                        filteredTickets.map((ticket) => (
                          <button
                            key={ticket.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setData('ticket_id', String(ticket.id));
                              setTicketQuery('');
                              setTicketDropdownOpen(false);
                            }}
                            className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                          >
                            #{ticket.id} - {ticket.title}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Aucun ticket trouvé.</p>
                      )}
                    </div>
                  )}
                </div>
                {isTicketPreselected ? (
                  <p className="text-xs text-muted-foreground">Ticket pré-sélectionné depuis la page du ticket.</p>
                ) : selectedTicket ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setData('ticket_id', '')}
                  >
                    Dissocier ce ticket
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Laissez vide pour créer ou lier une réparation plus tard.</p>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="status">Statut initial</Label>
                  <Select value={data.status} onValueChange={(value) => setData('status', value)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INITIAL_STATUSES).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hiboutik_id">Référence Hiboutik (optionnel)</Label>
                  <Input
                    id="hiboutik_id"
                    value={data.hiboutik_id}
                    onChange={(e) => setData('hiboutik_id', e.target.value)}
                    placeholder="Ex. DV-2026-0042"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pdf">PDF du devis (optionnel)</Label>
                <Input id="pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => setData('pdf', e.target.files?.[0] ?? null)} />
                {errors.pdf && <p className="text-sm text-destructive">{errors.pdf}</p>}
                <p className="text-xs text-muted-foreground">PDF uniquement, 20 Mo maximum.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes commerciales</Label>
                <Textarea
                  id="notes"
                  value={data.notes}
                  onChange={(e) => setData('notes', e.target.value)}
                  rows={5}
                  placeholder="Contexte client, décisions, informations à transmettre au technicien..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={processing}>
                  {processing ? <Spinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Créer le devis
                </Button>
                <Link href="/devis">
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
