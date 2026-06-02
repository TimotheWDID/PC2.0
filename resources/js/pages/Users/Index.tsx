import React, { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type User = {
  id: number;
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
    (u.email ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (u.phone ?? '').toLowerCase().includes(query.toLowerCase()) ||
    String(u.id).includes(query)
  ) ?? [];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Utilisateurs" />
      <div className="py-4 w-full">
        <Heading title="Utilisateurs" description="Liste et gestion des utilisateurs" />

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Liste des utilisateurs</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
              {isAdmin && (
                <Link href="/users/create">
                  <Button variant="default">Nouveau</Button>
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Nom</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Téléphone</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Créé le</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered && filtered.length ? (
                    filtered.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => window.location.href = `/tickets?user_id=${u.id}&show_all=1`}>
                        <td className="px-4 py-4 text-sm font-medium">{u.id}</td>
                        <td className="px-4 py-4 text-sm font-medium">{u.name ?? '-'}</td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{u.email ?? '-'}</td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{u.phone ?? '-'}</td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{u.created_at ?? '-'}</td>
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
    </AppLayout>
  );
}
