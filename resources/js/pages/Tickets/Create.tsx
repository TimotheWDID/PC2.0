import { useForm, Head } from '@inertiajs/react'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AppLayout from '@/layouts/app-layout'
import { type BreadcrumbItem } from '@/types'
import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
type Category = {
  id: number
  name: string
}

type User = {
  id: number
  name: string
  email: string
  phone?: string
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

const sectionClassName = 'rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-sm md:p-6'
const sectionHeaderClassName = 'mb-4 flex items-start gap-3'
const stepPillClassName = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/40 text-sm font-semibold text-foreground'

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
  const [showPasswordConfirmDialog, setShowPasswordConfirmDialog] = useState(false)
  const [pendingPrintAfterPasswordConfirm, setPendingPrintAfterPasswordConfirm] = useState(false)
  const [showQuickDeviceDialog, setShowQuickDeviceDialog] = useState(false)
  const [showQuickCommandeDialog, setShowQuickCommandeDialog] = useState(false)
  const isSubmittingRef = useRef(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState<string | null>(null)
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
    password_empty_confirmed: false,
    category_id: '',
    ticket_kind: defaultTicketKind,
    special_only: specialOnly ? '1' : '0',
    assign_to_me: false,
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
    quick_add_commande: false,
    quick_commande_nom: '',
    quick_commande_fournisseur: '',
    quick_commande_command_number: '',
    quick_commande_invoice_id: '',
    quick_commande_statut: 'new',
    notify_by: '',
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

  const availableNotificationChannels = useMemo(() => {
    if (!isAgent) {
      return [] as Array<'Email' | 'SMS'>
    }

    const sourceUser = data.user_selection === 'new'
      ? {
          email: data.user_email,
          phone: data.user_phone,
        }
      : selectedUser

    const channels: Array<'Email' | 'SMS'> = []

    if (sourceUser?.email?.trim()) {
      channels.push('Email')
    }

    if (sourceUser?.phone?.trim()) {
      channels.push('SMS')
    }

    return channels
  }, [data.user_email, data.user_phone, data.user_selection, isAgent, selectedUser])

  const notificationModeLabel = availableNotificationChannels.length === 1
    ? availableNotificationChannels[0]
    : availableNotificationChannels.length === 0
      ? 'Aucun canal disponible'
      : 'Choix manuel requis'

  useEffect(() => {
    if (!isAgent) {
      return
    }

    if (availableNotificationChannels.length === 1) {
      setData('notify_by', availableNotificationChannels[0])
      return
    }

    if (availableNotificationChannels.length === 0) {
      setData('notify_by', '')
      return
    }

    if (!availableNotificationChannels.includes(data.notify_by as 'Email' | 'SMS')) {
      setData('notify_by', 'Email')
    }
  }, [availableNotificationChannels, data.notify_by, isAgent, setData])

  useEffect(() => {
    const handleInertiaInvalid = (event: Event) => {
      if (!isSubmittingRef.current) {
        return
      }

      const detail = (event as CustomEvent<{ response?: { status?: number } }>).detail
      // 419 = TokenMismatchException (session/CSRF expired). Some hosting layers may surface this as 403.
      if (detail?.response?.status === 419 || detail?.response?.status === 403) {
        window.location.reload()
      }
    }

    document.addEventListener('inertia:invalid', handleInertiaInvalid)

    return () => {
      document.removeEventListener('inertia:invalid', handleInertiaInvalid)
    }
  }, [])

  // Restaurer le brouillon du localStorage au montage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const draftKey = `ticket_form_draft_${isAgent ? 'agent' : 'user'}`
      const saved = localStorage.getItem(draftKey)
      if (saved) {
        const draft = JSON.parse(saved)
        setData(draft)
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Sauvegarder le brouillon dans localStorage à chaque changement
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const draftKey = `ticket_form_draft_${isAgent ? 'agent' : 'user'}`
      localStorage.setItem(draftKey, JSON.stringify(data))
    } catch {
      // Ignore localStorage errors
    }
  }, [data, isAgent])

  useEffect(() => {
    if (!isAgent || typeof window === 'undefined') {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const userIdFromUrl = params.get('user_id')
    if (!userIdFromUrl) {
      return
    }

    const parsedUserId = Number(userIdFromUrl)
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return
    }

    const matchedUser = users.find((candidate) => candidate.id === parsedUserId)
    if (!matchedUser) {
      return
    }

    setSelectedUser(matchedUser)
    setSearchQuery('')
    setData('user_selection', 'existing')
    setData('user_id', matchedUser.id.toString())
    setData('device_id', '')
  }, [isAgent, setData, users])

  const submit = (e: React.SyntheticEvent, printLabel = false) => {
    e.preventDefault()

    if (!data.device_password.trim()) {
      setPendingPrintAfterPasswordConfirm(printLabel)
      setShowPasswordConfirmDialog(true)
      return
    }

    const useExistingUser = Boolean(selectedUser && data.user_selection !== 'new')
    transform((current) => ({
      ...current,
      user_selection: useExistingUser ? 'existing' : current.user_selection,
      user_id: useExistingUser ? selectedUser?.id.toString() ?? '' : current.user_id,
      no_device_password: false,
      password_empty_confirmed: false,
      print_label: printLabel ? '1' : '0',
    }))
    isSubmittingRef.current = true
    post('/tickets', {
      onSuccess: () => {
        try {
          const draftKey = `ticket_form_draft_${isAgent ? 'agent' : 'user'}`
          localStorage.removeItem(draftKey)
        } catch {
          // Ignore localStorage errors
        }
      },
      onFinish: () => {
        isSubmittingRef.current = false
        transform((current) => current)
      },
    })
  }

  const confirmNoPasswordAndSubmit = () => {
    setShowPasswordConfirmDialog(false)

    const useExistingUser = Boolean(selectedUser && data.user_selection !== 'new')
    transform((current) => ({
      ...current,
      user_selection: useExistingUser ? 'existing' : current.user_selection,
      user_id: useExistingUser ? selectedUser?.id.toString() ?? '' : current.user_id,
      no_device_password: true,
      password_empty_confirmed: true,
      print_label: pendingPrintAfterPasswordConfirm ? '1' : '0',
    }))

    isSubmittingRef.current = true
    post('/tickets', {
      onFinish: () => {
        isSubmittingRef.current = false
        transform((current) => current)
      },
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

  // Le client est créé immédiatement (indépendamment du ticket) pour qu'il reste
  // enregistré même si la soumission du ticket échoue ensuite (ex: session expirée).
  const proceedWithUserCreation = async () => {
    setCreateUserError(null)
    setCreatingUser(true)

    try {
      const response = await axios.post('/tickets/quick-user', {
        first_name: newUserData.first_name,
        last_name: newUserData.last_name,
        email: newUserData.email,
        phone: newUserData.phone,
        address: newUserData.address,
        postal_code: newUserData.postal_code,
        city: newUserData.city,
      })

      const createdUser = response.data.user as User

      setData({
        ...data,
        user_selection: 'existing',
        user_id: createdUser.id.toString(),
        user_email: '',
        user_first_name: '',
        user_last_name: '',
        user_phone: '',
        user_address: '',
        user_postal_code: '',
        user_city: '',
      })
      setShowCreateDialog(false)
      setShowConfirmDialog(false)
      setSelectedUser(createdUser)
    } catch {
      setCreateUserError("Impossible de créer le client pour le moment. Réessayez.")
    } finally {
      setCreatingUser(false)
    }
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={pageTitle} />
      <div className="mx-auto max-w-7xl space-y-6 pb-24">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-gradient-to-br from-background via-background to-muted/50 p-6 shadow-sm md:p-8">
          <div className="pointer-events-none absolute -right-12 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-16 h-32 w-32 rounded-full bg-secondary/20 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1.6fr_0.9fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {specialOnly ? 'Signalement produit' : 'Ouverture de prise en charge'}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{pageTitle}</h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">{pageDescription}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-foreground">Formulaire structure</span>
                <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-foreground">Infos techniques centralisees</span>
                <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-xs text-foreground">Creation plus rapide</span>
              </div>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/80 p-5 backdrop-blur">
              <p className="text-sm font-semibold text-foreground">Avant de valider</p>
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">Un sujet court, une description precise et un contexte clair evitent les allers-retours.</div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">Le mot de passe reste au niveau du ticket et sera aussi reporte sur l'appareil si vous le liez.</div>
              </div>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden rounded-[1.75rem] border-border/70 shadow-sm">
            <CardHeader className="border-b bg-muted/20 px-6 py-5">
              <CardTitle className="text-xl">{specialOnly ? 'Nouveau ticket spécial' : 'Nouveau ticket'}</CardTitle>
            </CardHeader>

            <CardContent className="px-6 py-6">
            <form onSubmit={(e) => submit(e, false)} className="space-y-6">
              <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-muted/20 via-background to-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Formulaire de création</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Renseignez le maximum d&apos;informations utiles pour accélérer la prise en charge.
                </p>
              </div>

              {/* Section pour sélectionner/créer un utilisateur (agents uniquement) */}
              {isAgent && !specialOnly && (
                <div className={sectionClassName}>
                  <div className={sectionHeaderClassName}>
                    <span className={stepPillClassName}>1</span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Demandeur du ticket</h3>
                      <p className="text-sm text-muted-foreground">Selectionnez un client existant ou creez rapidement sa fiche pour rattacher le ticket au bon profil.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="search_user">Rechercher ou créer un utilisateur</Label>
                      <div className="mt-2 flex gap-2">
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
                                {createUserError && (
                                  <Alert variant="destructive">
                                    <AlertDescription>{createUserError}</AlertDescription>
                                  </Alert>
                                )}
                                <div className="flex gap-2 pt-4">
                                  <Button
                                    type="button"
                                    onClick={handleCreateUser}
                                    disabled={!newUserData.first_name || creatingUser}
                                  >
                                    {creatingUser ? 'Création...' : "Créer l'utilisateur"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowCreateDialog(false)}
                                    disabled={creatingUser}
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
                              disabled={creatingUser}
                            >
                              {creatingUser ? 'Création...' : 'Oui, continuer'}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setShowConfirmDialog(false)}
                              disabled={creatingUser}
                            >
                              Annuler
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Utilisateur sélectionné */}
                    {selectedUser && (
                      <div className="rounded-lg border border-border bg-muted/40 p-3 text-foreground">
                        <p className="font-medium">{selectedUser.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedUser.email || 'Pas d\'email'}</p>
                        {selectedUser.phone && (
                          <p className="text-sm text-muted-foreground">{selectedUser.phone}</p>
                        )}
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
                            setData('notify_by', '')
                          }}
                          className="mt-2"
                        >
                          Changer d'utilisateur
                        </Button>
                      </div>
                    )}

                    {/* Liste des résultats */}
                    {searchQuery && !selectedUser && filteredUsers.length > 0 && (
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background text-foreground">
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
                            {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
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

              <div className={sectionClassName}>
                <div className={sectionHeaderClassName}>
                  <span className={stepPillClassName}>{isAgent && !specialOnly ? '2' : '1'}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Détails du ticket</h3>
                    <p className="text-sm text-muted-foreground">Centralisez le contexte, l'intention et les éléments techniques utiles dès l'ouverture.</p>
                  </div>
                </div>

                {isAgent && (
                  <label className="mb-2 flex items-center gap-2 rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(data.assign_to_me)}
                      onChange={(e) => setData('assign_to_me', e.target.checked)}
                    />
                    Je prends ce ticket en charge des sa creation
                  </label>
                )}

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
                    <Select value={data.ticket_kind} onValueChange={(value) => setData('ticket_kind', value as 'bug' | 'improvement')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bug">Signaler un bug</SelectItem>
                        <SelectItem value="improvement">Proposer une amélioration</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.ticket_kind && <div className="text-sm text-destructive">{errors.ticket_kind}</div>}
                  </div>
                ) : (
                  <input type="hidden" name="ticket_kind" value="standard" />
                )}

                <div>
                  <Label htmlFor="message">Description</Label>
                  <Textarea
                    id="message"
                    rows={6}
                    className="mt-1 min-h-32 bg-transparent"
                    value={data.message}
                    onChange={(e) => setData('message', e.target.value)}
                    required
                    placeholder="Contexte, symptômes, manipulations déjà tentées..."
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Plus votre description est précise, plus le diagnostic est rapide.</p>
                  {errors.message && <div className="text-sm text-destructive">{errors.message}</div>}
                </div>
              </div>

              <div className={sectionClassName}>
                <div className={sectionHeaderClassName}>
                  <span className={stepPillClassName}>{isAgent && !specialOnly ? '2' : '1'}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Acces et verification</h3>
                    <p className="text-sm text-muted-foreground">Ce mot de passe reste attache au ticket. Si un appareil est lie, il sera egalement synchronise dessus.</p>
                  </div>
                </div>
                <Label htmlFor="device_password">MDP appareil</Label>
                <Input
                  id="device_password"
                  type="text"
                  value={data.device_password}
                  onChange={(e) => {
                    const value = e.target.value
                    setData('device_password', value)
                    if (value.trim() !== '') {
                      setData('no_device_password', false)
                      setData('password_empty_confirmed', false)
                    }
                  }}
                  placeholder="Mot de passe Windows, session, BIOS..."
                />

                <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                  Si vous laissez ce champ vide, une confirmation explicite sera demandee au moment de la validation.
                </div>

                {errors.device_password && <div className="text-sm text-destructive">{errors.device_password}</div>}
                {errors.no_device_password && <div className="text-sm text-destructive">{errors.no_device_password}</div>}
              </div>

              <div className={sectionClassName}>
                <Label htmlFor="category_id">Catégorie</Label>
                <Select value={data.category_id || '0'} onValueChange={(value) => setData('category_id', value === '0' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Sélectionner --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">-- Sélectionner --</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Optionnel, utile pour le tri et la priorisation.</p>
              </div>

              {isAgent && !specialOnly && (
                <div className={sectionClassName}>
                  <div className={sectionHeaderClassName}>
                    <span className={stepPillClassName}>{isAgent && !specialOnly ? '4' : '2'}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Notification du client</h3>
                      <p className="text-sm text-muted-foreground">
                        {availableNotificationChannels.length <= 1
                          ? `Canal automatique: ${notificationModeLabel.toLowerCase()}`
                          : 'Choisissez le canal à utiliser quand le client dispose des deux moyens de contact.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notify_by">Méthode de notification</Label>
                    <Select
                      value={data.notify_by || (availableNotificationChannels[0] ?? 'Email')}
                      onValueChange={(value) => setData('notify_by', value)}
                      disabled={availableNotificationChannels.length <= 1}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un canal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="SMS">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.notify_by && <div className="text-sm text-destructive">{errors.notify_by}</div>}
                  </div>
                </div>
              )}

              {!specialOnly && (
                <div className={sectionClassName}>
                  <div className={sectionHeaderClassName}>
                    <span className={stepPillClassName}>{isAgent ? '3' : '2'}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Appareil concerné</h3>
                      <p className="text-sm text-muted-foreground">Lie un appareil existant ou preparez une creation rapide pour garder le suivi technique complet.</p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="device_id">Appareil lié (optionnel)</Label>
                    <Select value={data.device_id || '0'} onValueChange={(value) => setData('device_id', value === '0' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="-- Aucun appareil --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">-- Aucun appareil --</SelectItem>
                        {(isAgent ? (selectedUser?.devices ?? []) : currentUserDevices).map((device) => (
                          <SelectItem key={device.id} value={device.id.toString()}>{device.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.device_id && <div className="text-sm text-destructive">{errors.device_id}</div>}
                  </div>

                  {isAgent && (
                    <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                      <p className="text-sm font-medium text-foreground">Actions rapides</p>
                      <p className="mt-1 text-xs text-muted-foreground">Ajoutez des éléments annexes depuis des fenêtres superposées, sans quitter la création du ticket.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setData('quick_add_device', true)
                            setShowQuickDeviceDialog(true)
                          }}
                        >
                          Ajouter un appareil
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setData('quick_add_commande', true)
                            setShowQuickCommandeDialog(true)
                          }}
                        >
                          Ajouter une commande
                        </Button>
                        <Button
                          asChild
                          type="button"
                          variant="secondary"
                        >
                          <a href="/commandes/create" target="_blank" rel="noreferrer">Formulaire commande complet</a>
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {data.quick_add_device && data.quick_device_model.trim() !== '' ? 'Appareil rapide prêt à être créé.' : 'Aucun appareil rapide configuré.'}
                        {' · '}
                        {data.quick_add_commande && data.quick_commande_nom.trim() !== '' ? 'Commande rapide prête à être créée.' : 'Aucune commande rapide configurée.'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Dialog open={showQuickDeviceDialog} onOpenChange={setShowQuickDeviceDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter un appareil rapide</DialogTitle>
                    <DialogDescription>
                      Cet appareil sera créé puis lié automatiquement au ticket après validation.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="quick_device_type">Type appareil</Label>
                      <Select value={data.quick_device_type} onValueChange={(value) => setData('quick_device_type', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="computer">Ordinateur</SelectItem>
                          <SelectItem value="phone">Telephone</SelectItem>
                          <SelectItem value="tablet">Tablette</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
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

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setData('quick_add_device', false)
                        setData('quick_device_type', 'computer')
                        setData('quick_device_brand', '')
                        setData('quick_device_model', '')
                        setData('quick_device_serial_number', '')
                        setData('quick_device_asset_tag', '')
                        setData('quick_device_purchase_date', '')
                        setData('quick_device_warranty_end_date', '')
                        setShowQuickDeviceDialog(false)
                      }}
                    >
                      Retirer
                    </Button>
                    <Button type="button" onClick={() => setShowQuickDeviceDialog(false)}>
                      Valider
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showQuickCommandeDialog} onOpenChange={setShowQuickCommandeDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter une commande rapide</DialogTitle>
                    <DialogDescription>
                      Cette commande sera créée et liée au ticket après enregistrement.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label htmlFor="quick_commande_nom">Nom commande *</Label>
                      <Input
                        id="quick_commande_nom"
                        value={data.quick_commande_nom}
                        onChange={(e) => setData('quick_commande_nom', e.target.value)}
                        placeholder="Ex: SSD 1To SN850"
                      />
                    </div>

                    <div>
                      <Label htmlFor="quick_commande_fournisseur">Fournisseur</Label>
                      <Input
                        id="quick_commande_fournisseur"
                        value={data.quick_commande_fournisseur}
                        onChange={(e) => setData('quick_commande_fournisseur', e.target.value)}
                        placeholder="LDLC, Amazon..."
                      />
                    </div>

                    <div>
                      <Label htmlFor="quick_commande_command_number">Numero commande</Label>
                      <Input
                        id="quick_commande_command_number"
                        value={data.quick_commande_command_number}
                        onChange={(e) => setData('quick_commande_command_number', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="quick_commande_invoice_id">Numero facture</Label>
                      <Input
                        id="quick_commande_invoice_id"
                        value={data.quick_commande_invoice_id}
                        onChange={(e) => setData('quick_commande_invoice_id', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="quick_commande_statut">Statut commande</Label>
                      <Select value={data.quick_commande_statut} onValueChange={(value) => setData('quick_commande_statut', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Nouveau</SelectItem>
                          <SelectItem value="panier">Panier</SelectItem>
                          <SelectItem value="commandé">Commande</SelectItem>
                          <SelectItem value="réceptionner">Reception</SelectItem>
                          <SelectItem value="traité">Traite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setData('quick_add_commande', false)
                        setData('quick_commande_nom', '')
                        setData('quick_commande_fournisseur', '')
                        setData('quick_commande_command_number', '')
                        setData('quick_commande_invoice_id', '')
                        setData('quick_commande_statut', 'new')
                        setShowQuickCommandeDialog(false)
                      }}
                    >
                      Retirer
                    </Button>
                    <Button type="button" onClick={() => setShowQuickCommandeDialog(false)}>
                      Valider
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showPasswordConfirmDialog} onOpenChange={setShowPasswordConfirmDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmer l'absence de mot de passe</DialogTitle>
                    <DialogDescription>
                      Le champ MDP est vide. Confirmez-vous que le client ne fournit aucun mot de passe pour ce ticket ?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setPendingPrintAfterPasswordConfirm(false)
                        setShowPasswordConfirmDialog(false)
                      }}
                    >
                      Retour
                    </Button>
                    <Button type="button" onClick={confirmNoPasswordAndSubmit}>
                      Confirmer et créer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="sticky bottom-2 z-10 flex flex-wrap gap-2 rounded-3xl border border-border/70 bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
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

