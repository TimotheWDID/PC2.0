import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/heading';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MobileNativeNav from '@/components/mobile-native-nav';
import { SortableTh, useSortableData } from '@/components/sortable-table';

type DeviceRow = {
  id: number;
  device_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  status: string;
  purchase_date: string | null;
  warranty_end_date: string | null;
  display_name: string;
  tickets_count: number;
  last_event_at: string | null;
  user: {
    id: number;
    name: string;
    email: string | null;
  } | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Parc appareils', href: '/devices' },
];

const statusLabels: Record<string, string> = {
  active: 'Actif',
  in_repair: 'En reparation',
  archived: 'Archive',
  lost: 'Perdu',
};

const typeLabels: Record<string, string> = {
  computer: 'Ordinateur',
  phone: 'Telephone',
  tablet: 'Tablette',
  other: 'Autre',
};

export default function DevicesIndex({
  devices,
  filters,
}: {
  devices: DeviceRow[];
  filters: { q?: string; status?: string; type?: string; sort?: string };
}) {
  const [q, setQ] = React.useState(filters.q ?? '');
  const [status, setStatus] = React.useState(filters.status ?? 'all');
  const [type, setType] = React.useState(filters.type ?? 'all');
  const [sort, setSort] = React.useState(filters.sort ?? 'updated_desc');

  const { sortedItems: sortedDevices, sortState, requestSort } = useSortableData(devices, {
    device: (device) => device.display_name ?? '',
    client: (device) => device.user?.name ?? '',
    type: (device) => typeLabels[device.device_type] || device.device_type,
    status: (device) => statusLabels[device.status] || device.status,
    tickets: (device) => device.tickets_count,
  });

  const applyFilters = (next?: Partial<{ q: string; status: string; type: string; sort: string }>) => {
    const payload = {
      q,
      status,
      type,
      sort,
      ...next,
    };

    router.get('/devices', {
      q: payload.q || undefined,
      status: payload.status !== 'all' ? payload.status : undefined,
      type: payload.type !== 'all' ? payload.type : undefined,
      sort: payload.sort !== 'updated_desc' ? payload.sort : undefined,
    }, {
      preserveState: true,
      preserveScroll: true,
      replace: true,
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Parc appareils" />
      <div className="py-2 sm:py-4 w-full space-y-4">
        <Heading title="Parc appareils" description="Inventaire global des appareils clients" />

        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="md:col-span-2">
                <Label>Recherche</Label>
                <Input
                  placeholder="ID, modele, serie, suivi, IMEI, demandeur..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyFilters();
                  }}
                />
              </div>

              <div>
                <Label>Statut</Label>
                <Select value={status} onValueChange={(value) => {
                  setStatus(value);
                  applyFilters({ status: value });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="in_repair">En reparation</SelectItem>
                    <SelectItem value="archived">Archive</SelectItem>
                    <SelectItem value="lost">Perdu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(value) => {
                  setType(value);
                  applyFilters({ type: value });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="computer">Ordinateur</SelectItem>
                    <SelectItem value="phone">Telephone</SelectItem>
                    <SelectItem value="tablet">Tablette</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tri</Label>
                <Select value={sort} onValueChange={(value) => {
                  setSort(value);
                  applyFilters({ sort: value });
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_desc">Maj recente</SelectItem>
                    <SelectItem value="warranty_soon">Garantie proche</SelectItem>
                    <SelectItem value="last_event_desc">Derniere intervention</SelectItem>
                    <SelectItem value="status">Statut</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={() => applyFilters()}>Rechercher</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQ('');
                  setStatus('all');
                  setType('all');
                  setSort('updated_desc');
                  router.get('/devices', {}, { preserveState: true, preserveScroll: true, replace: true });
                }}
              >
                Reinitialiser
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appareils ({devices.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <SortableTh label="Appareil" sortKey="device" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Client" sortKey="client" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Type" sortKey="type" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Statut" sortKey="status" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <SortableTh label="Tickets" sortKey="tickets" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold" />
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Aucun appareil trouve.
                      </td>
                    </tr>
                  ) : sortedDevices.map((device) => (
                    <tr key={device.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{device.display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Serie: {device.serial_number || '-'} | Suivi: {device.asset_tag || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {device.user ? (
                          <div>
                            <div>{device.user.name || `#${device.user.id}`}</div>
                            <div className="text-xs text-muted-foreground">{device.user.email || '-'}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">{typeLabels[device.device_type] || device.device_type}</td>
                      <td className="px-4 py-3 text-sm"><Badge variant="outline">{statusLabels[device.status] || device.status}</Badge></td>
                      <td className="px-4 py-3 text-sm">{device.tickets_count}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {device.user && (
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/users/${device.user.id}/edit#tickets-client`}>Voir client</Link>
                            </Button>
                          )}
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/tickets?device_id=${device.id}&show_all=1`}>Voir tickets</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 p-3 sm:hidden">
              {devices.length === 0 ? (
                <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">Aucun appareil trouve.</div>
              ) : devices.map((device) => (
                <div key={device.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{device.display_name}</p>
                  <p className="text-xs text-muted-foreground">{device.user?.name || '-'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{typeLabels[device.device_type] || device.device_type}</Badge>
                    <Badge variant="outline">{statusLabels[device.status] || device.status}</Badge>
                    <Badge variant="outline">Tickets: {device.tickets_count}</Badge>
                  </div>
                  <div className="mt-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/tickets?device_id=${device.id}&show_all=1`}>Voir tickets</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}
