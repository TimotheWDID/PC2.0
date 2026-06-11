import React, { useState } from 'react';
import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import LogModal from '@/components/LogModal';
import MobileNativeNav from '@/components/mobile-native-nav';
import { Mail, MessageSquare, Loader2 } from 'lucide-react';
import { formatDateFr, formatDateTimeFr } from '@/lib/datetime';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Utilisateurs', href: '/users' },
  { title: 'Modifier', href: '' },
];

type UserTicket = {
  id: number;
  title: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  device?: {
    id: number;
    name: string;
    serial_number: string | null;
    asset_tag: string | null;
  } | null;
};

type Device = {
  id: number;
  device_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  purchase_date: string | null;
  warranty_end_date: string | null;
  status: string;
  notes: string | null;
  display_name: string;
};

type UserEditForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  internal_note: string;
  hiboutik_id: string;
  default_notification_preference: string;
  password: string;
  password_confirmation: string;
};

type DeviceEditForm = {
  device_type: string;
  brand: string;
  model: string;
  serial_number: string;
  asset_tag: string;
  purchase_date: string;
  warranty_end_date: string;
  status: string;
  notes: string;
};

const translateStatus = (status: string | null): string => {
  const translations: Record<string, string> = {
    open: 'Ouvert',
    in_progress: 'En cours',
    pending: 'En attente',
    resolved: 'Résolu',
    closed: 'Fermé',
  };

  if (!status) return '-';

  return translations[status] || status;
};

const getStatusBadgeVariant = (status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'open') return 'destructive';
  if (status === 'in_progress') return 'default';
  if (status === 'pending') return 'secondary';
  return 'outline';
};

