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

type Agent = {
  id: number;
  user_name?: string | null;
  specialities?: string[];
  is_active?: boolean;
  created_at?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Agents', href: '/agents' },
];

export default function Index({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState('');
  const page = usePage();
  const auth = (page.props as any).auth;
  // Check common places for admin flag: direct user.is_admin or nested agent relation
  const isAdmin = !!(auth?.user?.is_admin || auth?.user?.agent?.is_admin);

  const filtered = agents?.filter((a) =>
    (a.user_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (a.specialities ?? []).join(' ').toLowerCase().includes(query.toLowerCase()) ||
    (a.created_at ?? '').toLowerCase().includes(query.toLowerCase()) ||
    String(a.id).includes(query)
  ) ?? [];

  const { sortedItems: sortedFiltered, sortState, requestSort } = useSortableData(filtered, {
    id: (a) => a.id,
    name: (a) => a.user_name ?? '',
    specialities: (a) => (a.specialities ?? []).join(' '),
    created_at: (a) => a.created_at ?? '',
  });

  const activeAgents = sortedFiltered.filter((a) => a.is_active !== false);
  const disabledAgents = sortedFiltered.filter((a) => a.is_active === false);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Agents" />
      <div className="py-2 sm:py-4 w-full">
        <Heading title="Agents" description="Liste et gestion des agents" />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Liste des agents</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input placeholder="Rechercher ID, nom, specialite..." value={query} onChange={(e) => setQuery(e.target.value)} />
              {isAdmin && (
                <Link href="/agents/create">
                  <Button variant="default" className="w-full sm:w-auto">Nouveau</Button>
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-2 sm:hidden">
              {sortedFiltered && sortedFiltered.length ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agents actifs ({activeAgents.length})</p>
                  {activeAgents.map((a) => (
                  <div key={a.id} className="rounded-md border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">#{a.id} - {a.user_name ?? '-'}</p>
                      <span className="text-xs text-muted-foreground">{formatDateTimeFr(a.created_at, { timeZone: 'Europe/Paris' })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Spécialité: {(a.specialities && a.specialities.length > 0) ? a.specialities.join(', ') : '-'}</p>
                    <p className="text-xs text-muted-foreground">Statut: Actif</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link href={`/agents/${a.id}`}>
                        <Button variant="outline" size="sm">Voir</Button>
                      </Link>
                      {isAdmin && (
                        <>
                          <Link href={`/agents/${a.id}/edit`}>
                            <Button variant="outline" size="sm">Modifier</Button>
                          </Link>
                          <form action={`/agents/${a.id}`} method="POST" style={{ display: 'inline-block' }} onSubmit={(e) => { if(!confirm('Supprimer cet agent ?')) e.preventDefault(); }}>
                            <input type="hidden" name="_method" value="DELETE" />
                            <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
                            <Button type="submit" variant="destructive" size="sm">Supprimer</Button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                  ))}

                  {!!disabledAgents.length && (
                    <>
                      <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agents désactivés ({disabledAgents.length})</p>
                      {disabledAgents.map((a) => (
                        <div key={a.id} className="rounded-md border border-dashed p-3 opacity-80">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">#{a.id} - {a.user_name ?? '-'}</p>
                            <span className="text-xs text-muted-foreground">{formatDateTimeFr(a.created_at, { timeZone: 'Europe/Paris' })}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Spécialité: {(a.specialities && a.specialities.length > 0) ? a.specialities.join(', ') : '-'}</p>
                          <p className="text-xs text-muted-foreground">Statut: Désactivé</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Link href={`/agents/${a.id}`}>
                              <Button variant="outline" size="sm">Voir</Button>
                            </Link>
                            {isAdmin && (
                              <>
                                <Link href={`/agents/${a.id}/edit`}>
                                  <Button variant="outline" size="sm">Modifier</Button>
                                </Link>
                                <form action={`/agents/${a.id}`} method="POST" style={{ display: 'inline-block' }} onSubmit={(e) => { if(!confirm('Supprimer cet agent ?')) e.preventDefault(); }}>
                                  <input type="hidden" name="_method" value="DELETE" />
                                  <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
                                  <Button type="submit" variant="destructive" size="sm">Supprimer</Button>
                                </form>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">Aucun agent trouvé.</div>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full table-auto">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <SortableTh label="ID" sortKey="id" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Nom" sortKey="name" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Spécialité" sortKey="specialities" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <SortableTh label="Créé le" sortKey="created_at" sortState={sortState} onSort={requestSort} className="px-4 py-3 text-left text-sm font-semibold text-foreground" />
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFiltered && sortedFiltered.length ? (
                    <>
                    <tr className="bg-muted/30">
                      <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Agents actifs ({activeAgents.length})
                      </td>
                    </tr>
                    {activeAgents.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm">{a.id}</td>
                        <td className="px-4 py-3 text-sm">{a.user_name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm">{(a.specialities && a.specialities.length > 0) ? a.specialities.join(', ') : '-'}</td>
                        <td className="px-4 py-3 text-sm">{formatDateTimeFr(a.created_at, { timeZone: 'Europe/Paris' })}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Link href={`/agents/${a.id}`}><Button variant="outline" size="sm">Voir</Button></Link>
                            {isAdmin && (
                              <>
                                <Link href={`/agents/${a.id}/edit`}><Button variant="outline" size="sm">Modifier</Button></Link>
                                <form action={`/agents/${a.id}`} method="POST" style={{ display: 'inline-block' }} onSubmit={(e) => { if(!confirm('Supprimer cet agent ?')) e.preventDefault(); }}>
                                  <input type="hidden" name="_method" value="DELETE" />
                                  <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
                                  <Button type="submit" variant="destructive" size="sm">Supprimer</Button>
                                </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!!disabledAgents.length && (
                      <tr className="bg-muted/20">
                        <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Agents désactivés ({disabledAgents.length})
                        </td>
                      </tr>
                    )}
                    {disabledAgents.map((a) => (
                      <tr key={a.id} className="border-b border-dashed last:border-0 opacity-80">
                        <td className="px-4 py-3 text-sm">{a.id}</td>
                        <td className="px-4 py-3 text-sm">{a.user_name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm">{(a.specialities && a.specialities.length > 0) ? a.specialities.join(', ') : '-'}</td>
                        <td className="px-4 py-3 text-sm">{formatDateTimeFr(a.created_at, { timeZone: 'Europe/Paris' })}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Link href={`/agents/${a.id}`}><Button variant="outline" size="sm">Voir</Button></Link>
                            {isAdmin && (
                              <>
                                <Link href={`/agents/${a.id}/edit`}><Button variant="outline" size="sm">Modifier</Button></Link>
                                <form action={`/agents/${a.id}`} method="POST" style={{ display: 'inline-block' }} onSubmit={(e) => { if(!confirm('Supprimer cet agent ?')) e.preventDefault(); }}>
                                  <input type="hidden" name="_method" value="DELETE" />
                                  <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
                                  <Button type="submit" variant="destructive" size="sm">Supprimer</Button>
                                </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    </>
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun agent trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav fabHref="/agents/create" fabLabel="Nouvel agent" />
    </AppLayout>
  );
}
