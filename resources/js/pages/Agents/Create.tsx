import React, { useState, useRef } from 'react';
import { Head, Link, Form, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';

type User = {
  id: number;
  name?: string | null;
  email?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Agents', href: '/agents' },
  { title: 'Ajouter', href: '/agents/create' },
];

export default function Create({ users }: { users: User[] }) {
  const [query, setQuery] = useState('');
  const page = usePage();
  const auth = (page.props as any).auth;
  const isAdmin = !!(auth?.user?.is_admin || auth?.user?.agent?.is_admin);

  const filtered = users?.filter((u) =>
    (u.name ?? '').toLowerCase().includes(query.toLowerCase()) || (u.email ?? '').toLowerCase().includes(query.toLowerCase()) || String(u.id).includes(query)
  ) ?? [];

  const passwordInput = useRef<HTMLInputElement>(null);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Ajouter un agent" />

      <div className="py-4 w-full">
        <Heading title="Ajouter un agent" description="Sélectionnez un utilisateur et promouvez-le en tant qu'agent." />

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Utilisateurs disponibles</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Rechercher" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Link href="/agents">
                <Button variant="default">Retour</Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Email</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered && filtered.length ? (
                    filtered.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="py-3 pr-4">{u.id}</td>
                        <td className="py-3 pr-4">{u.name ?? '-'}</td>
                        <td className="py-3 pr-4">{u.email ?? '-'}</td>
                        <td className="py-3 pr-4">
                          {isAdmin ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="default">Promouvoir</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogTitle>Confirmer la promotion</DialogTitle>
                                <DialogDescription>
                                  Entrez votre mot de passe pour confirmer la promotion de cet utilisateur en tant qu'agent.
                                </DialogDescription>

                                <Form action="/agents" method="post" className="space-y-4">
                                  <input type="hidden" name="user_id" value={u.id} />

                                  <div className="grid gap-2">
                                    <Label htmlFor={`password-${u.id}`} className="sr-only">Mot de passe</Label>
                                    <Input
                                      id={`password-${u.id}`}
                                      type="password"
                                      name="password"
                                      ref={passwordInput}
                                      placeholder="Mot de passe"
                                      autoComplete="current-password"
                                    />
                                  </div>

                                  <InputError message={undefined} />

                                  <DialogFooter className="gap-2">
                                    <DialogClose asChild>
                                      <Button variant="secondary">Annuler</Button>
                                    </DialogClose>

                                    <Button asChild>
                                      <button type="submit">Confirmer</button>
                                    </Button>
                                  </DialogFooter>
                                </Form>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-sm text-muted-foreground">Accès refusé</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Aucun utilisateur disponible.</td>
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
