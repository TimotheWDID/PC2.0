import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    internal_note: string;
    hiboutik_id: string;
    default_notification_preference: 'SMS' | 'Email' | 'None';
    password: string;
    password_confirmation: string;
    speciality_ids: number[];
    is_admin: boolean;
    is_active: boolean;
  };

  const { data, setData, put, processing, errors } = useForm<AgentEditForm>({
    first_name: agent?.user?.first_name ?? '',
    last_name: agent?.user?.last_name ?? '',
    email: agent?.user?.email ?? '',
    phone: agent?.user?.phone ?? '',
    address: agent?.user?.address ?? '',
    internal_note: agent?.user?.internal_note ?? '',
    hiboutik_id: agent?.user?.hiboutik_id ?? '',
    default_notification_preference: agent?.user?.default_notification_preference ?? 'None',
    password: '',
    password_confirmation: '',
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
                <div className="grid gap-2">
                  <Label htmlFor="first_name">Prenom *</Label>
                  <Input
                    id="first_name"
                    value={data.first_name}
                    onChange={(e) => setData('first_name', e.target.value)}
                    placeholder="Prenom"
                  />
                  {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    value={data.last_name}
                    onChange={(e) => setData('last_name', e.target.value)}
                    placeholder="Nom"
                  />
                  {errors.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    placeholder="email@exemple.com"
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Telephone</Label>
                  <Input
                    id="phone"
                    value={data.phone}
                    onChange={(e) => setData('phone', e.target.value)}
                    placeholder="Telephone"
                  />
                  {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Textarea
                    id="address"
                    value={data.address}
                    onChange={(e) => setData('address', e.target.value)}
                    placeholder="Adresse"
                  />
                  {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="default_notification_preference">Preference de notification *</Label>
                  <Select
                    value={data.default_notification_preference}
                    onValueChange={(value) => setData('default_notification_preference', value as 'SMS' | 'Email' | 'None')}
                  >
                    <SelectTrigger id="default_notification_preference">
                      <SelectValue placeholder="Selectionner une preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMS">SMS</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="None">Aucune</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.default_notification_preference && (
                    <p className="text-sm text-destructive">{errors.default_notification_preference}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="hiboutik_id">ID Hiboutik</Label>
                  <Input
                    id="hiboutik_id"
                    value={data.hiboutik_id}
                    onChange={(e) => setData('hiboutik_id', e.target.value)}
                    placeholder="ID Hiboutik"
                  />
                  {errors.hiboutik_id && <p className="text-sm text-destructive">{errors.hiboutik_id}</p>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="internal_note">Note interne</Label>
                  <Textarea
                    id="internal_note"
                    value={data.internal_note}
                    onChange={(e) => setData('internal_note', e.target.value)}
                    placeholder="Note interne"
                    rows={4}
                  />
                  {errors.internal_note && <p className="text-sm text-destructive">{errors.internal_note}</p>}
                </div>

                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">Changer le mot de passe utilisateur</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Laissez vide pour conserver le mot de passe actuel.
                  </p>
                  <div className="mt-3 grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="password">Nouveau mot de passe</Label>
                      <Input
                        id="password"
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        placeholder="Nouveau mot de passe"
                      />
                      {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password_confirmation">Confirmation</Label>
                      <Input
                        id="password_confirmation"
                        type="password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        placeholder="Confirmer le mot de passe"
                      />
                    </div>
                  </div>
                </div>

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
