import React, { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateTimeFr } from '@/lib/datetime';
import MobileNativeNav from '@/components/mobile-native-nav';
import { SortableTh, useSortableData } from '@/components/sortable-table';
import { Loader2 } from 'lucide-react';
import { ClientTypeBadge } from '@/components/client-identity-fields';

type User = {
  id: number;
  client_type?: 'person' | 'company' | null;
  company?: { id: number; name: string } | null;
  members_count?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Clients', href: '/users' },
];

type Tab = 'all' | 'person' | 'company';

const tabs: { value: Tab; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'person', label: 'Personnes' },
  { value: 'company', label: 'Entreprises' },
];

const initialTab = (): Tab => {
  if (typeof window === 'undefined') return 'all';
  const type = new URLSearchParams(window.location.search).get('type');
  return type === 'person' || type === 'company' ? type : 'all';
};

const typeOf = (u: User): Tab => (u.client_type === 'company' ? 'company' : 'person');

const companyCell = (u: User): string => {
  if (typeOf(u) === 'company') {
    const count = u.members_count ?? 0;
    return count ? `${count} personne${count > 1 ? 's' : ''}` : '-';
  }
  return u.company?.name ?? '-';
};

export default function Index({ users }: { users: User[] }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const page = usePage();
  const auth = (page.props as any).auth;
  const isAdmin = !!(auth?.user?.is_admin || auth?.user?.agent?.is_admin);

  const changeTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'all') url.searchParams.delete('type');
    else url.searchParams.set('type', next);
    window.history.replaceState(window.history.state, '', url.toString());
  };

  const countFor = (value: Tab) => (value === 'all' ? users.length : users.filter((u) => typeOf(u) === value).length);

  const filtered = users?.filter((u) => tab === 'all' || typeOf(u) === tab).filter((u) =>
    (u.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.first_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.last_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.phone ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.company?.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.created_at ?? '').toLowerCase().includes(query.toLowerCase()) ||
    String(u.id).includes(query)
  ) ?? [];

  const { sortedItems: sortedFiltered, sortState, requestSort } = useSortableData(filtered, {
    id: (u) => u.id,
    name: (u) => u.name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
    company: (u) => companyCell(u),
    email: (u) => u.email ?? '',
    phone: (u) => u.phone ?? '',
    created_at: (u) => u.created_at ?? '',
  });

  const handleDelete = (id: number) => {
    if (!confirm('Supprimer ce client ?')) return;
    setDeletingUserId(id);
    router.delete(`/users/${id}`, { onFinish: () => setDeletingUserId(null) });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Clients" />
      <div className="py-2 sm:py-4 w-full">
        <Heading title="Clients" description="Personnes et entreprises" />

        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Type de client">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => changeTab(item.value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === item.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
              <span className={`rounded-full px-1.5 text-xs ${tab === item.value ? 'bg-primary-foreground/20' : 'bg-muted'}`}>{countFor(item.value)}</span>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{tab === 'company' ? 'Liste des entreprises' : tab === 'person' ? 'Liste des personnes' : 'Liste des clients'}</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input placeholder="Rechercher ID, nom, email, telephone..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {isAdmin && (
                <Link href={tab === 'company' ? '/users/create?type=company' : '/users/create'}>
                  <Button variant="default" className="w-full sm:w-auto">{tab === 'company' ? 'Nouvelle entreprise' : 'Nouveau'}</Button>
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="space-y-2 p-3 sm:hidden">
              {filtered && filtered.length ? (
                filtered.map((u) => (
                  <div key={u.id} className="rounded-md border p-3">
                    <Link href={`/users/${u.id}/show`} className="block">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">#{u.id} - {u.name ?? '-'}</p>
                        <span className="text-xs text-muted-foreground">{formatDateTimeFr(u.created_at, { timeZone: 'Europe/Paris' })}</span>
                      </div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <ClientTypeBadge type={u.client_type} />
                        {companyCell(u) !== '-' && <span className="text-xs text-muted-foreground">{companyCell(u)}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email ?? '-'}</p>
                      <p className="text-xs text-muted-foreground">{u.phone ?? '-'}</p>
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link href={`/tickets?user_id=${u.id}&show_all=1`}>
                        <Button variant="secondary" size="sm">Tickets</Button>
                      </Link>
                      {isAdmin && (
                        <>
                          <Link href={`/users/${u.id}/edit`}>
                            <Button variant="outline" size="sm">Modifier</Button>
                          </Link>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={deletingUserId === u.id}
                            onClick={() => handleDelete(u.id)}
                          >
                            {deletingUserId === u.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                            Supprimer
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">Aucun client trouvé.</div>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <SortableTh label="ID" sortKey="id" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Nom" sortKey="name" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                    <SortableTh label="Entreprise" sortKey="company" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Email" sortKey="email" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Téléphone" sortKey="phone" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Créé le" sortKey="created_at" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered && sortedFiltered.length ? (
                    sortedFiltered.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => window.location.href = `/users/${u.id}/show`}>
                        <td className="px-4 py-4 text-sm font-medium">{u.id}</td>
                        <td className="px-4 py-4 text-sm font-medium">{u.name ?? '-'}</td>
                        <td className="px-4 py-4 text-sm"><ClientTypeBadge type={u.client_type} /></td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{companyCell(u)}</td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{u.email ?? '-'}</td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{u.phone ?? '-'}</td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{formatDateTimeFr(u.created_at, { timeZone: 'Europe/Paris' })}</td>
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Link href={`/tickets?user_id=${u.id}&show_all=1`}>
                              <Button variant="secondary" size="sm">Voir les tickets</Button>
                            </Link>
                            {isAdmin && (
                              <>
                              <Link href={`/users/${u.id}/edit`}>
                                <Button variant="outline" size="sm">Modifier</Button>
                              </Link>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={deletingUserId === u.id}
                                onClick={() => handleDelete(u.id)}
                              >
                                {deletingUserId === u.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                Supprimer
                              </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun client trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav fabHref={tab === 'company' ? '/users/create?type=company' : '/users/create'} fabLabel={tab === 'company' ? 'Nouvelle entreprise' : 'Nouveau client'} />
    </AppLayout>
  );
}
