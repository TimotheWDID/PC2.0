import { Head, Link, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import MobileNativeNav from '@/components/mobile-native-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateFr, formatDateTimeFr } from '@/lib/datetime';

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

type UserShow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  internal_note: string | null;
  hiboutik_id: string | null;
  default_notification_preference: string | null;
  created_at: string | null;
};

const statusLabels: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  pending: 'En attente',
  resolved: 'Résolu',
  closed: 'Fermé',
};

const priorityLabels: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

const deviceStatusLabels: Record<string, string> = {
  active: 'Actif',
  in_repair: 'En réparation',
  archived: 'Archivé',
  lost: 'Perdu',
};

const notificationLabels: Record<string, string> = {
  SMS: 'SMS',
  Email: 'Email',
  None: 'Aucune',
};

const badgeVariantForTicketStatus = (status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'open') return 'destructive';
  if (status === 'in_progress') return 'default';
  if (status === 'pending') return 'secondary';

  return 'outline';
};

export default function Show({ user, tickets = [], devices = [] }: { user: UserShow; tickets: UserTicket[]; devices: Device[] }) {
  const page = usePage();
  const auth = page.props as any;
  const isAdmin = !!(auth?.auth?.user?.is_admin || auth?.auth?.user?.agent?.is_admin);
  const displayName = user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || `Utilisateur #${user.id}`;

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Utilisateurs', href: '/users' },
    { title: displayName, href: `/users/${user.id}/show` },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={displayName} />
      <div className="space-y-4 py-2 pb-24 sm:py-4 lg:pb-0">
        <Heading title={displayName} description={`Fiche utilisateur #${user.id}`} />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{tickets.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Appareils</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{devices.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Créé le</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{formatDateTimeFr(user.created_at)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">#{user.id}</Badge>
                <Badge variant="outline">{notificationLabels[user.default_notification_preference ?? ''] ?? 'Préférence non définie'}</Badge>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Nom</p>
                <p className="font-medium">{displayName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p>{user.email || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Téléphone</p>
                <p>{user.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Adresse</p>
                <p className="whitespace-pre-wrap">{user.address || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">ID Hiboutik</p>
                <p>{user.hiboutik_id || '-'}</p>
              </div>
              {isAdmin && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Note interne</p>
                  <p className="whitespace-pre-wrap">{user.internal_note || '-'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Actions</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/tickets/create?user_id=${user.id}`}>
                    <Button>Créer un ticket</Button>
                  </Link>
                  {isAdmin && (
                    <Link href={`/users/${user.id}/edit#tickets-client`}>
                      <Button variant="outline">Ajouter un appareil</Button>
                    </Link>
                  )}
                  <Link href={`/tickets?user_id=${user.id}&show_all=1`}>
                    <Button variant="secondary">Voir les tickets</Button>
                  </Link>
                  {isAdmin && (
                    <Link href={`/users/${user.id}/edit`}>
                      <Button>Modifier</Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Appareils liés</CardTitle>
                <Badge variant="outline">{devices.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {devices.length ? (
                  devices.map((device) => (
                    <Link key={device.id} href={`/devices/${device.id}`} className="block rounded-md border p-3 transition-colors hover:bg-muted/30">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{device.display_name}</p>
                          <p className="text-sm text-muted-foreground">{device.brand || '-'} {device.model || ''}</p>
                        </div>
                        <Badge variant="outline">{deviceStatusLabels[device.status] || device.status}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-3">
                        <p>S/N: {device.serial_number || '-'}</p>
                        <p>Tag: {device.asset_tag || '-'}</p>
                        <p>Garantie: {formatDateFr(device.warranty_end_date)}</p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun appareil lié à cet utilisateur.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Derniers tickets</CardTitle>
                <Badge variant="outline">{tickets.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {tickets.length ? (
                  tickets.slice(0, 10).map((ticket) => (
                    <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="block rounded-md border p-3 transition-colors hover:bg-muted/30">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">#{ticket.id} - {ticket.title || 'Sans titre'}</p>
                          <p className="text-sm text-muted-foreground">Créé le {formatDateTimeFr(ticket.created_at)}</p>
                          <p className="text-sm text-muted-foreground">
                            Appareil: {ticket.device?.name || '-'}
                            {ticket.device?.asset_tag ? ` (${ticket.device.asset_tag})` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={badgeVariantForTicketStatus(ticket.status)}>
                            {statusLabels[ticket.status ?? ''] || ticket.status || '-'}
                          </Badge>
                          <Badge variant="outline">{priorityLabels[ticket.priority ?? ''] || ticket.priority || '-'}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun ticket lié à cet utilisateur.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <MobileNativeNav showFab={isAdmin} fabHref={`/users/${user.id}/edit`} fabLabel="Modifier" />
    </AppLayout>
  );
}