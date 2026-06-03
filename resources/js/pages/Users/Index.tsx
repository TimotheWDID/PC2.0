import React, { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateTimeFr } from '@/lib/datetime';
import MobileNativeNav from '@/components/mobile-native-nav';
import { SortableTh, useSortableData } from '@/components/sortable-table';

type User = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Utilisateurs', href: '/users' },
];

export default function Index({ users }: { users: User[] }) {
  const [query, setQuery] = useState('');
  const page = usePage();
  const auth = (page.props as any).auth;
  const isAdmin = !!(auth?.user?.is_admin || auth?.user?.agent?.is_admin);

  const filtered = users?.filter((u) =>
    (u.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.first_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.last_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.email ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.phone ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.created_at ?? '').toLowerCase().includes(query.toLowerCase()) ||
    String(u.id).includes(query)
  ) ?? [];

  const { sortedItems: sortedFiltered, sortState, requestSort } = useSortableData(filtered, {
    id: (u) => u.id,
    name: (u) => u.name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
    email: (u) => u.email ?? '',
    phone: (u) => u.phone ?? '',
    created_at: (u) => u.created_at ?? '',
  });

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Utilisateurs" />
      <div className="py-2 sm:py-4 w-full">
        <Heading title="Utilisateurs" description="Liste et gestion des utilisateurs" />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Liste des utilisateurs</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input placeholder="Rechercher ID, nom, email, telephone..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {isAdmin && (
                <Link href="/users/create">
                  <Button variant="default" className="w-full sm:w-auto">Nouveau</Button>
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="space-y-2 p-3 sm:hidden">
              {filtered && filtered.length ? (
                filtered.map((u) => (
                  <div key={u.id} className="rounded-md border p-3">
                    <Link href={`/tickets?user_id=${u.id}&show_all=1`} className="block">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">#{u.id} - {u.name ?? '-'}</p>
                        <span className="text-xs text-muted-foreground">{formatDateTimeFr(u.created_at, { timeZone: 'Europe/Paris' })}</span>
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
                          <form action={`/users/${u.id}`} method="POST" style={{ display: 'inline-block' }} onSubmit={(e) => { if(!confirm('Supprimer cet utilisateur ?')) e.preventDefault(); }}>
                            <input type="hidden" name="_method" value="DELETE" />
                            <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
                            <Button type="submit" variant="destructive" size="sm">Supprimer</Button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</div>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <SortableTh label="ID" sortKey="id" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Nom" sortKey="name" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Email" sortKey="email" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Téléphone" sortKey="phone" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Créé le" sortKey="created_at" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered && sortedFiltered.length ? (
                    sortedFiltered.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => window.location.href = `/tickets?user_id=${u.id}&show_all=1`}>
                        <td className="px-4 py-4 text-sm font-medium">{u.id}</td>
                        <td className="px-4 py-4 text-sm font-medium">{u.name ?? '-'}</td>
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
                              <form action={`/users/${u.id}`} method="POST" style={{ display: 'inline-block' }} onSubmit={(e) => { if(!confirm('Supprimer cet utilisateur ?')) e.preventDefault(); }}>
                                <input type="hidden" name="_method" value="DELETE" />
                                <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
                                <Button type="submit" variant="destructive" size="sm">Supprimer</Button>
                              </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav fabHref="/users/create" fabLabel="Nouvel utilisateur" />
    </AppLayout>
  );
}
