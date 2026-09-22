import React from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import MobileNativeNav from '@/components/mobile-native-nav';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Agents', href: '/agents' },
  { title: 'Supprimer', href: '' },
];

export default function Delete({ agent }: any) {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Supprimer un agent" />
      <div className="py-4 w-full">
        <Heading title="Supprimer agent" description={`Supprimer l'agent #${agent?.id}`} />

        <Card>
          <CardHeader>
            <CardTitle>Supprimer</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Êtes-vous sûr de vouloir supprimer cet agent ?</p>
            <Button
              type="button"
              variant="destructive"
              className="mt-4"
              onClick={() => {
                if (confirm('Confirmer la suppression ?')) {
                  router.delete(`/agents/${agent?.id}`);
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
