import React, { useMemo, useState } from 'react'
import { Head, Link, router, usePage } from '@inertiajs/react'
import AppLayout from '@/layouts/app-layout'
import Heading from '@/components/heading'
import MobileNativeNav from '@/components/mobile-native-nav'
import { type BreadcrumbItem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Eye, EyeOff, Wrench, Ticket, Plus } from 'lucide-react'
import { formatDateTimeFr } from '@/lib/datetime'

type DeviceShowProps = {
  device: {
    id: number
    device_type: string
    brand: string | null
    model: string | null
    display_name: string
    serial_number: string | null
    asset_tag: string | null
    status: string
    purchase_date: string | null
    warranty_start_date: string | null
    warranty_end_date: string | null
    vendor_name: string | null
    imei: string | null
    sim_number: string | null
    phone_number: string | null
    os_name: string | null
    ram_gb: number | null
    storage_gb: number | null
    cpu: string | null
    notes: string | null
    access_password: string | null
    no_access_password: boolean
    user: {
      id: number
      name: string
      email: string | null
      phone: string | null
    } | null
  }
  tickets: Array<{
    id: number
    title: string | null
    status: string | null
    priority: string | null
    assignee: string | null
    created_at: string | null
    updated_at: string | null
  }>
  events: Array<{
    id: number
    event_type: string
    summary: string
    details: { note?: string } | null
    happened_at: string | null
    ticket_id: number | null
    technician: string | null
  }>
  stats: {
    tickets_total: number
    tickets_open: number
    events_total: number
    last_event_at: string | null
    first_ticket_at: string | null
  }
  isAgent: boolean
}

const statusLabels: Record<string, string> = {
  active: 'Actif',
  in_repair: 'En reparation',
  archived: 'Archive',
  lost: 'Perdu',
}

const eventTypeLabels: Record<string, string> = {
  battery_replaced: 'Batterie remplacee',
  screen_replaced: 'Ecran remplace',
  storage_upgraded: 'Stockage ameliore',
  diagnostic: 'Diagnostic',
  maintenance: 'Maintenance',
  note: 'Note',
}

