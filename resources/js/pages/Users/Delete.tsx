import React from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import MobileNativeNav from '@/components/mobile-native-nav';

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
            <Button
              type="button"
              variant="destructive"
              className="mt-4"
              onClick={() => {
                if (confirm('Confirmer la suppression ?')) {
                  router.delete(`/users/${user?.id}`);
                }
              }}
            >
              Supprimer
            </Button>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}
