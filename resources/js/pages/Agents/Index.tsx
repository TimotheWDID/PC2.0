import React, { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Agent = {
  id: number;
  user_name?: string | null;
  speciality?: string | null;
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
    (a.user_name ?? '').toLowerCase().includes(query.toLowerCase()) || String(a.id).includes(query)
  ) ?? [];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Agents" />
      <div className="py-2 sm:py-4 w-full">
        <Heading title="Agents" description="Liste et gestion des agents" />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Liste des agents</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
              {isAdmin && (
                <Link href="/agents/create">
                  <Button variant="default" className="w-full sm:w-auto">Nouveau</Button>
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-2 sm:hidden">
              {filtered && filtered.length ? (
                filtered.map((a) => (
                  <div key={a.id} className="rounded-md border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">#{a.id} - {a.user_name ?? '-'}</p>
                      <span className="text-xs text-muted-foreground">{a.created_at ?? '-'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Spécialité: {a.speciality ?? '-'}</p>
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
                ))
              ) : (
                <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">Aucun agent trouvé.</div>
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full table-auto">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Nom</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Spécialité</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Créé le</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered && filtered.length ? (
                    filtered.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-4 py-3 text-sm">{a.id}</td>
                        <td className="px-4 py-3 text-sm">{a.user_name ?? '-'}</td>
                        <td className="px-4 py-3 text-sm">{a.speciality ?? '-'}</td>
                        <td className="px-4 py-3 text-sm">{a.created_at ?? '-'}</td>
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
                    ))
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
    </AppLayout>
  );
}
