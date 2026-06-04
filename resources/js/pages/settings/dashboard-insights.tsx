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

type InsightSettings = {
  ticket_pending_hours: number;
  ticket_pending_hours_by_priority: {
    high: number;
    medium: number;
    low: number;
  };
  ticket_low_info_hours: number;
  ticket_low_info_hours_by_priority: {
    high: number;
    medium: number;
    low: number;
  };
  ticket_stalled_days: number;
  ticket_stalled_days_by_priority: {
    high: number;
    medium: number;
    low: number;
  };
  commande_incomplete_hours: number;
  commande_stalled_days: number;
  max_items_per_rule: number;
  recent_tickets_limit: number;
};

type TicketPriority = 'high' | 'medium' | 'low';

const priorityLabels: Record<TicketPriority, string> = {
  high: 'Priorité haute',
  medium: 'Priorité moyenne',
  low: 'Priorité basse',
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Réglages dashboard', href: '/settings/dashboard-insights' },
];

export default function DashboardInsightsSettings({
  settings,
  defaults,
  canManage,
}: {
  settings: InsightSettings;
  defaults: InsightSettings;
  canManage: boolean;
}) {
  const [form, setForm] = useState<InsightSettings>(settings);
  const [saved, setSaved] = useState(false);

  const priorityRows = useMemo(
    () => [
      {
        key: 'ticket_pending_hours_by_priority' as const,
        title: 'Ticket en attente: délai avant relance critique (heures)',
        hint: 'Permet de déclencher plus vite les relances sur les tickets prioritaires.',
        min: 1,
      },
      {
        key: 'ticket_low_info_hours_by_priority' as const,
        title: 'Ticket actif sans nouvelles: délai d\'attention (heures)',
        hint: 'Définit quand un ticket manque d\'informations selon sa priorité.',
        min: 1,
      },
      {
        key: 'ticket_stalled_days_by_priority' as const,
        title: 'Ticket actif à réévaluer: délai d\'inactivité (jours)',
        hint: 'Déclenche une action de réévaluation plus tôt sur les tickets critiques.',
        min: 1,
      },
    ],
    [],
  );

  const rows = useMemo(
    () => [
      {
        key: 'ticket_pending_hours' as const,
        label: 'Fallback ticket en attente (heures)',
        hint: 'Utilisé si la priorité du ticket est absente ou inconnue.',
      },
      {
        key: 'ticket_low_info_hours' as const,
        label: 'Fallback ticket actif sans nouvelles (heures)',
        hint: 'Utilisé si la priorité du ticket est absente ou inconnue.',
      },
      {
        key: 'ticket_stalled_days' as const,
        label: 'Fallback ticket actif à réévaluer (jours)',
        hint: 'Utilisé si la priorité du ticket est absente ou inconnue.',
      },
      {
        key: 'commande_incomplete_hours' as const,
        label: 'Délai max pour commande incomplète (heures)',
        hint: 'Déclenche une alerte si fournisseur ou numéro de commande manquent trop longtemps.',
      },
      {
        key: 'commande_stalled_days' as const,
        label: 'Délai avant commande sans suivi (jours)',
        hint: 'Déclenche une alerte si une commande au statut "new" ou "panier" reste inactive.',
      },
      {
        key: 'max_items_per_rule' as const,
        label: 'Nombre max d\'actions par règle',
        hint: 'Limite le nombre de suggestions affichées pour chaque règle.',
      },
      {
        key: 'recent_tickets_limit' as const,
        label: 'Nombre de tickets récents affichés',
        hint: 'Nombre maximum affiché dans le bloc "Derniers tickets".',
      },
    ],
    [],
  );

  const updatePriorityThreshold = (
    key: 'ticket_pending_hours_by_priority' | 'ticket_low_info_hours_by_priority' | 'ticket_stalled_days_by_priority',
    priority: TicketPriority,
    value: number,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [priority]: value,
      },
    }));
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;

    router.put('/settings/dashboard-insights', form, {
      preserveScroll: true,
      onSuccess: () => {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
      },
    });
  };

  const resetDefaults = () => setForm(defaults);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Réglages dashboard" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Règles d'aide à l'action du dashboard"
            description="Ajustez ici les seuils qui déterminent les alertes et les suggestions automatiques sur les tickets et commandes."
          />

          <Card>
            <CardHeader>
              <CardTitle>Seuils de déclenchement</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Seuils par priorité des tickets</h3>
                  {priorityRows.map((row) => (
                    <div key={row.key} className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-sm font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">{row.hint}</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(['high', 'medium', 'low'] as TicketPriority[]).map((priority) => (
                          <div key={`${row.key}-${priority}`} className="space-y-1">
                            <Label htmlFor={`${row.key}-${priority}`}>{priorityLabels[priority]}</Label>
                            <Input
                              id={`${row.key}-${priority}`}
                              type="number"
                              min={row.min}
                              value={String(form[row.key][priority])}
                              onChange={(e) => updatePriorityThreshold(row.key, priority, Number(e.target.value || 0))}
                              disabled={!canManage}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-1">
                  <h3 className="text-sm font-semibold">Seuils fallback et commandes</h3>
                  <p className="text-xs text-muted-foreground">Ces valeurs servent de secours si un ticket n\'a pas de priorité reconnue.</p>
                </div>

                {rows.map((row) => (
                  <div key={row.key} className="space-y-1">
                    <Label htmlFor={row.key}>{row.label}</Label>
                    <Input
                      id={row.key}
                      type="number"
                      min={1}
                      value={String(form[row.key])}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          [row.key]: Number(e.target.value || 0),
                        }))
                      }
                      disabled={!canManage}
                    />
                    <p className="text-xs text-muted-foreground">{row.hint}</p>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="submit" disabled={!canManage}>Enregistrer</Button>
                  <Button type="button" variant="outline" onClick={resetDefaults} disabled={!canManage}>Réinitialiser avec les valeurs par défaut</Button>
                  {saved && <span className="text-sm text-muted-foreground">Réglages enregistrés.</span>}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variables d'environnement associées</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>DASHBOARD_TICKET_PENDING_HOURS</p>
              <p>DASHBOARD_TICKET_LOW_INFO_HOURS</p>
              <p>DASHBOARD_TICKET_STALLED_DAYS</p>
              <p>DASHBOARD_COMMANDE_INCOMPLETE_HOURS</p>
              <p>DASHBOARD_COMMANDE_STALLED_DAYS</p>
              <p>DASHBOARD_MAX_ITEMS_PER_RULE</p>
              <p>DASHBOARD_RECENT_TICKETS_LIMIT</p>
              <p className="pt-1">Ces variables servent de valeurs par défaut (fallback). Les seuils par priorité sont ensuite personnalisables dans ce formulaire.</p>
            </CardContent>
          </Card>
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}
