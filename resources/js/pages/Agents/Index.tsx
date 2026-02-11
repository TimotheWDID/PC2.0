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
      <div className="py-4 w-full">
        <Heading title="Agents" description="Liste et gestion des agents" />

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Liste des agents</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
              {isAdmin && (
                <Link href="/agents/create">
                  <Button variant="default">Nouveau</Button>
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Spécialité</th>
                    <th>Créé le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered && filtered.length ? (
                    filtered.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="py-3 pr-4">{a.id}</td>
                        <td className="py-3 pr-4">{a.user_name ?? '-'}</td>
                        <td className="py-3 pr-4">{a.speciality ?? '-'}</td>
                        <td className="py-3 pr-4">{a.created_at ?? '-'}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <Link href={`/agents/${a.id}`} className="underline text-primary">Voir</Link>
                            {isAdmin && (
                              <>
                                <Link href={`/agents/${a.id}/edit`} className="underline text-amber-600">Modifier</Link>
                                <form action={`/agents/${a.id}`} method="POST" style={{ display: 'inline-block' }} onSubmit={(e) => { if(!confirm('Supprimer cet agent ?')) e.preventDefault(); }}>
                                  <input type="hidden" name="_method" value="DELETE" />
                                  <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
                                  <button type="submit" className="text-red-600 underline">Supprimer</button>
                                </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Aucun agent trouvé.</td>
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
