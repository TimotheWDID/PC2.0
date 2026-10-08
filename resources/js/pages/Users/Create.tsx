import { useForm, Head, Link } from '@inertiajs/react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';

import MobileNativeNav from '@/components/mobile-native-nav';
import ClientIdentityFields, { type ClientIdentityData, type ClientType, type CompanyOption } from '@/components/client-identity-fields';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Utilisateurs', href: '/users' },
  { title: 'Créer un client', href: '/users/create' },
];

export default function Create({
  companies = [],
  defaultClientType = 'person',
  defaultCompanyId = null,
}: {
  companies?: CompanyOption[];
  defaultClientType?: ClientType;
  defaultCompanyId?: number | null;
}) {
  const { data, setData, post, processing, errors } = useForm({
    client_type: defaultClientType as ClientType,
    company_name: '',
    siret: '',
    company_id: defaultCompanyId ? String(defaultCompanyId) : '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    password_confirmation: '',
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/users');
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Créer un client" />
      <div className="py-4 w-full">
        <Heading
          title="Créer un client"
          description="Créer une personne ou une entreprise"
        />

        <form onSubmit={submit}>
          <Card>
            <CardHeader>
              <CardTitle>Informations du client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ClientIdentityFields
                data={data as ClientIdentityData}
                onChange={(key, value) => setData((current) => ({ ...current, [key]: value }))}
                errors={errors}
                companies={companies}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                  />
                  {errors.email && <div className="text-destructive text-sm mt-1">{errors.email}</div>}
                </div>

                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={data.phone}
                    onChange={(e) => setData('phone', e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                  />
                  {errors.phone && <div className="text-destructive text-sm mt-1">{errors.phone}</div>}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Input
                    id="address"
                    value={data.address}
                    onChange={(e) => setData('address', e.target.value)}
                    placeholder="123 Rue de la Paix, Paris"
                  />
                  {errors.address && <div className="text-destructive text-sm mt-1">{errors.address}</div>}
                </div>

                <div>
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Laisser vide pour permettre à l'utilisateur de définir son propre mot de passe
                  </p>
                  {errors.password && <div className="text-destructive text-sm mt-1">{errors.password}</div>}
                </div>

                <div>
                  <Label htmlFor="password_confirmation">Confirmer le mot de passe</Label>
                  <Input
                    id="password_confirmation"
                    type="password"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                  />
                  {errors.password_confirmation && <div className="text-destructive text-sm mt-1">{errors.password_confirmation}</div>}
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button type="submit" disabled={processing} variant="default">
                  Créer
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/users">Annuler</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}