export default function DeviceShow({ device, tickets, events, stats, isAgent }: DeviceShowProps) {
  const { auth } = usePage().props as any
  const isCurrentUserOwner = auth?.user?.id === device.user?.id
  const [showPassword, setShowPassword] = useState(false)
  const [editingDevice, setEditingDevice] = useState(false)
  const [deviceForm, setDeviceForm] = useState({
    device_type: device.device_type || 'computer',
    brand: device.brand || '',
    model: device.model || '',
    serial_number: device.serial_number || '',
    asset_tag: device.asset_tag || '',
    purchase_date: device.purchase_date || '',
    warranty_start_date: device.warranty_start_date || '',
    warranty_end_date: device.warranty_end_date || '',
    vendor_name: device.vendor_name || '',
    status: device.status || 'active',
    imei: device.imei || '',
    sim_number: device.sim_number || '',
    phone_number: device.phone_number || '',
    os_name: device.os_name || '',
    ram_gb: device.ram_gb ? String(device.ram_gb) : '',
    storage_gb: device.storage_gb ? String(device.storage_gb) : '',
    cpu: device.cpu || '',
    notes: device.notes || '',
  })
  const [eventForm, setEventForm] = useState({
    event_type: 'maintenance',
    summary: '',
    details: '',
    happened_at: '',
    ticket_id: '',
  })

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Parc appareils', href: '/devices' },
    { title: device.display_name, href: `/devices/${device.id}` },
  ]

  const sortedTickets = useMemo(() => {
    return [...tickets].sort((a, b) => (a.updated_at && b.updated_at ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() : 0))
  }, [tickets])

  const submitEvent = (e: React.FormEvent) => {
    e.preventDefault()
    router.post(`/devices/${device.id}/events`, {
      ...eventForm,
      ticket_id: eventForm.ticket_id ? Number(eventForm.ticket_id) : null,
    }, {
      preserveScroll: true,
      onSuccess: () => {
        setEventForm({
          event_type: 'maintenance',
          summary: '',
          details: '',
          happened_at: '',
          ticket_id: '',
        })
      },
    })
  }

  const submitDeviceUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    router.patch(`/users/${device.user?.id ?? 0}/devices/${device.id}`, {
      ...deviceForm,
      ram_gb: deviceForm.ram_gb ? Number(deviceForm.ram_gb) : null,
      storage_gb: deviceForm.storage_gb ? Number(deviceForm.storage_gb) : null,
    }, {
      preserveScroll: true,
      onSuccess: () => setEditingDevice(false),
    })
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Appareil #${device.id}`} />
      <div className="space-y-4 py-2 sm:py-4">
        <Heading title={device.display_name} description="Suivi technique centralise de l'appareil" />

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tickets</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{stats.tickets_total}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Tickets actifs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{stats.tickets_open}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Interventions</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{stats.events_total}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Derniere action</CardTitle></CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">{stats.last_event_at ? formatDateTimeFr(stats.last_event_at) : 'Aucune'}</p></CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Fiche appareil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">#{device.id}</Badge>
                <Badge variant="outline">{statusLabels[device.status] || device.status}</Badge>
              </div>
              <p><strong>Type:</strong> {device.device_type}</p>
              <p><strong>Marque/Modele:</strong> {(device.brand || '-') + ' ' + (device.model || '')}</p>
              <p><strong>Serie:</strong> {device.serial_number || '-'}</p>
              <p><strong>Suivi:</strong> {device.asset_tag || '-'}</p>
              <p><strong>IMEI:</strong> {device.imei || '-'}</p>
              <p><strong>OS:</strong> {device.os_name || '-'}</p>
              <p><strong>RAM/Stockage:</strong> {device.ram_gb || '-'} Go / {device.storage_gb || '-'} Go</p>
              <p><strong>CPU:</strong> {device.cpu || '-'}</p>
              <p><strong>Achat:</strong> {device.purchase_date || '-'}</p>
              <p><strong>Garantie fin:</strong> {device.warranty_end_date || '-'}</p>
              <p><strong>Client:</strong> {device.user?.name || '-'}</p>

              <div className="rounded-md border p-2">
                <p className="mb-1 text-xs uppercase text-muted-foreground">Mot de passe appareil</p>
                <div className="flex items-center gap-2">
                  <strong>
                    {device.no_access_password
                      ? 'Aucun mot de passe fourni'
                      : device.access_password
                        ? (showPassword ? device.access_password : '••••••••••')
                        : '-'}
                  </strong>
                  {!device.no_access_password && device.access_password && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild size="sm" variant="outline"><Link href={`/tickets?device_id=${device.id}&show_all=1`}>Tous les tickets</Link></Button>
                {device.user && (
                  <Button asChild size="sm" variant="outline"><Link href={`/users/${device.user.id}/edit#tickets-client`}>Fiche client</Link></Button>
                )}
                {(isAgent || isCurrentUserOwner) && (
                  <Button type="button" size="sm" onClick={() => setEditingDevice((v) => !v)}>
                    {editingDevice ? 'Fermer edition' : 'Modifier appareil'}
                  </Button>
                )}
                {isAgent && (
                  <Button asChild size="sm"><Link href="/tickets/create">Nouveau ticket</Link></Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Tracking interventions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingDevice && (isAgent || isCurrentUserOwner) && (
                <form onSubmit={submitDeviceUpdate} className="space-y-3 rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Type</Label>
                      <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={deviceForm.device_type} onChange={(e) => setDeviceForm({ ...deviceForm, device_type: e.target.value })}>
                        <option value="computer">Ordinateur</option>
                        <option value="phone">Téléphone</option>
                        <option value="tablet">Tablette</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                    <div>
                      <Label>Statut</Label>
                      <select className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={deviceForm.status} onChange={(e) => setDeviceForm({ ...deviceForm, status: e.target.value })}>
                        <option value="active">Actif</option>
                        <option value="in_repair">En reparation</option>
                        <option value="archived">Archive</option>
                        <option value="lost">Perdu</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Marque</Label>
                      <Input value={deviceForm.brand} onChange={(e) => setDeviceForm({ ...deviceForm, brand: e.target.value })} />
                    </div>
                    <div>
                      <Label>Modèle</Label>
                      <Input value={deviceForm.model} onChange={(e) => setDeviceForm({ ...deviceForm, model: e.target.value })} required />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Numéro de série</Label>
                      <Input value={deviceForm.serial_number} onChange={(e) => setDeviceForm({ ...deviceForm, serial_number: e.target.value })} />
                    </div>
                    <div>
                      <Label>Numéro de suivi</Label>
                      <Input value={deviceForm.asset_tag} onChange={(e) => setDeviceForm({ ...deviceForm, asset_tag: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Date d'achat</Label>
                      <Input type="date" value={deviceForm.purchase_date} onChange={(e) => setDeviceForm({ ...deviceForm, purchase_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Début garantie</Label>
                      <Input type="date" value={deviceForm.warranty_start_date} onChange={(e) => setDeviceForm({ ...deviceForm, warranty_start_date: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Fin garantie</Label>
                      <Input type="date" value={deviceForm.warranty_end_date} onChange={(e) => setDeviceForm({ ...deviceForm, warranty_end_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Fournisseur</Label>
                      <Input value={deviceForm.vendor_name} onChange={(e) => setDeviceForm({ ...deviceForm, vendor_name: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>IMEI</Label>
                      <Input value={deviceForm.imei} onChange={(e) => setDeviceForm({ ...deviceForm, imei: e.target.value })} />
                    </div>
                    <div>
                      <Label>Numéro SIM</Label>
                      <Input value={deviceForm.sim_number} onChange={(e) => setDeviceForm({ ...deviceForm, sim_number: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Téléphone</Label>
                      <Input value={deviceForm.phone_number} onChange={(e) => setDeviceForm({ ...deviceForm, phone_number: e.target.value })} />
                    </div>
                    <div>
                      <Label>OS</Label>
                      <Input value={deviceForm.os_name} onChange={(e) => setDeviceForm({ ...deviceForm, os_name: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>RAM (Go)</Label>
                      <Input type="number" min="1" value={deviceForm.ram_gb} onChange={(e) => setDeviceForm({ ...deviceForm, ram_gb: e.target.value })} />
                    </div>
                    <div>
                      <Label>Stockage (Go)</Label>
                      <Input type="number" min="1" value={deviceForm.storage_gb} onChange={(e) => setDeviceForm({ ...deviceForm, storage_gb: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <Label>CPU</Label>
                    <Input value={deviceForm.cpu} onChange={(e) => setDeviceForm({ ...deviceForm, cpu: e.target.value })} />
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea rows={3} value={deviceForm.notes} onChange={(e) => setDeviceForm({ ...deviceForm, notes: e.target.value })} />
                  </div>

                  <Button type="submit">Enregistrer les modifications</Button>
                </form>
              )}
              {isAgent && (
                <form onSubmit={submitEvent} className="space-y-3 rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Type</Label>
                      <select
                        className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={eventForm.event_type}
                        onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                      >
                        <option value="maintenance">Maintenance</option>
                        <option value="diagnostic">Diagnostic</option>
                        <option value="battery_replaced">Batterie</option>
                        <option value="screen_replaced">Ecran</option>
                        <option value="storage_upgraded">Stockage</option>
                        <option value="note">Note</option>
                      </select>
                    </div>
                    <div>
                      <Label>Lie a un ticket (optionnel)</Label>
                      <select
                        className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={eventForm.ticket_id}
                        onChange={(e) => setEventForm({ ...eventForm, ticket_id: e.target.value })}
                      >
                        <option value="">Aucun</option>
                        {sortedTickets.map((ticket) => (
                          <option key={ticket.id} value={ticket.id}>#{ticket.id} - {ticket.title || 'Sans titre'}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Resume</Label>
                      <Input value={eventForm.summary} onChange={(e) => setEventForm({ ...eventForm, summary: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="datetime-local" value={eventForm.happened_at} onChange={(e) => setEventForm({ ...eventForm, happened_at: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <Label>Details</Label>
                    <Textarea rows={3} value={eventForm.details} onChange={(e) => setEventForm({ ...eventForm, details: e.target.value })} />
                  </div>

                  <Button type="submit"><Plus className="mr-2 h-4 w-4" />Ajouter au suivi</Button>
                </form>
              )}

              <div className="space-y-2">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune intervention enregistree.</p>
                ) : events.map((event) => (
                  <div key={event.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-sm">{event.summary}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{eventTypeLabels[event.event_type] || event.event_type}</Badge>
                        <span className="text-xs text-muted-foreground">{event.happened_at ? formatDateTimeFr(event.happened_at) : '-'}</span>
                      </div>
                    </div>
                    {event.details?.note && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{event.details.note}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {event.ticket_id ? `Ticket #${event.ticket_id}` : 'Hors ticket'}{event.technician ? ` - ${event.technician}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ticket className="h-4 w-4" /> Historique tickets de l'appareil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun ticket lie a cet appareil.</p>
              ) : sortedTickets.map((ticket) => (
                <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <div>
                    <p className="font-medium">#{ticket.id} - {ticket.title || 'Sans titre'}</p>
                    <p className="text-xs text-muted-foreground">Maj: {ticket.updated_at ? formatDateTimeFr(ticket.updated_at) : '-'} - Assigne: {ticket.assignee || 'Non assigne'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ticket.status || '-'}</Badge>
                    <Badge variant="outline">{ticket.priority || '-'}</Badge>
                    <Button asChild size="sm" variant="outline"><Link href={`/tickets/${ticket.id}`}>Ouvrir</Link></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  )
}
