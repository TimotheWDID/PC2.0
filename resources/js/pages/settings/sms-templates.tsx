import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

type SmsTemplate = {
  title: string;
  content: string;
};

type SmsSettings = {
  max_length: number;
  templates: SmsTemplate[];
};

type SmsLimits = {
  max_length_min: number;
  max_length_max: number;
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Paramètres SMS', href: '/settings/sms' },
  { title: 'Messages prédéfinis', href: '/settings/sms/templates' },
];

const createEmptyTemplate = (): SmsTemplate => ({
  title: '',
  content: '',
});

export default function SmsTemplatesPage({
  settings,
  limits,
  canManage,
}: {
  settings: SmsSettings;
  limits: SmsLimits;
  canManage: boolean;
}) {
  const [templates, setTemplates] = useState<SmsTemplate[]>(settings?.templates ?? []);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTemplates(settings?.templates ?? []);
  }, [settings]);

  const maxLength = settings?.max_length ?? 160;

  const normalizedTemplates = useMemo(() => templates.map((template) => ({
    title: template.title.slice(0, 120),
    content: template.content.slice(0, limits.max_length_max),
  })), [templates, limits.max_length_max]);

  const updateTemplate = (index: number, patch: Partial<SmsTemplate>) => {
    setTemplates((current) => current.map((template, currentIndex) => (currentIndex === index ? { ...template, ...patch } : template)));
  };

  const addTemplate = () => {
    setTemplates((current) => [...current, createEmptyTemplate()]);
  };

  const removeTemplate = (index: number) => {
    setTemplates((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    router.put('/settings/sms/templates', { templates: normalizedTemplates }, {
      preserveScroll: true,
      onSuccess: () => {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
      },
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Messages prédéfinis SMS" />

      <SettingsLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/settings/sms">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </a>
            </Button>
          </div>

          <HeadingSmall
            title="Messages prédéfinis SMS"
            description="Gérez ici vos modèles SMS. Placeholders disponibles : [MagicLink] (lien de suivi) et [signature] (footer)."
          />

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Gestion des messages prédéfinis</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Templates</h3>
                    <p className="text-xs text-muted-foreground">Au-delà de {maxLength} caractères, le message est tronqué à l'envoi (le lien et le footer restent intacts).</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addTemplate} disabled={!canManage}>
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>

                {templates.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                    Aucun modèle pour le moment.
                  </div>
                )}

                <div className="space-y-4">
                  {templates.map((template, index) => (
                    <div key={index} className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm">
                      <div className="grid gap-2">
                        <Label htmlFor={`template-title-${index}`}>Titre</Label>
                        <Input id={`template-title-${index}`} value={template.title} onChange={(event) => updateTemplate(index, { title: event.target.value })} disabled={!canManage} placeholder="Réponse rapide" />
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`template-content-${index}`}>Contenu</Label>
                          <span className={`text-xs ${template.content.length > maxLength ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {template.content.length}/{maxLength}
                          </span>
                        </div>
                        <Textarea id={`template-content-${index}`} rows={4} value={template.content} onChange={(event) => updateTemplate(index, { content: event.target.value.slice(0, limits.max_length_max) })} disabled={!canManage} />
                      </div>

                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeTemplate(index)} disabled={!canManage}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={!canManage}>Enregistrer</Button>
                  <p className="text-sm text-muted-foreground">{saved ? 'Messages prédéfinis enregistrés.' : `La limite d'envoi actuelle est de ${maxLength} caractères.`}</p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}
