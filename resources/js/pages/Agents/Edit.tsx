import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LogModal from '@/components/LogModal';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Agents', href: '/agents' },
  { title: 'Modifier', href: '' },
];

export default function Edit({ agent, specialities, agentSpecialityIds }: any) {
  const [selected, setSelected] = useState<number[]>(agentSpecialityIds ?? []);
  const [isAdmin, setIsAdmin] = useState(!!agent?.is_admin);

  const { data, setData, put, processing, errors } = useForm({
    speciality_ids: agentSpecialityIds ?? [],
    is_admin: !!agent?.is_admin,
  });

  // keep local selected in sync with form data
  React.useEffect(() => {
    setData('speciality_ids', selected);
  }, [selected]);

  React.useEffect(() => {
    setData('is_admin', isAdmin);
  }, [isAdmin]);

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

                <div className="flex gap-2">
                  <Button type="submit" disabled={processing}>Enregistrer</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
