import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import HeadingSmall from '@/components/heading-small';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { type BreadcrumbItem } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

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

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Donnees modifiables', href: '/settings/editable-data' },
];

export default function EditableDataSettings({
  categories,
  specialities,
  canManage,
}: {
  categories: CategoryItem[];
  specialities: SpecialityItem[];
  canManage: boolean;
}) {
  const [categoryName, setCategoryName] = useState('');
  const [specialityName, setSpecialityName] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [specialitySearch, setSpecialitySearch] = useState('');
  const [categoryUsageFilter, setCategoryUsageFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [specialityUsageFilter, setSpecialityUsageFilter] = useState<'all' | 'used' | 'unused'>('all');

  const sortedCategories = useMemo(() => {
    return [...(categories ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [categories]);

  const sortedSpecialities = useMemo(() => {
    return [...(specialities ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [specialities]);

  const categoryStats = useMemo(() => {
    const total = sortedCategories.length;
    const used = sortedCategories.filter((item) => item.tickets_count > 0).length;

    return {
      total,
      used,
      unused: Math.max(0, total - used),
    };
  }, [sortedCategories]);

  const specialityStats = useMemo(() => {
    const total = sortedSpecialities.length;
    const used = sortedSpecialities.filter((item) => item.agents_count > 0).length;

    return {
      total,
      used,
      unused: Math.max(0, total - used),
    };
  }, [sortedSpecialities]);

  const filteredCategories = useMemo(() => {
    return sortedCategories.filter((item) => {
      const matchesSearch =
        categorySearch.trim() === '' ||
        item.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
        (item.slug ?? '').toLowerCase().includes(categorySearch.toLowerCase());

      if (!matchesSearch) {
        return false;
      }

      if (categoryUsageFilter === 'used') {
        return item.tickets_count > 0;
      }

      if (categoryUsageFilter === 'unused') {
        return item.tickets_count === 0;
      }

      return true;
    });
  }, [sortedCategories, categorySearch, categoryUsageFilter]);

  const filteredSpecialities = useMemo(() => {
    return sortedSpecialities.filter((item) => {
      const matchesSearch =
        specialitySearch.trim() === '' ||
        item.name.toLowerCase().includes(specialitySearch.toLowerCase());

      if (!matchesSearch) {
        return false;
      }

      if (specialityUsageFilter === 'used') {
        return item.agents_count > 0;
      }

      if (specialityUsageFilter === 'unused') {
        return item.agents_count === 0;
      }

      return true;
    });
  }, [sortedSpecialities, specialitySearch, specialityUsageFilter]);

  const addCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !categoryName.trim()) {
      return;
    }

    router.post('/settings/editable-data/categories', {
      name: categoryName.trim(),
    }, {
      preserveScroll: true,
      onSuccess: () => setCategoryName(''),
    });
  };

  const removeCategory = (id: number, name: string) => {
    if (!canManage) {
      return;
    }

    const target = sortedCategories.find((item) => item.id === id);
    const usage = target?.tickets_count ?? 0;
    const warning = usage > 0
      ? `Cette categorie est utilisee par ${usage} ticket(s). La suppression retirera aussi ces liaisons.`
      : 'Cette categorie n\'est liee a aucun ticket.';

    if (!window.confirm(`Supprimer la categorie "${name}" ?\n\n${warning}`)) {
      return;
    }

    router.delete(`/settings/editable-data/categories/${id}`, {
      preserveScroll: true,
    });
  };

  const addSpeciality = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !specialityName.trim()) {
      return;
    }

    router.post('/settings/editable-data/specialities', {
      name: specialityName.trim(),
    }, {
      preserveScroll: true,
      onSuccess: () => setSpecialityName(''),
    });
  };

  const removeSpeciality = (id: number, name: string) => {
    if (!canManage) {
      return;
    }

    const target = sortedSpecialities.find((item) => item.id === id);
    const usage = target?.agents_count ?? 0;
    const warning = usage > 0
      ? `Cette specialite est utilisee par ${usage} agent(s). Elle sera retiree de leurs profils.`
      : 'Cette specialite n\'est utilisee par aucun agent.';

    if (!window.confirm(`Supprimer la specialite "${name}" ?\n\n${warning}`)) {
      return;
    }

    router.delete(`/settings/editable-data/specialities/${id}`, {
      preserveScroll: true,
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Donnees modifiables" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Donnees modifiables"
            description="Ajoutez ou retirez rapidement les categories de tickets et les specialites des agents depuis un seul ecran."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Categories de tickets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border px-2 py-1">Total: {categoryStats.total}</span>
                  <span className="rounded-full border px-2 py-1">Utilisees: {categoryStats.used}</span>
                  <span className="rounded-full border px-2 py-1">Non utilisees: {categoryStats.unused}</span>
                </div>

                <form onSubmit={addCategory} className="space-y-2">
                  <Label htmlFor="category_name">Nouvelle categorie</Label>
                  <div className="flex gap-2">
                    <Input
                      id="category_name"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="Ex: Maintenance materiel"
                      disabled={!canManage}
                    />
                    <Button type="submit" disabled={!canManage || !categoryName.trim()}>
                      <Plus className="mr-1 h-4 w-4" />
                      Ajouter
                    </Button>
                  </div>
                </form>

                <div className="space-y-2">
                  <Label htmlFor="category_search">Rechercher une categorie</Label>
                  <Input
                    id="category_search"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Nom ou slug"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={categoryUsageFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryUsageFilter('all')}>
                      Toutes
                    </Button>
                    <Button type="button" variant={categoryUsageFilter === 'used' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryUsageFilter('used')}>
                      Utilisees
                    </Button>
                    <Button type="button" variant={categoryUsageFilter === 'unused' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryUsageFilter('unused')}>
                      Non utilisees
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucune categorie.</p>
                  )}

                  {filteredCategories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between rounded-md border border-border p-2">
                      <div>
                        <p className="text-sm font-medium">{category.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {category.tickets_count} ticket(s){category.slug ? ` • slug: ${category.slug}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canManage}
                        onClick={() => removeCategory(category.id, category.name)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Specialites agents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border px-2 py-1">Total: {specialityStats.total}</span>
                  <span className="rounded-full border px-2 py-1">Utilisees: {specialityStats.used}</span>
                  <span className="rounded-full border px-2 py-1">Non utilisees: {specialityStats.unused}</span>
                </div>

                <form onSubmit={addSpeciality} className="space-y-2">
                  <Label htmlFor="speciality_name">Nouvelle specialite</Label>
                  <div className="flex gap-2">
                    <Input
                      id="speciality_name"
                      value={specialityName}
                      onChange={(e) => setSpecialityName(e.target.value)}
                      placeholder="Ex: Android"
                      disabled={!canManage}
                    />
                    <Button type="submit" disabled={!canManage || !specialityName.trim()}>
                      <Plus className="mr-1 h-4 w-4" />
                      Ajouter
                    </Button>
                  </div>
                </form>

                <div className="space-y-2">
                  <Label htmlFor="speciality_search">Rechercher une specialite</Label>
                  <Input
                    id="speciality_search"
                    value={specialitySearch}
                    onChange={(e) => setSpecialitySearch(e.target.value)}
                    placeholder="Nom de specialite"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={specialityUsageFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSpecialityUsageFilter('all')}>
                      Toutes
                    </Button>
                    <Button type="button" variant={specialityUsageFilter === 'used' ? 'default' : 'outline'} size="sm" onClick={() => setSpecialityUsageFilter('used')}>
                      Utilisees
                    </Button>
                    <Button type="button" variant={specialityUsageFilter === 'unused' ? 'default' : 'outline'} size="sm" onClick={() => setSpecialityUsageFilter('unused')}>
                      Non utilisees
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {filteredSpecialities.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucune specialite.</p>
                  )}

                  {filteredSpecialities.map((speciality) => (
                    <div key={speciality.id} className="flex items-center justify-between rounded-md border border-border p-2">
                      <div>
                        <p className="text-sm font-medium">{speciality.name}</p>
                        <p className="text-xs text-muted-foreground">{speciality.agents_count} agent(s)</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canManage}
                        onClick={() => removeSpeciality(speciality.id, speciality.name)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {!canManage && (
            <p className="text-sm text-muted-foreground">
              Seuls les administrateurs peuvent modifier ces donnees.
            </p>
          )}
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}