export default function Edit({ user, tickets = [], devices = [] }: { user: any; tickets: UserTicket[]; devices: Device[] }) {
  const { auth } = usePage().props as any;
  const isAdmin = auth?.user?.agent?.is_admin;

  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [deletingDeviceId, setDeletingDeviceId] = useState<number | null>(null);

  const { data, setData, put, processing, errors } = useForm<UserEditForm>({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    internal_note: user?.internal_note ?? '',
    hiboutik_id: user?.hiboutik_id ?? '',
    default_notification_preference: user?.default_notification_preference ?? 'None',
    password: '',
    password_confirmation: '',
  });

  const { data: deviceData, setData: setDeviceData, post: postDevice, patch: patchDevice, processing: processingDevice, errors: deviceErrors, reset: resetDevice } = useForm<DeviceEditForm>({
    device_type: 'computer',
    brand: '',
    model: '',
    serial_number: '',
    asset_tag: '',
    purchase_date: '',
    warranty_end_date: '',
    status: 'active',
    notes: '',
  });

  const submitDevice = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingDeviceId) {
      patchDevice(`/users/${user?.id}/devices/${editingDeviceId}`, {
        onSuccess: () => {
          setEditingDeviceId(null);
          resetDevice();
          setDeviceData('device_type', 'computer');
          setDeviceData('status', 'active');
        },
      });
      return;
    }

    postDevice(`/users/${user?.id}/devices`, {
      onSuccess: () => {
        resetDevice();
        setDeviceData('device_type', 'computer');
        setDeviceData('status', 'active');
      },
    });
  };

  const startEditDevice = (device: Device) => {
    setEditingDeviceId(device.id);
    setDeviceData('device_type', device.device_type || 'computer');
    setDeviceData('brand', device.brand || '');
    setDeviceData('model', device.model || '');
    setDeviceData('serial_number', device.serial_number || '');
    setDeviceData('asset_tag', device.asset_tag || '');
    setDeviceData('purchase_date', device.purchase_date || '');
    setDeviceData('warranty_end_date', device.warranty_end_date || '');
    setDeviceData('status', device.status || 'active');
    setDeviceData('notes', device.notes || '');
  };

  const cancelEditDevice = () => {
    setEditingDeviceId(null);
    resetDevice();
    setDeviceData('device_type', 'computer');
    setDeviceData('status', 'active');
  };

  const deleteDevice = (deviceId: number) => {
    if (!confirm('Supprimer cet appareil ?')) {
      return;
    }

    setDeletingDeviceId(deviceId);
    router.delete(`/users/${user?.id}/devices/${deviceId}`, {
      onFinish: () => setDeletingDeviceId(null),
    });
  };

  const sendPasswordEmail = () => {
    setSendingEmail(true);
    router.post(`/users/${user?.id}/send-password-email`, {}, {
      onFinish: () => setSendingEmail(false),
    });
  };

  const sendPasswordSms = () => {
    setSendingSms(true);
    router.post(`/users/${user?.id}/send-password-sms`, {}, {
      onFinish: () => setSendingSms(false),
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Éditer un utilisateur" />
      <div className="w-full space-y-4 py-4 pb-24 lg:pb-0">
        <Heading title="Modifier utilisateur" description={`Modifier l'utilisateur #${user?.id}`} />

        <Card className="border-border/70 shadow-sm lg:shadow-md/10">
          <CardHeader className="p-3 sm:p-6 lg:border-b lg:bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle>Modifier</CardTitle>
              <LogModal
                subjectType="App\\Models\\User"
                subjectId={user?.id}
                buttonVariant="ghost"
                buttonSize="sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                put(`/users/${user?.id}`);
              }}
            >
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    placeholder="Prénom"
                    name="first_name"
                    value={data.first_name}
                    onChange={(e) => setData('first_name', e.target.value)}
                  />
                  {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    placeholder="Nom"
                    name="last_name"
                    value={data.last_name}
                    onChange={(e) => setData('last_name', e.target.value)}
                  />
                  {errors.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Email"
                    name="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    placeholder="Téléphone"
                    name="phone"
                    value={data.phone}
                    onChange={(e) => setData('phone', e.target.value)}
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Textarea
                    id="address"
                    placeholder="Adresse"
                    name="address"
                    value={data.address}
                    onChange={(e) => setData('address', e.target.value)}
                  />
                  {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                </div>

                {isAdmin && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="hiboutik_id">ID Hiboutik</Label>
                      <Input
                        id="hiboutik_id"
                        placeholder="ID Hiboutik"
                        name="hiboutik_id"
                        value={data.hiboutik_id}
                        onChange={(e) => setData('hiboutik_id', e.target.value)}
                      />
                      {errors.hiboutik_id && <p className="text-sm text-destructive">{errors.hiboutik_id}</p>}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="internal_note">Note interne</Label>
                      <Textarea
                        id="internal_note"
                        placeholder="Note interne (visible uniquement par les agents)"
                        name="internal_note"
                        value={data.internal_note}
                        onChange={(e) => setData('internal_note', e.target.value)}
                        rows={4}
                      />
                      {errors.internal_note && <p className="text-sm text-destructive">{errors.internal_note}</p>}
                    </div>
                  </>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="default_notification_preference">Préférence de notification *</Label>
                  <Select
                    value={data.default_notification_preference}
                    onValueChange={(value) => setData('default_notification_preference', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une préférence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMS">SMS</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="None">Aucune</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.default_notification_preference && <p className="text-sm text-destructive">{errors.default_notification_preference}</p>}
                </div>

                {isAdmin && (
                  <>
                    <div className="mt-4 pt-4 border-t">
                      <h3 className="text-sm font-semibold mb-3">Changer le mot de passe</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Laissez vide pour ne pas modifier le mot de passe
                      </p>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="password">Nouveau mot de passe</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Nouveau mot de passe"
                            name="password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                          />
                          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="password_confirmation">Confirmer le mot de passe</Label>
                          <Input
                            id="password_confirmation"
                            type="password"
                            placeholder="Confirmer le mot de passe"
                            name="password_confirmation"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:gap-2 lg:mt-6 lg:justify-end lg:border-t lg:pt-6">
                  <Button type="submit" disabled={processing} className="w-full sm:w-auto lg:min-w-[10rem]">
                    {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {processing ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.visit('/users')}
                    className="w-full sm:w-auto lg:min-w-[10rem]"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </form>

            {isAdmin && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium mb-3">Configuration du mot de passe</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Envoyer un lien à l'utilisateur pour qu'il puisse définir son propre mot de passe.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendPasswordEmail}
                    disabled={sendingEmail}
                  >
                    {sendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    {sendingEmail ? 'Envoi...' : 'Envoyer par email'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendPasswordSms}
                    disabled={sendingSms}
                  >
                    {sendingSms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                    {sendingSms ? 'Envoi...' : 'Envoyer par SMS'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="tickets-client" className="scroll-mt-24 border-border/70 shadow-sm lg:shadow-md/10">
          <CardHeader className="p-3 sm:p-6 lg:border-b lg:bg-muted/20">
            <CardTitle>Appareils du client</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitDevice} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {editingDeviceId ? `Modification appareil #${editingDeviceId}` : 'Nouvel appareil'}
                </p>
                {editingDeviceId && (
                  <Button type="button" variant="outline" size="sm" onClick={cancelEditDevice}>
                    Annuler modif
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={deviceData.device_type} onValueChange={(value) => setDeviceData('device_type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="computer">Ordinateur</SelectItem>
                      <SelectItem value="phone">Téléphone</SelectItem>
                      <SelectItem value="tablet">Tablette</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Statut</Label>
                  <Select value={deviceData.status} onValueChange={(value) => setDeviceData('status', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="in_repair">En reparation</SelectItem>
                      <SelectItem value="archived">Archive</SelectItem>
                      <SelectItem value="lost">Perdu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Marque</Label>
                  <Input value={deviceData.brand} onChange={(e) => setDeviceData('brand', e.target.value)} placeholder="Dell, Apple..." />
                </div>
                <div className="grid gap-2">
                  <Label>Modele *</Label>
                  <Input value={deviceData.model} onChange={(e) => setDeviceData('model', e.target.value)} placeholder="Latitude, iPhone..." />
                  {deviceErrors.model && <p className="text-sm text-destructive">{deviceErrors.model}</p>}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Numero de serie</Label>
                  <Input value={deviceData.serial_number} onChange={(e) => setDeviceData('serial_number', e.target.value)} />
                  {deviceErrors.serial_number && <p className="text-sm text-destructive">{deviceErrors.serial_number}</p>}
                </div>
                <div className="grid gap-2">
                  <Label>Numero de suivi interne</Label>
                  <Input value={deviceData.asset_tag} onChange={(e) => setDeviceData('asset_tag', e.target.value)} />
                  {deviceErrors.asset_tag && <p className="text-sm text-destructive">{deviceErrors.asset_tag}</p>}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Date d'achat</Label>
                  <Input type="date" value={deviceData.purchase_date} onChange={(e) => setDeviceData('purchase_date', e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Fin de garantie</Label>
                  <Input type="date" value={deviceData.warranty_end_date} onChange={(e) => setDeviceData('warranty_end_date', e.target.value)} />
                  {deviceErrors.warranty_end_date && <p className="text-sm text-destructive">{deviceErrors.warranty_end_date}</p>}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea value={deviceData.notes} onChange={(e) => setDeviceData('notes', e.target.value)} rows={3} />
              </div>

              <Button type="submit" disabled={processingDevice}>
                {processingDevice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {processingDevice ? (editingDeviceId ? 'Mise à jour...' : 'Ajout...') : (editingDeviceId ? 'Mettre à jour l\'appareil' : 'Ajouter l\'appareil')}
              </Button>
            </form>

            <div className="mt-4 space-y-3">
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun appareil enregistré pour ce client.</p>
              ) : devices.map((device) => (
                <div key={device.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">{device.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Type: {device.device_type} | Statut: {device.status}
                        {device.warranty_end_date ? ` | Garantie: ${formatDateFr(device.warranty_end_date, { timeZone: 'Europe/Paris' })}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => startEditDevice(device)}>
                        Modifier
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => deleteDevice(device.id)}>
                        {deletingDeviceId === device.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card id="tickets-client" className="scroll-mt-24 border-border/70 shadow-sm lg:shadow-md/10">
          <CardHeader className="p-3 sm:p-6 lg:border-b lg:bg-muted/20">
            <CardTitle>Tickets du client</CardTitle>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun ticket trouvé pour ce client.</p>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium">Ticket #{ticket.id} - {ticket.title || 'Sans titre'}</p>
                        <p className="text-xs text-muted-foreground">
                          Créé le {formatDateTimeFr(ticket.created_at, { timeZone: 'Europe/Paris' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(ticket.status)}>{translateStatus(ticket.status)}</Badge>
                        {ticket.priority && <Badge variant="outline">Priorité: {ticket.priority}</Badge>}
                        {ticket.device && <Badge variant="outline">Appareil: {ticket.device.name}</Badge>}
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/tickets/${ticket.id}`}>Voir</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}

