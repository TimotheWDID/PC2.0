import { Head, Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type BreadcrumbItem } from '@/types';
import { formatDateFr } from '@/lib/datetime';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Devis', href: '/devis' }];

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  to_validate: 'À valider',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
};

const statusVariants: Record<string, 'secondary' | 'outline' | 'default' | 'destructive'> = {
  draft: 'secondary',
  to_validate: 'outline',
  sent: 'default',
  accepted: 'default',
  refused: 'destructive',
  expired: 'destructive',
};

type Devis = {
  id: number;
  title: string;
  status: string;
  pdf_original_name?: string | null;
  created_at: string;
  user?: { id: number; name?: string; first_name?: string; last_name?: string; email?: string | null } | null;
  ticket?: { id: number; title: string; status: string } | null;
};

const userName = (user: Devis['user']) => user?.name || `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.email || 'Client inconnu';

export default function Index({ devis }: { devis: Devis[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(() => (devis ?? []).filter((item) => {
    const haystack = `${item.id} ${item.title} ${userName(item.user)} ${item.ticket?.title ?? ''}`.toLowerCase();
    return (status === 'all' || item.status === status) && haystack.includes(query.toLowerCase());
  }), [devis, query, status]);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Devis" />
      <div className="space-y-6 py-2 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Heading title="Devis" description="Suivi commercial des demandes de devis" />
          <Link href="/devis/create"><Button><Plus className="mr-2 h-4 w-4" />Nouveau devis</Button></Link>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{filtered.length} devis</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher titre, client, ticket..." />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">Tous les statuts</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y sm:hidden">
              {filtered.map((item) => (
                <Link key={item.id} href={`/devis/${item.id}`} className="block space-y-2 p-4 hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-3"><p className="font-medium">#{item.id} - {item.title}</p><Badge variant={statusVariants[item.status] ?? 'outline'}>{statusLabels[item.status] ?? item.status}</Badge></div>
                  <p className="text-sm text-muted-foreground">{userName(item.user)}</p>
                  <p className="text-xs text-muted-foreground">{item.ticket ? `Ticket #${item.ticket.id}` : 'Aucun ticket'} · {formatDateFr(item.created_at, { timeZone: 'Europe/Paris' })}</p>
                </Link>
              ))}
              {!filtered.length && <p className="p-8 text-center text-sm text-muted-foreground">Aucun devis trouvé.</p>}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm"><thead className="border-b bg-muted/40"><tr><th className="px-4 py-3 text-left">ID</th><th className="px-4 py-3 text-left">Titre</th><th className="px-4 py-3 text-left">Client</th><th className="px-4 py-3 text-left">Ticket</th><th className="px-4 py-3 text-left">Statut</th><th className="px-4 py-3 text-left">Créé le</th></tr></thead>
                <tbody>{filtered.map((item) => <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30"><td className="px-4 py-3">#{item.id}</td><td className="px-4 py-3"><Link href={`/devis/${item.id}`} className="flex items-center gap-2 font-medium hover:underline"><FileText className="h-4 w-4 text-muted-foreground" />{item.title}</Link></td><td className="px-4 py-3">{userName(item.user)}</td><td className="px-4 py-3">{item.ticket ? <Link href={`/tickets/${item.ticket.id}`} className="hover:underline">#{item.ticket.id}</Link> : '-'}</td><td className="px-4 py-3"><Badge variant={statusVariants[item.status] ?? 'outline'}>{statusLabels[item.status] ?? item.status}</Badge></td><td className="px-4 py-3">{formatDateFr(item.created_at, { timeZone: 'Europe/Paris' })}</td></tr>)}</tbody></table>
              {!filtered.length && <p className="p-8 text-center text-sm text-muted-foreground">Aucun devis trouvé.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
