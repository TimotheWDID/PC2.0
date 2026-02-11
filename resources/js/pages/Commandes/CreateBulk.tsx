import { useForm, Head, Link, router } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

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

type CommandeItem = {
  id: string;
  nom: string;
  user_id: string;
  user_search: string;
  ticket_id: string;
  invoice_id: string;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Commandes', href: '/commandes' },
  { title: 'Créer des commandes groupées', href: '/commandes/create-bulk' },
];

export default function CreateBulk({ users, tickets }: { users: User[]; tickets: Ticket[] }) {
  const [fournisseur, setFournisseur] = useState('');
  const [commandNumber, setCommandNumber] = useState('');
  const [items, setItems] = useState<CommandeItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const [showUserDropdowns, setShowUserDropdowns] = useState<{ [key: string]: boolean }>({});
  const [filteredUsersMap, setFilteredUsersMap] = useState<{ [key: string]: User[] }>({});
  const [selectedUserNames, setSelectedUserNames] = useState<{ [key: string]: string }>({});
  const [showCreateUser, setShowCreateUser] = useState<{ [key: string]: boolean }>({});

  const addItem = () => {
    const newItem: CommandeItem = {
      id: Date.now().toString(),
      nom: '',
      user_id: '',
      user_search: '',
      ticket_id: '',
      invoice_id: '',
    };
    setItems([...items, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof CommandeItem, value: string) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleUserSearch = (itemId: string, value: string) => {
    updateItem(itemId, 'user_search', value);

    setSelectedUserNames(prev => ({ ...prev, [itemId]: '' }));
    updateItem(itemId, 'user_id', '');

    if (value.trim() === '') {
      setFilteredUsersMap(prev => ({ ...prev, [itemId]: users }));
      setShowCreateUser(prev => ({ ...prev, [itemId]: false }));
    } else {
      const filtered = users.filter(user =>
        user.name.toLowerCase().includes(value.toLowerCase()) ||
        user.email.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredUsersMap(prev => ({ ...prev, [itemId]: filtered }));
      setShowCreateUser(prev => ({ ...prev, [itemId]: filtered.length === 0 }));
    }
    setShowUserDropdowns(prev => ({ ...prev, [itemId]: true }));
  };

  const selectUser = (itemId: string, user: User) => {
    setItems(items.map(item =>
      item.id === itemId
        ? { ...item, user_id: user.id.toString(), user_search: '' }
        : item
    ));
    setSelectedUserNames(prev => ({ ...prev, [itemId]: user.name }));
    setShowUserDropdowns(prev => ({ ...prev, [itemId]: false }));
    setShowCreateUser(prev => ({ ...prev, [itemId]: false }));
  };

  const handleCreateUser = () => {
    window.open('/users/create', '_blank');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setErrors({});

    // Validation côté client
    const validationErrors: any = {};

    if (!fournisseur.trim()) {
      validationErrors.fournisseur = 'Le champ fournisseur est obligatoire.';
    }

    if (!commandNumber.trim()) {
      validationErrors.command_number = 'Le champ numéro de commande est obligatoire.';
    }

    if (items.length === 0) {
      validationErrors.items = 'Vous devez ajouter au moins un article.';
    }

    items.forEach((item, index) => {
      if (!item.nom.trim()) {
        validationErrors[`items.${index}.nom`] = 'Le nom de l\'article est obligatoire.';
      }
      if (!item.user_id || item.user_id.trim() === '') {
        validationErrors[`items.${index}.user_id`] = 'Vous devez sélectionner un client.';
      }
    });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setProcessing(false);
      return;
    }

    // Transformer les items pour envoyer les bonnes données
    const itemsToSubmit = items.map(item => ({
      nom: item.nom,
      user_id: parseInt(item.user_id),
      ticket_id: item.ticket_id ? parseInt(item.ticket_id) : null,
      invoice_id: item.invoice_id || null,
    }));

    console.log('Données à envoyer:', {
      fournisseur: fournisseur,
      command_number: commandNumber,
      items: itemsToSubmit,
    });

    router.post('/commandes/bulk-store', {
      fournisseur: fournisseur,
      command_number: commandNumber,
      items: itemsToSubmit,
    }, {
      onSuccess: () => {
        setProcessing(false);
      },
      onError: (errors) => {
        setErrors(errors);
        setProcessing(false);
      },
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Créer des commandes groupées" />
      <div className="py-4 w-full">
        <Heading
          title="Créer des commandes groupées"
          description="Créez plusieurs commandes avec un seul fournisseur et numéro de commande"
        />

        <form onSubmit={submit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Informations communes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fournisseur">Fournisseur *</Label>
                  <Input
                    id="fournisseur"
                    value={fournisseur}
                    onChange={(e) => setFournisseur(e.target.value)}
                    required
                  />
                  {errors.fournisseur && <div className="text-red-500 text-sm mt-1">{errors.fournisseur}</div>}
                </div>

                <div>
                  <Label htmlFor="command_number">Numéro de commande *</Label>
                  <Input
                    id="command_number"
                    value={commandNumber}
                    onChange={(e) => setCommandNumber(e.target.value)}
                    required
                  />
                  {errors.command_number && <div className="text-red-500 text-sm mt-1">{errors.command_number}</div>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Articles à commander</CardTitle>
                <Button type="button" onClick={addItem} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter un article
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Aucun article ajouté. Cliquez sur "Ajouter un article" pour commencer.</p>
                </div>
              ) : (
                items.map((item, index) => (
                  <Card key={item.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Article #{index + 1}</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor={`nom-${item.id}`}>Nom de l'article *</Label>
                          <Input
                            id={`nom-${item.id}`}
                            value={item.nom}
                            onChange={(e) => updateItem(item.id, 'nom', e.target.value)}
                            placeholder="Ex: Ordinateur portable"
                            required
                          />
                          {errors[`items.${index}.nom` as keyof typeof errors] && (
                            <div className="text-red-500 text-sm mt-1">
                              {errors[`items.${index}.nom` as keyof typeof errors]}
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <Label htmlFor={`user-${item.id}`}>Client *</Label>
                          <div className="relative">
                            <Input
                              id={`user-${item.id}`}
                              value={selectedUserNames[item.id] || item.user_search}
                              onChange={(e) => handleUserSearch(item.id, e.target.value)}
                              onFocus={() => {
                                if (!selectedUserNames[item.id]) {
                                  setShowUserDropdowns(prev => ({ ...prev, [item.id]: true }));
                                  setFilteredUsersMap(prev => ({ ...prev, [item.id]: users }));
                                }
                              }}
                              placeholder="Rechercher un client..."
                              required
                            />
                            {selectedUserNames[item.id] && (
                              <button
                                type="button"
                                onClick={() => {
                                  updateItem(item.id, 'user_id', '');
                                  setSelectedUserNames(prev => ({ ...prev, [item.id]: '' }));
                                  updateItem(item.id, 'user_search', '');
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {showUserDropdowns[item.id] && !selectedUserNames[item.id] && (
                            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                              {filteredUsersMap[item.id]?.length > 0 ? (
                                filteredUsersMap[item.id].map((user) => (
                                  <div
                                    key={user.id}
                                    onClick={() => selectUser(item.id, user)}
                                    className="px-3 py-2 hover:bg-accent cursor-pointer"
                                  >
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                  </div>
                                ))
                              ) : null}

                              {showCreateUser[item.id] ? (
                                <div className="p-3 border-t bg-muted/50">
                                  <p className="text-sm text-muted-foreground mb-2">
                                    Aucun utilisateur trouvé
                                  </p>
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

                          <input type="hidden" name={`items[${index}][user_id]`} value={item.user_id} />
                          {!item.user_id && selectedUserNames[item.id] && (
                            <div className="text-amber-600 text-sm mt-1">
                              ⚠️ Veuillez sélectionner un client dans la liste
                            </div>
                          )}
                          {errors[`items.${index}.user_id` as keyof typeof errors] && (
                            <div className="text-red-500 text-sm mt-1">
                              {errors[`items.${index}.user_id` as keyof typeof errors]}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`ticket-${item.id}`}>Ticket (optionnel)</Label>
                          <select
                            id={`ticket-${item.id}`}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={item.ticket_id}
                            onChange={(e) => updateItem(item.id, 'ticket_id', e.target.value)}
                          >
                            <option value="">-- Aucun --</option>
                            {tickets.map((ticket) => (
                              <option key={ticket.id} value={ticket.id}>
                                #{ticket.id} - {ticket.title}
                              </option>
                            ))}
                          </select>
                          {errors[`items.${index}.ticket_id` as keyof typeof errors] && (
                            <div className="text-red-500 text-sm mt-1">
                              {errors[`items.${index}.ticket_id` as keyof typeof errors]}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`invoice-${item.id}`}>Numéro de facture</Label>
                          <Input
                            id={`invoice-${item.id}`}
                            value={item.invoice_id}
                            onChange={(e) => updateItem(item.id, 'invoice_id', e.target.value)}
                            placeholder="Ex: FACT-2025-001"
                          />
                          {errors[`items.${index}.invoice_id` as keyof typeof errors] && (
                            <div className="text-red-500 text-sm mt-1">
                              {errors[`items.${index}.invoice_id` as keyof typeof errors]}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {errors.items && typeof errors.items === 'string' && (
                <div className="text-red-500 text-sm mt-1">{errors.items}</div>
              )}
            </CardContent>
          </Card>

          <div className="flex space-x-2 pt-4">
            <Button type="submit" disabled={processing || items.length === 0} variant="default">
              Créer {items.length} commande{items.length > 1 ? 's' : ''}
            </Button>
            <Button asChild variant="secondary">
              <Link href="/commandes">Annuler</Link>
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
