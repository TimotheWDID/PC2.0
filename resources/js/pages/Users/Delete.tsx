import React from 'react';
import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Utilisateurs', href: '/users' },
  { title: 'Supprimer', href: '' },
];

export default function Delete({ user }: any) {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Supprimer un utilisateur" />
      <div className="py-4 w-full">
        <Heading title="Supprimer utilisateur" description={`Supprimer l'utilisateur #${user?.id}`} />

        <Card>
          <CardHeader>
            <CardTitle>Supprimer</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.</p>
            <form action={`/users/${user?.id}`} method="POST" className="mt-4" onSubmit={(e) => { if(!confirm('Confirmer la suppression ?')) e.preventDefault(); }}>
              <input type="hidden" name="_method" value="DELETE" />
              <input type="hidden" name="_token" value={(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content} />
              <Button type="submit" variant="destructive">Supprimer</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
