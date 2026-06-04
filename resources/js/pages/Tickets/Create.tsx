import { useForm, Head } from '@inertiajs/react'
import Heading from '@/components/heading'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  devices?: Device[]
}

type Device = {
  id: number
  display_name: string
}

import MobileNativeNav from '@/components/mobile-native-nav';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets', href: '/tickets' },
  { title: "Créer un ticket", href: '/tickets/create' },
]

export default function CreateTicket({
  categories,
  isAgent = false,
  users = [],
  currentUserDevices = [],
  defaultTicketKind = 'standard',
  defaultTitle = '',
  defaultMessage = '',
  specialOnly = false,
}: {
  categories: Category[];
  isAgent?: boolean;
  users?: User[];
  currentUserDevices?: Device[];
  defaultTicketKind?: 'standard' | 'bug' | 'improvement';
  defaultTitle?: string;
  defaultMessage?: string;
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
    title: defaultTitle,
    message: defaultMessage,
    device_password: '',
    no_device_password: false,
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
    device_id: '',
    quick_add_device: false,
    quick_device_type: 'computer',
    quick_device_brand: '',
    quick_device_model: '',
    quick_device_serial_number: '',
    quick_device_asset_tag: '',
    quick_device_purchase_date: '',
    quick_device_warranty_end_date: '',
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
      <div className="mx-auto max-w-5xl space-y-6">
        <Heading title={pageTitle} description={pageDescription} />

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle>{specialOnly ? 'Nouveau ticket spécial' : 'Nouveau ticket'}</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={(e) => submit(e, false)} className="space-y-6 pt-6">
              <div className="rounded-lg border border-border/70 bg-background p-4">
                <p className="text-sm font-medium text-foreground">Formulaire de création</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Renseignez le maximum d&apos;informations utiles pour accélérer la prise en charge.
                </p>
              </div>

              {/* Section pour sélectionner/créer un utilisateur (agents uniquement) */}
              {isAgent && !specialOnly && (
                <div className="space-y-4 rounded-lg border border-border/70 bg-muted/10 p-4">
                  <h3 className="text-lg font-semibold">1. Demandeur du ticket</h3>

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
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-foreground">
                        <p className="font-medium">{selectedUser.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedUser.email || 'Pas d\'email'}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(null)
                            setSearchQuery('')
                            setData('device_id', '')
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
                      <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background text-foreground">
                        {filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user)
                              setSearchQuery('')
                              setData('device_id', '')
                            }}
                            className="w-full border-b border-border p-3 text-left hover:bg-muted/50 last:border-b-0"
                          >
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email || 'Pas d\'email'}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message utilisateur introuvable */}
                    {searchQuery && !selectedUser && filteredUsers.length === 0 && (
                      <Alert>
                        <AlertDescription>
                          Aucun utilisateur trouvé. Cliquez sur "Créer" pour créer un nouvel utilisateur.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-lg border border-border/70 p-4">
                <h3 className="text-lg font-semibold">{isAgent && !specialOnly ? '2. Détails du ticket' : '1. Détails du ticket'}</h3>
                <Label htmlFor="title">Sujet</Label>
                <Input
                  id="title"
                  value={data.title}
                  onChange={(e) => setData('title', e.target.value)}
                  required
                  placeholder="Ex: L&apos;ordinateur redémarre en boucle"
                />
                <p className="text-xs text-muted-foreground">Titre court et explicite.</p>
                {errors.title && <div className="text-sm text-destructive">{errors.title}</div>}

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
                    {errors.ticket_kind && <div className="text-sm text-destructive">{errors.ticket_kind}</div>}
                  </div>
                ) : (
                  <input type="hidden" name="ticket_kind" value="standard" />
                )}

                <div>
                  <Label htmlFor="message">Description</Label>
                  <textarea
                    id="message"
                    rows={6}
                    className="form-control mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={data.message}
                    onChange={(e) => setData('message', e.target.value)}
                    required
                    placeholder="Contexte, symptômes, manipulations déjà tentées..."
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Plus votre description est précise, plus le diagnostic est rapide.</p>
                  {errors.message && <div className="text-sm text-destructive">{errors.message}</div>}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-4">
                <Label htmlFor="device_password">MDP appareil</Label>
                <Input
                  id="device_password"
                  type="text"
                  value={data.device_password}
                  onChange={(e) => {
                    const value = e.target.value
                    setData('device_password', value)
                    if (value.trim() !== '' && data.no_device_password) {
                      setData('no_device_password', false)
                    }
                  }}
                  disabled={data.no_device_password}
                  placeholder="Mot de passe Windows, session, BIOS..."
                />

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={data.no_device_password}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setData('no_device_password', checked)
                      if (checked) {
                        setData('device_password', '')
                      }
                    }}
                  />
                  Je n&apos;ai pas de mots de passe
                </label>

                <p className="text-xs text-muted-foreground">Ce champ peut rester au niveau du ticket même sans appareil lié.</p>

                {errors.device_password && <div className="text-sm text-destructive">{errors.device_password}</div>}
                {errors.no_device_password && <div className="text-sm text-destructive">{errors.no_device_password}</div>}
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 p-4">
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
                <p className="text-xs text-muted-foreground">Optionnel, utile pour le tri et la priorisation.</p>
              </div>

              {!specialOnly && (
                <div className="space-y-4 rounded-lg border border-border/70 bg-muted/10 p-4">
                  <h3 className="text-lg font-semibold">{isAgent ? '3. Appareil concerné' : '2. Appareil concerné'}</h3>
                  <div>
                    <Label htmlFor="device_id">Appareil lié (optionnel)</Label>
                    <select
                      id="device_id"
                      name="device_id"
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={data.device_id}
                      onChange={(e) => setData('device_id', e.target.value)}
                    >
                      <option value="">-- Aucun appareil --</option>
                      {(isAgent ? (selectedUser?.devices ?? []) : currentUserDevices).map((device) => (
                        <option key={device.id} value={device.id}>{device.display_name}</option>
                      ))}
                    </select>
                    {errors.device_id && <div className="text-sm text-destructive">{errors.device_id}</div>}
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={data.quick_add_device}
                      onChange={(e) => setData('quick_add_device', e.target.checked)}
                    />
                    Ajouter rapidement un nouvel appareil pour ce ticket
                  </label>

                  {data.quick_add_device && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label htmlFor="quick_device_type">Type appareil</Label>
                        <select
                          id="quick_device_type"
                          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={data.quick_device_type}
                          onChange={(e) => setData('quick_device_type', e.target.value)}
                        >
                          <option value="computer">Ordinateur</option>
                          <option value="phone">Telephone</option>
                          <option value="tablet">Tablette</option>
                          <option value="other">Autre</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="quick_device_brand">Marque</Label>
                        <Input
                          id="quick_device_brand"
                          value={data.quick_device_brand}
                          onChange={(e) => setData('quick_device_brand', e.target.value)}
                          placeholder="Dell, Apple..."
                        />
                      </div>

                      <div>
                        <Label htmlFor="quick_device_model">Modele *</Label>
                        <Input
                          id="quick_device_model"
                          value={data.quick_device_model}
                          onChange={(e) => setData('quick_device_model', e.target.value)}
                          placeholder="Latitude, iPhone..."
                        />
                        {errors.quick_device_model && <div className="text-sm text-destructive">{errors.quick_device_model}</div>}
                      </div>

                      <div>
                        <Label htmlFor="quick_device_serial_number">Numero de serie</Label>
                        <Input
                          id="quick_device_serial_number"
                          value={data.quick_device_serial_number}
                          onChange={(e) => setData('quick_device_serial_number', e.target.value)}
                        />
                        {errors.quick_device_serial_number && <div className="text-sm text-destructive">{errors.quick_device_serial_number}</div>}
                      </div>

                      <div>
                        <Label htmlFor="quick_device_asset_tag">Numero de suivi</Label>
                        <Input
                          id="quick_device_asset_tag"
                          value={data.quick_device_asset_tag}
                          onChange={(e) => setData('quick_device_asset_tag', e.target.value)}
                        />
                        {errors.quick_device_asset_tag && <div className="text-sm text-destructive">{errors.quick_device_asset_tag}</div>}
                      </div>

                      <div>
                        <Label htmlFor="quick_device_purchase_date">Date d'achat</Label>
                        <Input
                          id="quick_device_purchase_date"
                          type="date"
                          value={data.quick_device_purchase_date}
                          onChange={(e) => setData('quick_device_purchase_date', e.target.value)}
                        />
                      </div>

                      <div>
                        <Label htmlFor="quick_device_warranty_end_date">Fin de garantie</Label>
                        <Input
                          id="quick_device_warranty_end_date"
                          type="date"
                          value={data.quick_device_warranty_end_date}
                          onChange={(e) => setData('quick_device_warranty_end_date', e.target.value)}
                        />
                        {errors.quick_device_warranty_end_date && <div className="text-sm text-destructive">{errors.quick_device_warranty_end_date}</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="sticky bottom-4 z-10 flex flex-wrap gap-2 rounded-lg border border-border/70 bg-background/95 p-3 backdrop-blur">
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
      <MobileNativeNav showFab={false} />
    </AppLayout>
  )
}

