import { useForm, Head } from '@inertiajs/react'
import Heading from '@/components/heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import AppLayout from '@/layouts/app-layout'
import { type BreadcrumbItem } from '@/types'
import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
// use native textarea element instead of non-existing ui/textarea component
// using native select element instead of ui/select

type Category = {
  id: number
  name: string
}

type User = {
  id: number
  name: string
  email: string
}

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets', href: '/tickets' },
  { title: "Créer un ticket", href: '/tickets/create' },
]

export default function CreateTicket({
  categories,
  isAgent = false,
  users = [],
  defaultTicketKind = 'standard',
  specialOnly = false,
}: {
  categories: Category[];
  isAgent?: boolean;
  users?: User[];
  defaultTicketKind?: 'standard' | 'bug' | 'improvement';
  specialOnly?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [newUserData, setNewUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
  })

  const { data, setData, post, processing, errors, transform } = useForm({
    title: '',
    message: '',
    category_id: '',
    ticket_kind: defaultTicketKind,
    special_only: specialOnly ? '1' : '0',
    user_selection: 'existing',
    user_id: '',
    user_email: '',
    user_first_name: '',
    user_last_name: '',
    user_phone: '',
    user_address: '',
    user_postal_code: '',
    user_city: '',
    print_label: '0',
  })

  const isSpecialTicket = data.ticket_kind === 'bug' || data.ticket_kind === 'improvement'
  const pageTitle = specialOnly ? 'Bug et amélioration' : 'Créer un ticket'
  const pageDescription = specialOnly
    ? 'Signalez un bug ou proposez une amélioration produit.'
    : 'Remplissez le formulaire pour créer un nouveau ticket'

  // Filtrer les utilisateurs en fonction de la recherche
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    const query = searchQuery.toLowerCase()
    return users.filter(user =>
      user.name.toLowerCase().includes(query) ||
      (user.email && user.email.toLowerCase().includes(query))
    )
  }, [searchQuery, users])

  const submit = (e: React.SyntheticEvent, printLabel = false) => {
    e.preventDefault()
    const useExistingUser = Boolean(selectedUser && data.user_selection !== 'new')
    transform((current) => ({
      ...current,
      user_selection: useExistingUser ? 'existing' : current.user_selection,
      user_id: useExistingUser ? selectedUser?.id.toString() ?? '' : current.user_id,
      print_label: printLabel ? '1' : '0',
    }))
    post('/tickets', {
      onFinish: () => transform((current) => current),
    })
  }

  const handleCreateUser = () => {
    // Vérifier si ni email ni téléphone ne sont fournis
    if (!newUserData.email.trim() && !newUserData.phone.trim()) {
      setShowConfirmDialog(true)
      return
    }

    proceedWithUserCreation()
  }

  const proceedWithUserCreation = () => {
    setData({
      ...data,
      user_selection: 'new',
      user_email: newUserData.email,
      user_first_name: newUserData.first_name,
      user_last_name: newUserData.last_name,
      user_phone: newUserData.phone,
      user_address: newUserData.address,
      user_postal_code: newUserData.postal_code,
      user_city: newUserData.city,
    })
    setShowCreateDialog(false)
    setShowConfirmDialog(false)
    setSelectedUser({
      id: 0,
      name: `${newUserData.first_name} ${newUserData.last_name}`,
      email: newUserData.email || 'Pas d\'email',
    })
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={pageTitle} />
      <div className="space-y-6">
        <Heading title={pageTitle} description={pageDescription} />

        <Card>
          <CardHeader>
            <CardTitle>{specialOnly ? 'Nouveau ticket spécial' : 'Nouveau ticket'}</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={(e) => submit(e, false)} className="space-y-4">
              {/* Section pour sélectionner/créer un utilisateur (agents uniquement) */}
              {isAgent && !specialOnly && (
                <div className="border-b pb-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">Demandeur du ticket</h3>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="search_user">Rechercher ou créer un utilisateur</Label>
                      <div className="flex gap-2 mt-2">
                        <div className="flex-1">
                          <Input
                            id="search_user"
                            placeholder="Tapez un nom ou email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        {searchQuery && !selectedUser && filteredUsers.length === 0 && (
                          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                            <DialogTrigger asChild>
                              <Button type="button" variant="outline">
                                Créer
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                                <DialogDescription>
                                  Cet utilisateur n'existe pas. Remplissez le formulaire pour le créer.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="new_first_name">Prénom</Label>
                                    <Input
                                      id="new_first_name"
                                      value={newUserData.first_name}
                                      onChange={(e) => setNewUserData({ ...newUserData, first_name: e.target.value })}
                                      placeholder="Prénom"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="new_last_name">Nom</Label>
                                    <Input
                                      id="new_last_name"
                                      value={newUserData.last_name}
                                      onChange={(e) => setNewUserData({ ...newUserData, last_name: e.target.value })}
                                      placeholder="Nom"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label htmlFor="new_email">Email</Label>
                                  <Input
                                    id="new_email"
                                    type="email"
                                    value={newUserData.email}
                                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                    placeholder="Email"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="new_phone">Téléphone</Label>
                                  <Input
                                    id="new_phone"
                                    value={newUserData.phone}
                                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                                    placeholder="Téléphone"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="new_address">Adresse</Label>
                                  <Input
                                    id="new_address"
                                    value={newUserData.address}
                                    onChange={(e) => setNewUserData({ ...newUserData, address: e.target.value })}
                                    placeholder="Adresse"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="new_postal_code">Code Postal</Label>
                                    <Input
                                      id="new_postal_code"
                                      value={newUserData.postal_code}
                                      onChange={(e) => setNewUserData({ ...newUserData, postal_code: e.target.value })}
                                      placeholder="Code Postal"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="new_city">Ville</Label>
                                    <Input
                                      id="new_city"
                                      value={newUserData.city}
                                      onChange={(e) => setNewUserData({ ...newUserData, city: e.target.value })}
                                      placeholder="Ville"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-4">
                                  <Button
                                    type="button"
                                    onClick={handleCreateUser}
                                    disabled={!newUserData.first_name}
                                  >
                                    Créer l'utilisateur
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowCreateDialog(false)}
                                  >
                                    Annuler
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>

                      {/* Dialog de confirmation si pas d'email ni téléphone */}
                      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Aucun moyen de communication</DialogTitle>
                            <DialogDescription>
                              Vous n'avez fourni ni email ni numéro de téléphone pour cet utilisateur.
                              Êtes-vous sûr de vouloir continuer ?
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex gap-2 pt-4">
                            <Button
                              type="button"
                              onClick={proceedWithUserCreation}
                            >
                              Oui, continuer
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setShowConfirmDialog(false)}
                            >
                              Annuler
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Utilisateur sélectionné */}
                    {selectedUser && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="font-medium">{selectedUser.name}</p>
                        <p className="text-sm text-gray-600">{selectedUser.email || 'Pas d\'email'}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(null)
                            setSearchQuery('')
                            setNewUserData({
                              first_name: '',
                              last_name: '',
                              email: '',
                              phone: '',
                              address: '',
                              postal_code: '',
                              city: '',
                            })
                          }}
                          className="mt-2"
                        >
                          Changer d'utilisateur
                        </Button>
                      </div>
                    )}

                    {/* Liste des résultats */}
                    {searchQuery && !selectedUser && filteredUsers.length > 0 && (
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user)
                              setSearchQuery('')
                            }}
                            className="w-full border-b p-3 text-left hover:bg-muted/50 last:border-b-0"
                          >
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email || 'Pas d\'email'}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message utilisateur introuvable */}
                    {searchQuery && !selectedUser && filteredUsers.length === 0 && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                        <p className="text-sm text-amber-900 dark:text-amber-200">Aucun utilisateur trouvé. Cliquez sur "Créer" pour créer un nouvel utilisateur.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="title">Sujet</Label>
                <Input
                  id="title"
                  value={data.title}
                  onChange={(e) => setData('title', e.target.value)}
                  required
                />
                {errors.title && <div className="text-red-500">{errors.title}</div>}
              </div>

              {specialOnly ? (
                <div>
                  <Label htmlFor="ticket_kind">Type de ticket spécial</Label>
                  <select
                    id="ticket_kind"
                    name="ticket_kind"
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={data.ticket_kind}
                    onChange={(e) => setData('ticket_kind', e.target.value as 'bug' | 'improvement')}
                  >
                    <option value="bug">Signaler un bug</option>
                    <option value="improvement">Proposer une amélioration</option>
                  </select>
                  {errors.ticket_kind && <div className="text-red-500">{errors.ticket_kind}</div>}
                </div>
              ) : (
                <input type="hidden" name="ticket_kind" value="standard" />
              )}

              <div>
                <Label htmlFor="message">Description</Label>
                <textarea
                  id="message"
                  rows={6}
                  className="form-control mt-1 w-full rounded-md border px-3 py-2"
                  value={data.message}
                  onChange={(e) => setData('message', e.target.value)}
                  required
                />
                {errors.message && <div className="text-red-500">{errors.message}</div>}
              </div>

              <div>
                <Label htmlFor="category_id">Catégorie</Label>
                <select
                  id="category_id"
                  name="category_id"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={data.category_id}
                  onChange={(e) => setData('category_id', e.target.value)}
                >
                  <option value="">-- Sélectionner --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" disabled={processing || (isAgent && !specialOnly && !selectedUser)} variant="default">
                  {isSpecialTicket ? 'Créer le ticket spécial' : 'Créer'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={processing || (isAgent && !specialOnly && !selectedUser)}
                  onClick={(e) => submit(e, true)}
                >
                  Créer et imprimer
                </Button>
                <Button asChild variant="secondary">
                  <a href={specialOnly ? '/tickets/bugs-improvements' : '/tickets'}>Annuler</a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
