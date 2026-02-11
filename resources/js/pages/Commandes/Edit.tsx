import { useForm, Head, Link, router } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { useState, useEffect } from 'react';

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
  statut: string;
};

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
  'new': 'bg-blue-500',
  'panier': 'bg-yellow-500',
  'commandé': 'bg-purple-500',
  'réceptionner': 'bg-green-500',
  'traité': 'bg-gray-500',
};

export default function Edit({ commande, users, tickets }: { commande: Commande; users: User[]; tickets: Ticket[] }) {
  const { data, setData, put, processing, errors } = useForm({
    user_id: commande.user_id.toString(),
    user_search: '',
    ticket_id: commande.ticket_id?.toString() || '',
    nom: commande.nom,
    fournisseur: commande.fournisseur,
    command_number: commande.command_number,
    invoice_id: commande.invoice_id || '',
    statut: commande.statut,
  });

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>(users);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);

  useEffect(() => {
    const currentUser = users.find(u => u.id === commande.user_id);
    if (currentUser) {
      setSelectedUserName(currentUser.name);
    }
  }, []);

  const handleUserSearch = (value: string) => {
    setData('user_search', value);
    setSelectedUserName('');
    setData('user_id', '');

    if (value.trim() === '') {
      setFilteredUsers(users);
      setShowCreateUser(false);
    } else {
      const filtered = users.filter(user =>
        user.name.toLowerCase().includes(value.toLowerCase()) ||
        user.email.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredUsers(filtered);
      setShowCreateUser(filtered.length === 0);
    }
    setShowUserDropdown(true);
  };

  const selectUser = (user: User) => {
    setData('user_id', user.id.toString());
    setSelectedUserName(user.name);
    setData('user_search', '');
    setShowUserDropdown(false);
    setShowCreateUser(false);
  };

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
                <Label htmlFor="user_search">Utilisateur *</Label>
                <div className="relative">
                  <Input
                    id="user_search"
                    type="text"
                    placeholder="Rechercher un utilisateur..."
                    value={selectedUserName || data.user_search}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    onFocus={() => setShowUserDropdown(true)}
                    onBlur={() => setTimeout(() => setShowUserDropdown(false), 200)}
                    className="pr-10"
                  />
                  {selectedUserName && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserName('');
                        setData('user_id', '');
                        setData('user_search', '');
                        setShowUserDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {showUserDropdown && (data.user_search || !selectedUserName) && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-input bg-popover shadow-lg max-h-60 overflow-auto">
                    {filteredUsers.length > 0 ? (
                      <ul className="py-1">
                        {filteredUsers.map((user) => (
                          <li
                            key={user.id}
                            onClick={() => selectUser(user)}
                            className="px-4 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </li>
                        ))}
                      </ul>
                    ) : showCreateUser ? (
                      <div className="p-4">
                        <p className="text-sm text-muted-foreground mb-2">Aucun utilisateur trouvé</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCreateUser}
                        >
                          Créer un nouvel utilisateur
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}

                <input type="hidden" name="user_id" value={data.user_id} />
                {errors.user_id && <div className="text-red-500 text-sm mt-1">{errors.user_id}</div>}
              </div>

              <div>
                <Label htmlFor="ticket_id">Ticket (optionnel)</Label>
                <select
                  id="ticket_id"
                  name="ticket_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={data.ticket_id}
                  onChange={(e) => setData('ticket_id', e.target.value)}
                >
                  <option value="">-- Aucun --</option>
                  {tickets.map((ticket) => (
                    <option key={ticket.id} value={ticket.id}>
                      #{ticket.id} - {ticket.title}
                    </option>
                  ))}
                </select>
                {errors.ticket_id && <div className="text-red-500 text-sm mt-1">{errors.ticket_id}</div>}
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
                {errors.nom && <div className="text-red-500 text-sm mt-1">{errors.nom}</div>}
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
                {errors.fournisseur && <div className="text-red-500 text-sm mt-1">{errors.fournisseur}</div>}
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
                {errors.command_number && <div className="text-red-500 text-sm mt-1">{errors.command_number}</div>}
              </div>

              <div>
                <Label htmlFor="invoice_id">Numéro de facture</Label>
                <Input
                  id="invoice_id"
                  value={data.invoice_id}
                  onChange={(e) => setData('invoice_id', e.target.value)}
                />
                {errors.invoice_id && <div className="text-red-500 text-sm mt-1">{errors.invoice_id}</div>}
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
                {errors.statut && <div className="text-red-500 text-sm mt-1">{errors.statut}</div>}
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
    </AppLayout>
  );
}
