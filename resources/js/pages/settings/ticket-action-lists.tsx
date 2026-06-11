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
import { type BreadcrumbItem } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

type ActionList = {
  key: string;
  label: string;
  tasks: string[];
};

type ActionListSettings = {
  lists: ActionList[];
};

const defaultLists: ActionList[] = [
  {
    key: 'diagnostic_standard',
    label: 'Diagnostic standard',
    tasks: ['Verifier alimentation et demarrage', 'Verifier etat disque et SMART', 'Documenter la cause probable'],
  },
];

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Listes actions predefinies', href: '/settings/ticket-action-lists' },
];

export default function TicketActionListsSettings({
  settings,
  canManage,
}: {
  settings: ActionListSettings;
  canManage: boolean;
}) {
  const [lists, setLists] = useState<ActionList[]>(settings?.lists?.length ? settings.lists : defaultLists);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLists(settings?.lists?.length ? settings.lists : defaultLists);
  }, [settings]);

  const payload = useMemo(() => {
    return {
      lists: lists.map((list) => ({
        key: list.key,
        label: list.label,
        tasks: (list.tasks ?? []).filter((task) => task.trim() !== '').slice(0, 30),
      })),
    };
  }, [lists]);

  const slugifyKey = (value: string): string => {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  };

  const makeUniqueKey = (base: string): string => {
    const existing = new Set(lists.map((list) => list.key));
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

  const updateList = (key: string, patch: Partial<ActionList>) => {
    setLists((current) => current.map((list) => (list.key === key ? { ...list, ...patch } : list)));
  };

  const handleAddList = () => {
    const baseLabel = 'Nouvelle liste actions';
    const newKey = makeUniqueKey(slugifyKey(baseLabel) || 'liste_actions');

    setLists((current) => [
      ...current,
      {
        key: newKey,
        label: baseLabel,
        tasks: [''],
      },
    ]);
  };

  const handleRemoveList = (key: string) => {
    setLists((current) => current.filter((list) => list.key !== key));
  };

  const handleLabelChange = (key: string, label: string) => {
    const normalizedLabel = label.slice(0, 80);
    updateList(key, { label: normalizedLabel });

    const slug = slugifyKey(normalizedLabel);
    if (!slug) {
      return;
    }

    setLists((current) => {
      const existing = new Set(current.map((list) => list.key));
      existing.delete(key);

      let candidate = slug;
      let suffix = 2;
      while (existing.has(candidate)) {
        candidate = `${slug}_${suffix}`.slice(0, 60);
        suffix += 1;
      }

      return current.map((list) =>
        list.key === key
          ? { ...list, label: normalizedLabel, key: candidate }
          : list,
      );
    });
  };

  const updateListTasks = (key: string, value: string) => {
    const tasks = value
      .split('\n')
      .map((task) => task.trim())
      .filter((task) => task !== '')
      .slice(0, 30);

    updateList(key, { tasks });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      return;
    }

    router.put('/settings/ticket-action-lists', payload, {
      preserveScroll: true,
      onSuccess: () => {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
      },
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Listes actions predefinies" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Listes d'actions predefinies"
            description="Configurez les listes d'actions reutilisables dans la fenetre d'ajout d'evenement de suivi."
          />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Listes disponibles</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={handleAddList} disabled={!canManage}>
                  <Plus className="h-4 w-4 mr-1" />
                  Creer une liste
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                {lists.map((list) => (
                  <div key={list.key} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{list.label || list.key}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveList(list.key)}
                        disabled={!canManage || lists.length <= 1}
                        className="h-8 px-2 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`label-${list.key}`}>Nom de la liste</Label>
                      <Input
                        id={`label-${list.key}`}
                        value={list.label}
                        onChange={(e) => handleLabelChange(list.key, e.target.value)}
                        maxLength={80}
                        disabled={!canManage}
                        placeholder="Ex: Verification avant remise"
                      />
                      <p className="text-xs text-muted-foreground">Cle technique: {list.key}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`tasks-${list.key}`}>Actions (une ligne = une action)</Label>
                      <Textarea
                        id={`tasks-${list.key}`}
                        value={(list.tasks ?? []).join('\n')}
                        onChange={(e) => updateListTasks(list.key, e.target.value)}
                        rows={6}
                        maxLength={5400}
                        disabled={!canManage}
                        placeholder="Ex: Valider les tests finaux\nInformer le client\nConfirmer la remise"
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
                    Seuls les administrateurs peuvent modifier ces listes.
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
