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

type MailFooterSettings = {
  enabled: boolean;
  content: string;
  image_url: string;
  image_alt: string;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Parametrage application', href: '/app-settings' },
];

export default function AppSettingsIndex({
  categories,
  specialities,
  modules,
  mailFooter,
}: {
  categories: CategoryItem[];
  specialities: SpecialityItem[];
  modules: ModuleItem[];
  mailFooter: MailFooterSettings;
}) {
  const [query, setQuery] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [specialityName, setSpecialityName] = useState('');
  const [footerEnabled, setFooterEnabled] = useState(mailFooter?.enabled ?? true);
  const [footerContent, setFooterContent] = useState(mailFooter?.content ?? 'Cordialement,\nSupportPC');
  const [footerImageUrl, setFooterImageUrl] = useState(mailFooter?.image_url ?? '');
  const [footerImageAlt, setFooterImageAlt] = useState(mailFooter?.image_alt ?? 'Logo SupportPC');

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

  const saveMailFooter = (e: React.FormEvent) => {
    e.preventDefault();

    router.post('/app-settings/mail-footer', {
      enabled: footerEnabled,
      content: footerContent,
      image_url: footerImageUrl,
      image_alt: footerImageAlt,
    }, {
      preserveScroll: true,
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

          <Card className="xl:col-span-2" id="mail-footer">
            <CardHeader>
              <CardTitle>Footer des mails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={saveMailFooter} className="space-y-4">
                <div className="flex items-center gap-3 rounded-md border border-border p-3">
                  <input
                    id="mail_footer_enabled"
                    type="checkbox"
                    checked={footerEnabled}
                    onChange={(e) => setFooterEnabled(e.target.checked)}
                  />
                  <Label htmlFor="mail_footer_enabled">Activer le footer dans les mails</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mail_footer_content">Contenu du footer</Label>
                  <textarea
                    id="mail_footer_content"
                    value={footerContent}
                    onChange={(e) => setFooterContent(e.target.value)}
                    rows={6}
                    className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Cordialement,\nSupportPC"
                  />
                  <p className="text-xs text-muted-foreground">Le footer sera ajouté aux mails de ticket et aux mails de test.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mail_footer_image_url">Image du footer</Label>
                    <Input
                      id="mail_footer_image_url"
                      value={footerImageUrl}
                      onChange={(e) => setFooterImageUrl(e.target.value)}
                      placeholder="https://votre-domaine.tld/logo.png"
                    />
                    <p className="text-xs text-muted-foreground">Utilise une URL absolue accessible depuis les destinataires des emails.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mail_footer_image_alt">Texte alternatif de l'image</Label>
                    <Input
                      id="mail_footer_image_alt"
                      value={footerImageAlt}
                      onChange={(e) => setFooterImageAlt(e.target.value)}
                      placeholder="Logo SupportPC"
                    />
                  </div>
                </div>

                {footerImageUrl.trim() && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <p className="text-sm font-medium">Aperçu</p>
                    <img
                      src={footerImageUrl.trim()}
                      alt={footerImageAlt.trim() || 'Footer image'}
                      className="max-h-20 max-w-full object-contain"
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit">Enregistrer le footer</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
