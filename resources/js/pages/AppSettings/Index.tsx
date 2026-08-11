import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { type BreadcrumbItem } from '@/types';
import { ArrowRight, Bell, FolderTree, Mail, Plus, Search, Settings2, ShieldCheck, Trash2, Workflow, Wrench } from 'lucide-react';

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
  keywords: string[];
};

type MailFooterSettings = {
  enabled: boolean;
  content: string;
  image_url: string;
  image_alt: string;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Parametres application', href: '/settings/application' },
];

export default function AppSettingsIndex({
  categories,
  specialities,
  mailFooter,
}: {
  categories: CategoryItem[];
  specialities: SpecialityItem[];
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

  const modules = useMemo<ModuleItem[]>(() => {
    return [
      {
        title: 'Regles dashboard',
        description: 'Seuils, delais et priorites qui pilotent les alertes et les insights.',
        href: '/settings/dashboard-insights',
        status: 'Pilotage',
        keywords: ['dashboard', 'alertes', 'insights', 'priorites'],
      },
      {
        title: 'Etiquettes tickets',
        description: 'Mise en page, dimensions et champs visibles pour l\'impression.',
        href: '/settings/ticket-label',
        status: 'Tickets',
        keywords: ['ticket', 'etiquette', 'impression'],
      },
      {
        title: 'Modeles de suivi tickets',
        description: 'Modeles d\'evenements predefinis pour accelerer les suivis.',
        href: '/settings/ticket-timeline-templates',
        status: 'Tickets',
        keywords: ['timeline', 'modele', 'suivi'],
      },
      {
        title: 'Listes d\'actions tickets',
        description: 'Checklists reutilisables pour homogeniser les interventions.',
        href: '/settings/ticket-action-lists',
        status: 'Tickets',
        keywords: ['actions', 'checklist', 'tickets'],
      },
      {
        title: 'Notif creation ticket',
        description: 'Message auto envoye au client a chaque creation (mail ou SMS selon la fiche).',
        href: '/settings/ticket-created-notification',
        status: 'Communication',
        keywords: ['notification', 'creation', 'ticket', 'mail', 'sms'],
      },
      {
        title: 'Parametres SMS',
        description: 'Configuration globale du canal SMS et de ses contenus.',
        href: '/settings/sms',
        status: 'Communication',
        keywords: ['sms', 'messages', 'notifications'],
      },
      {
        title: 'Templates SMS',
        description: 'Messages types utilises dans les scenarios de communication.',
        href: '/settings/sms/templates',
        status: 'Communication',
        keywords: ['sms', 'templates', 'contenu'],
      },
      {
        title: 'Mails entrants',
        description: 'Controle des emails recus avant rattachement aux tickets.',
        href: '/settings/inbound-mail-review',
        status: 'Communication',
        keywords: ['mail', 'inbound', 'ticket'],
      },
      {
        title: 'Debug Mail',
        description: 'Ecran de verification pour les envois et le rendu des emails.',
        href: '/settings/mail-debug',
        status: 'Communication',
        keywords: ['mail', 'debug', 'test'],
      },
      {
        title: 'Debug SMS',
        description: 'Validation rapide de la configuration et des envois SMS.',
        href: '/settings/sms-debug',
        status: 'Communication',
        keywords: ['sms', 'debug', 'test'],
      },
      {
        title: 'Impression tickets',
        description: 'Parametres dedies aux impressions rapides et au format d\'edition.',
        href: '/tickets/print-settings',
        status: 'Tickets',
        keywords: ['impression', 'tickets', 'print'],
      },
      {
        title: 'Footer des mails',
        description: 'Texte et image ajoutes en bas des emails du systeme.',
        href: '#mail-footer',
        status: 'Communication',
        keywords: ['footer', 'signature', 'mail'],
      },
      {
        title: 'Donnees metier',
        description: 'Categories de tickets et specialites agents centralisees.',
        href: '#business-data',
        status: 'Organisation',
        keywords: ['categories', 'specialites', 'donnees'],
      },
    ];
  }, []);

  const filteredModules = useMemo(() => {
    if (!normalizedQuery) return modules;

    return modules.filter((module) => {
      return (
        module.title.toLowerCase().includes(normalizedQuery) ||
        module.description.toLowerCase().includes(normalizedQuery) ||
        module.keywords.some((keyword) => keyword.includes(normalizedQuery))
      );
    });
  }, [modules, normalizedQuery]);

  const groupedModules = useMemo(() => {
    return [
      {
        title: 'Organisation',
        description: 'Structure de l\'application, donnees metier et regles globales.',
        icon: Settings2,
        items: filteredModules.filter((module) => ['Organisation', 'Pilotage'].includes(module.status)),
      },
      {
        title: 'Tickets',
        description: 'Impression, suivi et standardisation du traitement des tickets.',
        icon: Workflow,
        items: filteredModules.filter((module) => module.status === 'Tickets'),
      },
      {
        title: 'Communication',
        description: 'SMS, emails et validation des canaux de contact.',
        icon: Mail,
        items: filteredModules.filter((module) => module.status === 'Communication'),
      },
    ].filter((group) => group.items.length > 0);
  }, [filteredModules]);

  const categoryStats = useMemo(() => {
    const used = categories.filter((item) => item.tickets_count > 0).length;

    return {
      total: categories.length,
      used,
      unused: Math.max(0, categories.length - used),
    };
  }, [categories]);

  const specialityStats = useMemo(() => {
    const used = specialities.filter((item) => item.agents_count > 0).length;

    return {
      total: specialities.length,
      used,
      unused: Math.max(0, specialities.length - used),
    };
  }, [specialities]);

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

    router.post('/settings/application/categories', { name }, {
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

    router.delete(`/settings/application/categories/${item.id}`, { preserveScroll: true });
  };

  const addSpeciality = (e: React.FormEvent) => {
    e.preventDefault();
    const name = specialityName.trim();
    if (!name) return;

    router.post('/settings/application/specialities', { name }, {
      preserveScroll: true,
      onSuccess: () => setSpecialityName(''),
    });
  };

  const saveMailFooter = (e: React.FormEvent) => {
    e.preventDefault();

    router.post('/settings/application/mail-footer', {
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

    router.delete(`/settings/application/specialities/${item.id}`, { preserveScroll: true });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Parametres application" />

      <SettingsLayout fullWidth>
        <div className="space-y-6 py-1">
          <HeadingSmall
            title="Parametres application"
            description="Tous les reglages d'administration sont regroupes ici avec des entrees par besoin: organisation, tickets et communication."
          />

          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Hub centralise</p>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Utilisez la recherche pour retrouver un reglage par nom, usage ou canal sans passer entre plusieurs sections de l'application.
                  </p>
                </div>

                <div className="relative w-full lg:w-96">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher un reglage, une categorie ou une specialite"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Settings2 className="h-4 w-4" />
                    Reglages centralises
                  </div>
                  <p className="text-2xl font-semibold">{modules.length}</p>
                  <p className="text-xs text-muted-foreground">points d'entree admin regroupes</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <FolderTree className="h-4 w-4" />
                    Donnees metier
                  </div>
                  <p className="text-2xl font-semibold">{categories.length + specialities.length}</p>
                  <p className="text-xs text-muted-foreground">categories et specialites accessibles au meme endroit</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4" />
                    Footer des mails
                  </div>
                  <p className="text-2xl font-semibold">{footerEnabled ? 'Actif' : 'Inactif'}</p>
                  <p className="text-xs text-muted-foreground">etat actuel de la signature systeme</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            {groupedModules.map((group) => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <group.icon className="h-4 w-4" />
                    {group.title}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.items.map((module) => (
                    <div key={`${group.title}-${module.title}`} className="rounded-xl border border-border/70 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{module.title}</p>
                        <Badge variant="secondary">{module.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{module.description}</p>
                      <div className="mt-3 flex justify-end">
                        <Button asChild size="sm" variant="outline">
                          {module.href.startsWith('#') ? (
                            <a href={module.href}>
                              Ouvrir
                              <ArrowRight className="ml-1 h-4 w-4" />
                            </a>
                          ) : (
                            <Link href={module.href}>
                              Ouvrir
                              <ArrowRight className="ml-1 h-4 w-4" />
                            </Link>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}

                  {group.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucun reglage ne correspond a la recherche.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {groupedModules.length === 0 && (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                Aucun reglage, categorie ou specialite ne correspond a votre recherche.
              </CardContent>
            </Card>
          )}

          <div id="business-data" className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4" />
                  Categories de tickets
                </CardTitle>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border px-2 py-1">Total: {categoryStats.total}</span>
                  <span className="rounded-full border px-2 py-1">Utilisees: {categoryStats.used}</span>
                  <span className="rounded-full border px-2 py-1">Non utilisees: {categoryStats.unused}</span>
                </div>
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
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/70 p-3">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Specialites des agents
                </CardTitle>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border px-2 py-1">Total: {specialityStats.total}</span>
                  <span className="rounded-full border px-2 py-1">Utilisees: {specialityStats.used}</span>
                  <span className="rounded-full border px-2 py-1">Non utilisees: {specialityStats.unused}</span>
                </div>
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

                <div className="grid gap-2 md:grid-cols-2">
                  {filteredSpecialities.length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucune specialite visible avec ce filtre.</p>
                  )}

                  {filteredSpecialities.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/70 p-3">
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

          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <Card id="mail-footer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Footer des mails
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gere la signature email systeme sans quitter le hub d'administration.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={saveMailFooter} className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
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
                    <Textarea
                      id="mail_footer_content"
                      value={footerContent}
                      onChange={(e) => setFooterContent(e.target.value)}
                      rows={6}
                      placeholder="Cordialement,\nSupportPC"
                    />
                    <p className="text-xs text-muted-foreground">Ajoute ce contenu aux emails de ticket et aux emails de test.</p>
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
                    <div className="space-y-2 rounded-xl border border-border/70 p-3">
                      <p className="text-sm font-medium">Apercu</p>
                      <img
                        src={footerImageUrl.trim()}
                        alt={footerImageAlt.trim() || 'Footer image'}
                        className="max-h-20 max-w-full object-contain"
                      />
                    </div>
                  )}

                  <Button type="submit">Enregistrer le footer</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Acces rapides
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Les pages utiles qui restent specialisees, sans sortir du parcours admin.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    icon: Bell,
                    title: 'Regles dashboard',
                    description: 'Alertes, seuils et suggestions.',
                    href: '/settings/dashboard-insights',
                  },
                  {
                    icon: Workflow,
                    title: 'Workflow tickets',
                    description: 'Etiquettes, modeles et listes d\'actions.',
                    href: '/settings/ticket-action-lists',
                  },
                  {
                    icon: Mail,
                    title: 'Canaux de contact',
                    description: 'SMS, templates, debug et mails entrants.',
                    href: '/settings/sms',
                  },
                  {
                    icon: Mail,
                    title: 'Notif creation ticket',
                    description: 'Template du message envoye a la creation.',
                    href: '/settings/ticket-created-notification',
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-border/70 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    <div className="mt-3 flex justify-end">
                      <Button asChild size="sm" variant="outline">
                        <Link href={item.href}>Ouvrir</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}
