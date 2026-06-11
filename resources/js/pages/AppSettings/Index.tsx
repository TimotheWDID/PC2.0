import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/heading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { type BreadcrumbItem } from '@/types';
import { ArrowRight, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';

type CategoryItem = {
  id: number;
  name: string;
  slug: string | null;
  tickets_count: number;
};

type SpecialityItem = {
  id: number;
  name: string;
  agents_count: number;
};

type ModuleItem = {
  title: string;
  description: string;
  href: string;
  status: string;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Parametrage application', href: '/app-settings' },
];

export default function AppSettingsIndex({
  categories,
  specialities,
  modules,
}: {
  categories: CategoryItem[];
  specialities: SpecialityItem[];
  modules: ModuleItem[];
}) {
  const [query, setQuery] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [specialityName, setSpecialityName] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const filteredModules = useMemo(() => {
    if (!normalizedQuery) return modules;

    return modules.filter((module) => {
      return (
        module.title.toLowerCase().includes(normalizedQuery) ||
        module.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [modules, normalizedQuery]);

  const filteredCategories = useMemo(() => {
    const sorted = [...(categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (!normalizedQuery) return sorted;

    return sorted.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        (item.slug ?? '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [categories, normalizedQuery]);

  const filteredSpecialities = useMemo(() => {
    const sorted = [...(specialities ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (!normalizedQuery) return sorted;

    return sorted.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [specialities, normalizedQuery]);

  const addCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = categoryName.trim();
    if (!name) return;

    router.post('/app-settings/categories', { name }, {
      preserveScroll: true,
      onSuccess: () => setCategoryName(''),
    });
  };

  const removeCategory = (item: CategoryItem) => {
    const warning = item.tickets_count > 0
      ? `Cette categorie est liee a ${item.tickets_count} ticket(s). Les liaisons seront retirees.`
      : 'Cette categorie n\'est liee a aucun ticket.';

    if (!window.confirm(`Supprimer la categorie "${item.name}" ?\n\n${warning}`)) {
      return;
    }

    router.delete(`/app-settings/categories/${item.id}`, { preserveScroll: true });
  };

  const addSpeciality = (e: React.FormEvent) => {
    e.preventDefault();
    const name = specialityName.trim();
    if (!name) return;

    router.post('/app-settings/specialities', { name }, {
      preserveScroll: true,
      onSuccess: () => setSpecialityName(''),
    });
  };

  const removeSpeciality = (item: SpecialityItem) => {
    const warning = item.agents_count > 0
      ? `Cette specialite est utilisee par ${item.agents_count} agent(s). Elle sera retiree de leurs profils.`
      : 'Cette specialite n\'est utilisee par aucun agent.';

    if (!window.confirm(`Supprimer la specialite "${item.name}" ?\n\n${warning}`)) {
      return;
    }

    router.delete(`/app-settings/specialities/${item.id}`, { preserveScroll: true });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Parametrage application" />

      <div className="w-full space-y-5 py-4">
        <Heading
          title="Parametrage de l'application"
          description="Page centrale de customisation. Cette page est faite pour accueillir progressivement toutes les valeurs modifiables de l'app."
        />

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                Hub de configuration unifie
              </div>
              <div className="relative w-full md:w-96">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un module, une categorie ou une specialite"
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Modules de configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredModules.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun module ne correspond a la recherche.</p>
              )}

              {filteredModules.map((module) => (
                <div key={module.href} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">{module.title}</p>
                    <p className="text-xs text-muted-foreground">{module.description}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{module.status}</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={module.href}>
                      Ouvrir
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categories de tickets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addCategory} className="space-y-2">
                <Label htmlFor="category_name">Ajouter une categorie</Label>
                <div className="flex gap-2">
                  <Input
                    id="category_name"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Ex: Maintenance atelier"
                  />
                  <Button type="submit" disabled={!categoryName.trim()}>
                    <Plus className="mr-1 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
              </form>

              <div className="space-y-2">
                {filteredCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune categorie visible avec ce filtre.</p>
                )}

                {filteredCategories.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-border p-2">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.tickets_count} ticket(s){item.slug ? ` • ${item.slug}` : ''}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeCategory(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Specialites des agents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={addSpeciality} className="space-y-2">
                <Label htmlFor="speciality_name">Ajouter une specialite</Label>
                <div className="flex gap-2">
                  <Input
                    id="speciality_name"
                    value={specialityName}
                    onChange={(e) => setSpecialityName(e.target.value)}
                    placeholder="Ex: Apple, Android, Reseau"
                  />
                  <Button type="submit" disabled={!specialityName.trim()}>
                    <Plus className="mr-1 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
              </form>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filteredSpecialities.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune specialite visible avec ce filtre.</p>
                )}

                {filteredSpecialities.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-border p-2">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.agents_count} agent(s)</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeSpeciality(item)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
