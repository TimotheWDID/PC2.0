import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type BreadcrumbItem } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

type TemplateItem = {
  eventType: string;
  label: string;
  enabled: boolean;
  summary: string;
  details: string;
};

type TemplateSettings = {
  templates: TemplateItem[];
};

const eventTypeLabel: Record<string, string> = {
  manual_note: 'Note manuelle',
  customer_call: 'Appel client',
  on_site_intervention: 'Intervention sur site',
  diagnostic: 'Diagnostic',
  parts_ordered: 'Pieces commandees',
  parts_received: 'Pieces recues',
  resolution_test: 'Test de resolution',
  handover: 'Remise client',
  other: 'Autre',
  commande_modification_prerequis: 'Modification commande (prerequis)',
};

const baseEventTypes = [
  'manual_note',
  'customer_call',
  'on_site_intervention',
  'diagnostic',
  'parts_ordered',
  'parts_received',
  'resolution_test',
  'handover',
  'other',
  'commande_modification_prerequis',
];

const defaultTemplates: TemplateItem[] = [
  { eventType: 'manual_note', label: 'Note manuelle', enabled: true, summary: '', details: '' },
  { eventType: 'customer_call', label: 'Appel client', enabled: true, summary: '', details: '' },
  { eventType: 'on_site_intervention', label: 'Intervention sur site', enabled: true, summary: '', details: '' },
  { eventType: 'diagnostic', label: 'Diagnostic', enabled: true, summary: '', details: '' },
  { eventType: 'parts_ordered', label: 'Pieces commandees', enabled: true, summary: '', details: '' },
  { eventType: 'parts_received', label: 'Pieces recues', enabled: true, summary: '', details: '' },
  { eventType: 'resolution_test', label: 'Test de resolution', enabled: true, summary: '', details: '' },
  { eventType: 'handover', label: 'Remise client', enabled: true, summary: '', details: '' },
  { eventType: 'other', label: 'Autre', enabled: false, summary: '', details: '' },
  { eventType: 'commande_modification_prerequis', label: 'Modification commande (prerequis)', enabled: true, summary: '', details: '' },
];

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Modeles de suivi ticket', href: '/settings/ticket-timeline-templates' },
];

export default function TicketTimelineTemplatesSettings({
  settings,
  canManage,
}: {
  settings: TemplateSettings;
  canManage: boolean;
}) {
  const [templates, setTemplates] = useState<TemplateItem[]>(settings?.templates?.length ? settings.templates : defaultTemplates);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTemplates(settings?.templates?.length ? settings.templates : defaultTemplates);
  }, [settings]);

  const payload = useMemo(() => {
    return {
      templates: templates.map((template) => ({
        eventType: template.eventType,
        label: template.label,
        enabled: Boolean(template.enabled),
        summary: template.summary ?? '',
        details: template.details ?? '',
      })),
    };
  }, [templates]);

  const updateTemplate = (eventType: string, patch: Partial<TemplateItem>) => {
    setTemplates((current) =>
      current.map((template) =>
        template.eventType === eventType ? { ...template, ...patch } : template,
      ),
    );
  };

  const slugifyEventType = (value: string): string => {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  };

  const makeUniqueEventType = (base: string): string => {
    const existing = new Set(templates.map((template) => template.eventType));
    if (!existing.has(base)) {
      return base;
    }

    let suffix = 2;
    while (suffix < 999) {
      const candidate = `${base}_${suffix}`.slice(0, 60);
      if (!existing.has(candidate)) {
        return candidate;
      }

      suffix += 1;
    }

    return `${base}_${Date.now().toString().slice(-3)}`;
  };

  const handleAddTemplate = () => {
    const baseLabel = 'Nouveau pre-remplissage';
    const newEventType = makeUniqueEventType(slugifyEventType(baseLabel) || 'prefill');

    setTemplates((current) => [
      ...current,
      {
        eventType: newEventType,
        label: baseLabel,
        enabled: true,
        summary: '',
        details: '',
      },
    ]);
  };

  const handleRemoveTemplate = (eventType: string) => {
    setTemplates((current) => current.filter((template) => template.eventType !== eventType));
  };

  const handleLabelChange = (eventType: string, label: string) => {
    const normalizedLabel = label.slice(0, 80);
    updateTemplate(eventType, { label: normalizedLabel });

    if (baseEventTypes.includes(eventType)) {
      return;
    }

    const slug = slugifyEventType(normalizedLabel);
    if (!slug) {
      return;
    }

    setTemplates((current) => {
      const existing = new Set(current.map((template) => template.eventType));
      existing.delete(eventType);

      let candidate = slug;
      let suffix = 2;
      while (existing.has(candidate)) {
        candidate = `${slug}_${suffix}`.slice(0, 60);
        suffix += 1;
      }

      return current.map((template) =>
        template.eventType === eventType
          ? { ...template, label: normalizedLabel, eventType: candidate }
          : template,
      );
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      return;
    }

    router.put('/settings/ticket-timeline-templates', payload, {
      preserveScroll: true,
      onSuccess: () => {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
      },
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Modeles de suivi ticket" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Messages predefinis de suivi"
            description="Configurez des textes pre-remplis par type d'evenement pour accelerer la saisie des techniciens."
          />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Modeles par type d'evenement</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={handleAddTemplate} disabled={!canManage}>
                  <Plus className="h-4 w-4 mr-1" />
                  Creer un pre-remplissage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                {templates.map((template) => (
                  <div key={template.eventType} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{template.label || eventTypeLabel[template.eventType] || template.eventType}</div>
                      <div className="flex items-center gap-2">
                        {!baseEventTypes.includes(template.eventType) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveTemplate(template.eventType)}
                            disabled={!canManage}
                            className="h-8 px-2 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Checkbox
                          id={`enabled-${template.eventType}`}
                          checked={template.enabled}
                          onCheckedChange={(value) => updateTemplate(template.eventType, { enabled: Boolean(value) })}
                          disabled={!canManage}
                        />
                        <Label htmlFor={`enabled-${template.eventType}`}>Activer pre-remplissage</Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`label-${template.eventType}`}>Nom du pre-remplissage</Label>
                      <Input
                        id={`label-${template.eventType}`}
                        value={template.label}
                        onChange={(e) => handleLabelChange(template.eventType, e.target.value)}
                        maxLength={80}
                        disabled={!canManage}
                        placeholder="Ex: Validation client par telephone"
                      />
                      <p className="text-xs text-muted-foreground">Type technique: {template.eventType}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`summary-${template.eventType}`}>Resume predefini</Label>
                      <Input
                        id={`summary-${template.eventType}`}
                        value={template.summary}
                        onChange={(e) => updateTemplate(template.eventType, { summary: e.target.value })}
                        maxLength={500}
                        disabled={!canManage}
                        placeholder="Ex: Diagnostic termine, attente validation client"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`details-${template.eventType}`}>Details predefinis</Label>
                      <Textarea
                        id={`details-${template.eventType}`}
                        value={template.details}
                        onChange={(e) => updateTemplate(template.eventType, { details: e.target.value })}
                        rows={3}
                        maxLength={3000}
                        disabled={!canManage}
                        placeholder="Texte ajoute automatiquement quand ce type est selectionne."
                      />
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={!canManage}>Enregistrer</Button>
                  {saved && <span className="text-sm text-primary">Enregistre</span>}
                </div>

                {!canManage && (
                  <p className="text-sm text-muted-foreground">
                    Seuls les administrateurs peuvent modifier ces modeles.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}
