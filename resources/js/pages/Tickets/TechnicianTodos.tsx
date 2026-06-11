import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/heading';
import MobileNativeNav from '@/components/mobile-native-nav';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { formatDateTimeFr } from '@/lib/datetime';
import { Loader2 } from 'lucide-react';

type TodoRow = {
  ticket: {
    id: number;
    title: string | null;
    status: string | null;
    priority: string | null;
    assignee_name: string | null;
  };
  event: {
    id: number;
    summary: string | null;
    happened_at: string | null;
    technician_name: string | null;
  };
  action: {
    index: number;
    id: string;
    label: string;
  };
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets', href: '/tickets' },
  { title: 'To-do technicien', href: '/tickets/technician-todos' },
];

const translateStatus = (status: string | null): string => {
  const translations: Record<string, string> = {
    open: 'Ouvert',
    in_progress: 'En cours',
    pending: 'En attente',
    resolved: 'Resolu',
    closed: 'Ferme',
  };

  if (!status) {
    return '-';
  }

  return translations[status] || status;
};

const translatePriority = (priority: string | null): string => {
  const translations: Record<string, string> = {
    low: 'Basse',
    medium: 'Moyenne',
    high: 'Haute',
  };

  if (!priority) {
    return '-';
  }

  return translations[priority] || priority;
};

export default function TechnicianTodos({ todoRows }: { todoRows: TodoRow[] }) {
  const [query, setQuery] = useState('');
  const [pendingActions, setPendingActions] = useState<string[]>([]);
  const [locallyCompletedActions, setLocallyCompletedActions] = useState<string[]>([]);

  const getActionKey = (row: TodoRow): string => `${row.ticket.id}:${row.event.id}:${row.action.index}`;

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return todoRows;
    }

    return todoRows.filter((row) => {
      const text = [
        String(row.ticket.id),
        row.ticket.title,
        row.ticket.assignee_name,
        row.event.summary,
        row.event.technician_name,
        row.action.label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [query, todoRows]);

  const groupedByTicket = useMemo(() => {
    const groups = new Map<number, TodoRow[]>();

    filteredRows.forEach((row) => {
      const current = groups.get(row.ticket.id) ?? [];
      current.push(row);
      groups.set(row.ticket.id, current);
    });

    return Array.from(groups.entries()).map(([ticketId, rows]) => ({
      ticketId,
      ticket: rows[0].ticket,
      rows,
    }));
  }, [filteredRows]);

  const completeAction = (row: TodoRow) => {
    const actionKey = getActionKey(row);

    if (pendingActions.includes(actionKey) || locallyCompletedActions.includes(actionKey)) {
      return;
    }

    setPendingActions((current) => [...current, actionKey]);
    setLocallyCompletedActions((current) => [...current, actionKey]);

    router.post(
      `/tickets/${row.ticket.id}/timeline-events/${row.event.id}/actions`,
      {
        _method: 'patch',
        action_index: row.action.index,
        done: true,
      },
      {
        preserveScroll: true,
        onError: () => {
          setLocallyCompletedActions((current) => current.filter((key) => key !== actionKey));
        },
        onFinish: () => {
          setPendingActions((current) => current.filter((key) => key !== actionKey));
        },
      },
    );
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="To-do technicien" />
      <div className="space-y-4 py-2 sm:py-4">
        <Heading
          title="To-do technicien"
          description="Vue centrale des actions de suivi non realisees sur les tickets actifs."
        />

        <Card>
          <CardHeader>
            <CardTitle>Actions a faire ({filteredRows.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher: ticket, assigne, action, evenement..."
            />

            {groupedByTicket.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune action en attente.</p>
            ) : (
              <div className="space-y-3">
                {groupedByTicket.map((group) => (
                  <div key={`todo-ticket-${group.ticketId}`} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">
                          <Link href={`/tickets/${group.ticket.id}`} className="link-readable">
                            #{group.ticket.id} - {group.ticket.title || 'Sans titre'}
                          </Link>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Assigne: {group.ticket.assignee_name || 'Non assigne'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{translateStatus(group.ticket.status)}</Badge>
                        <Badge variant="outline">{translatePriority(group.ticket.priority)}</Badge>
                        <Badge variant="secondary">{group.rows.length} action(s)</Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {group.rows.map((row, index) => {
                        const actionKey = getActionKey(row);
                        const isPending = pendingActions.includes(actionKey);
                        const isChecked = locallyCompletedActions.includes(actionKey);

                        return (
                        <div key={`todo-row-${group.ticketId}-${index}`} className="rounded-md border bg-muted/20 px-2 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isPending ? (
                                <span className="inline-flex h-4 w-4 items-center justify-center text-primary" aria-hidden="true">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                </span>
                              ) : (
                                <Checkbox
                                  checked={isChecked}
                                  disabled={isPending}
                                  onCheckedChange={() => completeAction(row)}
                                  id={`todo-check-${group.ticketId}-${row.event.id}-${row.action.index}`}
                                />
                              )}
                              <p className="text-sm">{row.action.label}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => completeAction(row)} disabled={isPending || isChecked}>
                              {isPending ? 'Validation...' : isChecked ? 'Fait' : 'Marquer fait'}
                            </Button>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Depuis: {row.event.summary || 'Evenement sans resume'} · {row.event.technician_name || 'Technicien'} · {formatDateTimeFr(row.event.happened_at)}
                          </p>
                        </div>
                      )})}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}
