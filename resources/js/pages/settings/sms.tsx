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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';

type SmsTemplate = {
  title: string;
  content: string;
  bypass_decorations: boolean;
};

type SmsSettings = {
  enabled: boolean;
  base_url: string;
  send_path: string;
  max_length: number;
  api_key: string;
  auth_header: string;
  auth_prefix: string;
  sender: string;
  header: string;
  footer: string;
  templates: SmsTemplate[];
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Paramètres SMS', href: '/settings/sms' }];

const createEmptyTemplate = (): SmsTemplate => ({
  title: '',
  content: '',
  bypass_decorations: false,
});

export default function SmsSettingsPage({
  settings,
  defaults,
  canManage,
}: {
  settings: SmsSettings;
  defaults: SmsSettings;
  canManage: boolean;
}) {
  const [form, setForm] = useState<SmsSettings>(settings?.templates?.length ? settings : { ...settings, templates: defaults.templates });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(settings?.templates?.length ? settings : { ...settings, templates: defaults.templates });
  }, [settings, defaults.templates]);

  const normalized = useMemo<SmsSettings>(() => ({
    ...form,
    max_length: Number.isFinite(Number(form.max_length)) ? Math.max(1, Math.min(1000, Number(form.max_length))) : defaults.max_length,
    templates: form.templates.map((template) => ({
      title: template.title.slice(0, 120),
      content: template.content.slice(0, 1000),
      bypass_decorations: !!template.bypass_decorations,
    })),
  }), [form, defaults.max_length]);

  const updateTemplate = (index: number, patch: Partial<SmsTemplate>) => {
    setForm((current) => ({
      ...current,
      templates: current.templates.map((template, currentIndex) => (currentIndex === index ? { ...template, ...patch } : template)),
    }));
  };

  const addTemplate = () => {
    setForm((current) => ({
      ...current,
      templates: [...current.templates, createEmptyTemplate()],
    }));
  };

  const removeTemplate = (index: number) => {
    setForm((current) => ({
      ...current,
      templates: current.templates.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    router.put('/settings/sms', normalized, {
      preserveScroll: true,
      onSuccess: () => {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
      },
    });
  };

  const handleReset = () => {
    setForm(defaults);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Paramètres SMS" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Paramètres SMS"
            description="Réglez l'entête, le pied de page, la limite de caractères et les messages prédéfinis du canal SMS."
          />

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Configuration générale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-end gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                    <Checkbox id="enabled" checked={form.enabled} onCheckedChange={(value) => setForm((current) => ({ ...current, enabled: value === true }))} disabled={!canManage} />
                    <div className="space-y-1">
                      <Label htmlFor="enabled" className="cursor-pointer">Activer le canal SMS</Label>
                      <p className="text-xs text-muted-foreground">Désactive temporairement les envois sans toucher à la configuration.</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="max_length">Limite de caractères</Label>
                    <Input id="max_length" type="number" min={1} max={1000} value={form.max_length} onChange={(event) => setForm((current) => ({ ...current, max_length: Number(event.target.value || defaults.max_length) }))} disabled={!canManage} />
                    <p className="text-xs text-muted-foreground">Appliquée après ajout du header et du footer sur les messages normaux.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="sender">Expéditeur</Label>
                    <Input id="sender" value={form.sender} onChange={(event) => setForm((current) => ({ ...current, sender: event.target.value }))} disabled={!canManage} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="base_url">Base URL</Label>
                    <Input id="base_url" value={form.base_url} onChange={(event) => setForm((current) => ({ ...current, base_url: event.target.value }))} disabled={!canManage} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="send_path">Chemin d'envoi</Label>
                    <Input id="send_path" value={form.send_path} onChange={(event) => setForm((current) => ({ ...current, send_path: event.target.value }))} disabled={!canManage} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="api_key">Token API</Label>
                    <Input id="api_key" value={form.api_key} onChange={(event) => setForm((current) => ({ ...current, api_key: event.target.value }))} disabled={!canManage} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="auth_header">Header d'authentification</Label>
                    <Input id="auth_header" value={form.auth_header} onChange={(event) => setForm((current) => ({ ...current, auth_header: event.target.value }))} disabled={!canManage} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="auth_prefix">Préfixe auth</Label>
                    <Input id="auth_prefix" value={form.auth_prefix} onChange={(event) => setForm((current) => ({ ...current, auth_prefix: event.target.value }))} disabled={!canManage} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="header">Header SMS</Label>
                    <Textarea id="header" rows={4} value={form.header} onChange={(event) => setForm((current) => ({ ...current, header: event.target.value }))} disabled={!canManage} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="footer">Footer SMS</Label>
                    <Textarea id="footer" rows={4} value={form.footer} onChange={(event) => setForm((current) => ({ ...current, footer: event.target.value }))} disabled={!canManage} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Les messages prédéfinis peuvent contourner le header et le footer. Ils sont utiles pour les réponses courtes, les notifications internes ou les messages déjà formatés.
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Messages prédéfinis</h3>
                      <p className="text-xs text-muted-foreground">Chaque modèle peut ignorer les décorations globales.</p>
                    </div>

                    <Button type="button" variant="outline" size="sm" onClick={addTemplate} disabled={!canManage}>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {form.templates.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                        Aucun message prédéfini. Ajoutez un modèle pour commencer.
                      </div>
                    )}

                    {form.templates.map((template, index) => (
                      <div key={`${index}-${template.title}`} className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm">
                        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                          <div className="grid gap-2">
                            <Label htmlFor={`template-title-${index}`}>Titre</Label>
                            <Input id={`template-title-${index}`} value={template.title} onChange={(event) => updateTemplate(index, { title: event.target.value })} disabled={!canManage} placeholder="Réponse rapide" />
                          </div>

                          <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                            <Checkbox id={`template-bypass-${index}`} checked={template.bypass_decorations} onCheckedChange={(value) => updateTemplate(index, { bypass_decorations: value === true })} disabled={!canManage} />
                            <Label htmlFor={`template-bypass-${index}`} className="cursor-pointer text-sm">Ignorer header/footer</Label>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`template-content-${index}`}>Contenu</Label>
                          <Textarea id={`template-content-${index}`} rows={5} value={template.content} onChange={(event) => updateTemplate(index, { content: event.target.value })} disabled={!canManage} />
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
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={!canManage}>Enregistrer</Button>
                  <Button type="button" variant="outline" onClick={handleReset} disabled={!canManage}>Réinitialiser</Button>
                  <p className="text-sm text-muted-foreground">{saved ? 'Paramètres SMS enregistrés.' : 'Les modifications sont stockées localement dans l’application.'}</p>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Rappel du format</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Les SMS standards sont assemblés dans cet ordre: header, contenu, footer.</p>
              <p>Les messages prédéfinis cochés comme ignorants les décorations partent tels quels, sans ajout automatique.</p>
              <p>Le limiteur de caractères reste appliqué au flux standard pour éviter les messages trop longs.</p>
            </CardContent>
          </Card>
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}