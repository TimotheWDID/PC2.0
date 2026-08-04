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
};

type SmsSettings = {
  enabled: boolean;
  base_url: string;
  send_path: string;
  max_length: number;
  api_key: string;
  api_key_set: boolean;
  auth_header: string;
  auth_prefix: string;
  sender: string;
  header: string;
  footer: string;
  default_country_code: string;
  timeout: number;
  verify_ssl: boolean;
  templates: SmsTemplate[];
};

type SmsLimits = {
  max_length_min: number;
  max_length_max: number;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Paramètres SMS', href: '/settings/sms' }];

const createEmptyTemplate = (): SmsTemplate => ({
  title: '',
  content: '',
});

export default function SmsSettingsPage({
  settings,
  defaults,
  limits,
  canManage,
}: {
  settings: SmsSettings;
  defaults: SmsSettings;
  limits: SmsLimits;
  canManage: boolean;
}) {
  const [form, setForm] = useState<SmsSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const clampLength = (value: number) =>
    Math.max(limits.max_length_min, Math.min(limits.max_length_max, value));

  const normalized = useMemo<SmsSettings>(() => ({
    ...form,
    max_length: Number.isFinite(Number(form.max_length)) ? clampLength(Number(form.max_length)) : defaults.max_length,
    timeout: Number.isFinite(Number(form.timeout)) ? Math.max(1, Math.min(60, Number(form.timeout))) : defaults.timeout,
    templates: form.templates.map((template) => ({
      title: template.title.slice(0, 120),
      content: template.content.slice(0, limits.max_length_max),
    })),
  }), [form, defaults.max_length, defaults.timeout, limits.max_length_min, limits.max_length_max]);

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
                    <Input id="max_length" type="number" min={limits.max_length_min} max={limits.max_length_max} value={form.max_length} onChange={(event) => setForm((current) => ({ ...current, max_length: Number(event.target.value || defaults.max_length) }))} disabled={!canManage} />
                    <p className="text-xs text-muted-foreground">Le lien de suivi et le footer sont toujours conservés intégralement lors de la troncature.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="sender">Expéditeur</Label>
                    <Input id="sender" value={form.sender} onChange={(event) => setForm((current) => ({ ...current, sender: event.target.value }))} disabled={!canManage} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="default_country_code">Indicatif pays par défaut</Label>
                    <Input id="default_country_code" value={form.default_country_code} onChange={(event) => setForm((current) => ({ ...current, default_country_code: event.target.value }))} disabled={!canManage} placeholder="+33" />
                    <p className="text-xs text-muted-foreground">Utilisé pour convertir les numéros locaux (06 12 34 56 78 → +33612345678).</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="base_url">Base URL</Label>
                    <Input id="base_url" value={form.base_url} onChange={(event) => setForm((current) => ({ ...current, base_url: event.target.value }))} disabled={!canManage} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="send_path">Chemin d'envoi</Label>
                    <Input id="send_path" value={form.send_path} onChange={(event) => setForm((current) => ({ ...current, send_path: event.target.value }))} disabled={!canManage} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="api_key">Token API</Label>
                    <Input
                      id="api_key"
                      type="password"
                      autoComplete="new-password"
                      value={form.api_key}
                      onChange={(event) => setForm((current) => ({ ...current, api_key: event.target.value }))}
                      disabled={!canManage}
                      placeholder={settings.api_key_set ? '•••••••• (laisser vide pour conserver la clé actuelle)' : 'Token SMSFactor'}
                    />
                    {settings.api_key_set && (
                      <p className="text-xs text-muted-foreground">Une clé est déjà configurée. Elle n'est jamais affichée ; saisissez une nouvelle valeur pour la remplacer.</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="auth_header">Header d'authentification</Label>
                    <Input id="auth_header" value={form.auth_header} onChange={(event) => setForm((current) => ({ ...current, auth_header: event.target.value }))} disabled={!canManage} placeholder="X-API-KEY" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="auth_prefix">Préfixe auth</Label>
                    <Input id="auth_prefix" value={form.auth_prefix} onChange={(event) => setForm((current) => ({ ...current, auth_prefix: event.target.value }))} disabled={!canManage} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="timeout">Timeout (secondes)</Label>
                    <Input id="timeout" type="number" min={1} max={60} value={form.timeout} onChange={(event) => setForm((current) => ({ ...current, timeout: Number(event.target.value || defaults.timeout) }))} disabled={!canManage} />
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                  <Checkbox id="verify_ssl" checked={form.verify_ssl} onCheckedChange={(value) => setForm((current) => ({ ...current, verify_ssl: value === true }))} disabled={!canManage} />
                  <div className="space-y-1">
                    <Label htmlFor="verify_ssl" className="cursor-pointer">Vérifier le certificat SSL</Label>
                    <p className="text-xs text-muted-foreground">À ne désactiver que pour le débogage en environnement local.</p>
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
                    <p className="text-xs text-muted-foreground">Insérez [signature] dans un message prédéfini pour y injecter ce footer.</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => router.visit('/settings/sms/templates')}>
                    Gérer les messages prédéfinis
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Messages prédéfinis</h3>
                      <p className="text-xs text-muted-foreground">Placeholders disponibles : [MagicLink] (lien de suivi du ticket) et [signature] (footer).</p>
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
                      <div key={index} className="space-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm">
                        <div className="grid gap-2">
                          <Label htmlFor={`template-title-${index}`}>Titre</Label>
                          <Input id={`template-title-${index}`} value={template.title} onChange={(event) => updateTemplate(index, { title: event.target.value })} disabled={!canManage} placeholder="Réponse rapide" />
                        </div>

                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor={`template-content-${index}`}>Contenu</Label>
                            <span className={`text-xs ${template.content.length > form.max_length ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {template.content.length}/{form.max_length}
                            </span>
                          </div>
                          <Textarea id={`template-content-${index}`} rows={5} value={template.content} onChange={(event) => updateTemplate(index, { content: event.target.value.slice(0, limits.max_length_max) })} disabled={!canManage} />
                          {template.content.length > form.max_length && (
                            <p className="text-xs text-muted-foreground">Le message sera tronqué à l'envoi ; le lien et le footer resteront intacts.</p>
                          )}
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
              <p>Les SMS de réponse aux tickets partent tels quels : le contenu du message prédéfini est rendu ([MagicLink], [signature]) puis tronqué à la limite configurée.</p>
              <p>Lors de la troncature, le lien de suivi et le footer sont toujours conservés en entier ; seul le corps du message est raccourci.</p>
              <p>Les numéros locaux sont convertis automatiquement au format international avec l'indicatif par défaut.</p>
            </CardContent>
          </Card>
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}
