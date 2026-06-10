import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import LogModal from '@/components/LogModal';

import MobileNativeNav from '@/components/mobile-native-nav';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Agents', href: '/agents' },
  { title: 'Modifier', href: '' },
];

export default function Edit({ agent, specialities, agentSpecialityIds, activeTicketCount = 0 }: any) {
  const [selected, setSelected] = useState<number[]>(agentSpecialityIds ?? []);
  const [isAdmin, setIsAdmin] = useState(!!agent?.is_admin);
  const [isActive, setIsActive] = useState(agent?.is_active !== false);

  type AgentEditForm = {
    speciality_ids: number[];
    is_admin: boolean;
    is_active: boolean;
  };

  const { data, setData, put, processing, errors } = useForm<AgentEditForm>({
    speciality_ids: agentSpecialityIds ?? [],
    is_admin: !!agent?.is_admin,
    is_active: agent?.is_active !== false,
  });

  // keep local selected in sync with form data
  React.useEffect(() => {
    setData('speciality_ids', selected);
  }, [selected]);

  React.useEffect(() => {
    setData('is_admin', isAdmin);
  }, [isAdmin]);

  React.useEffect(() => {
    setData('is_active', isActive);
  }, [isActive]);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Éditer un agent" />
      <div className="py-4 w-full">
        <Heading title="Modifier agent" description={`Modifier l'agent #${agent?.id}`} />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Modifier</CardTitle>
              <LogModal
                subjectType="App\\Models\\Agent"
                subjectId={agent?.id}
                buttonVariant="ghost"
                buttonSize="sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();

                const wasActiveInitially = agent?.is_active !== false;
                const willBeDeactivated = wasActiveInitially && !isActive;

                if (willBeDeactivated && Number(activeTicketCount) > 0) {
                  const confirmed = window.confirm(
                    `Attention: cet agent a ${activeTicketCount} ticket(s) actif(s).\n` +
                    'Si vous confirmez, ces tickets seront désassignés et passeront en "Non assigné".'
                  );

                  if (!confirmed) {
                    return;
                  }
                }

                put(`/agents/${agent?.id}`);
              }}
            >
              <div className="grid gap-4">
                <fieldset>
                  <legend className="text-sm font-medium">Spécialités</legend>
                  <div className="mt-2 grid gap-2">
                    {(specialities ?? []).map((s: any) => (
                      <label key={s.id} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="speciality_ids[]"
                          value={s.id}
                          checked={selected.includes(s.id)}
                          onChange={(e) => {
                            const id = Number(e.target.value);
                            if (e.target.checked) setSelected((p) => Array.from(new Set([...p, id])));
                            else setSelected((p) => p.filter((x) => x !== id));
                          }}
                        />
                        <span>{s.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_admin" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
                  <span>Administrateur</span>
                </label>

                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Statut de l'agent</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isActive ? 'Cet agent est actif et peut être assigné.' : 'Cet agent est désactivé et isolé dans la liste.'}
                  </p>
                  {Number(activeTicketCount) > 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      Attention: cet agent a {activeTicketCount} ticket(s) actif(s). Ils seront désassignés lors de la désactivation.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant={isActive ? 'destructive' : 'outline'}
                    className="mt-3"
                    onClick={() => setIsActive((prev) => !prev)}
                  >
                    {isActive ? 'Désactiver l\'agent' : 'Réactiver l\'agent'}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={processing}>Enregistrer</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}
