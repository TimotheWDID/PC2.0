import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, ExternalLink, FileText, MessageSquare, RefreshCw, Save, Upload, Wrench } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/heading';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { type BreadcrumbItem } from '@/types';
import { formatDateFr } from '@/lib/datetime';

type StatusMeta = { label: string; badge: 'secondary' | 'outline' | 'default' | 'destructive'; dot: string };

const STATUS_META: Record<string, StatusMeta> = {
  draft: { label: 'Brouillon', badge: 'secondary', dot: 'bg-muted-foreground' },
  to_validate: { label: 'À valider', badge: 'outline', dot: 'bg-amber-500' },
  sent: { label: 'Envoyé', badge: 'default', dot: 'bg-blue-500' },
  accepted: { label: 'Accepté', badge: 'default', dot: 'bg-emerald-500' },
  refused: { label: 'Refusé', badge: 'destructive', dot: 'bg-destructive' },
  expired: { label: 'Expiré', badge: 'destructive', dot: 'bg-destructive' },
};

type DevisMessage = {
  id: number;
  body: string;
  created_at: string;
  user: { id: number; name?: string; first_name?: string; last_name?: string };
};

type Agent = { id: number; first_name?: string; last_name?: string };

type Devis = {
  id: number;
  title: string;
  status: string;
  notes?: string | null;
  pdf_path?: string | null;
  pdf_original_name?: string | null;
  hiboutik_id?: string | null;
  accepted_at?: string | null;
  created_at: string;
  user: { id: number; name?: string; first_name?: string; last_name?: string; email?: string | null; phone?: string | null };
  ticket?: { id: number; title: string; status: string; hiboutik_quote_number?: string | null } | null;
  messages: DevisMessage[];
};

const name = (user: Devis['user'] | DevisMessage['user']) =>
  user.name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || `Utilisateur #${user.id}`;

const initials = (user: Devis['user'] | DevisMessage['user']) => {
  const fromParts = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`;
  return (fromParts || name(user).slice(0, 2)).toUpperCase();
};

const mentionAlias = (agent: Agent) => `${agent.first_name ?? ''}${agent.last_name ?? ''}`.replace(/[^a-zA-Z0-9À-ÿ]/g, '').toLowerCase();

export default function Show({ devis, agents }: { devis: Devis; agents: Agent[] }) {
  const [status, setStatus] = useState(devis.status);
  const [previewOpen, setPreviewOpen] = useState(Boolean(devis.pdf_path));
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const noteForm = useForm({ status: devis.status, hiboutik_id: devis.hiboutik_id ?? '', notes: devis.notes ?? '' });
  const messageForm = useForm({ body: '' });
  const pdfForm = useForm<{ pdf: File | null }>({ pdf: null });
  const breadcrumbs: BreadcrumbItem[] = [{ title: 'Devis', href: '/devis' }, { title: devis.title, href: `/devis/${devis.id}` }];

  const saveNotes = (event: FormEvent) => {
    event.preventDefault();
    noteForm.patch(`/devis/${devis.id}`, { preserveScroll: true });
  };

  const updateStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    noteForm.setData('status', nextStatus);
    router.patch(
      `/devis/${devis.id}`,
      { status: nextStatus, hiboutik_id: noteForm.data.hiboutik_id, notes: noteForm.data.notes },
      { preserveScroll: true },
    );
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    messageForm.post(`/devis/${devis.id}/messages`, { preserveScroll: true, onSuccess: () => messageForm.reset() });
  };

  const handleMessageChange = (value: string) => {
    messageForm.setData('body', value);
    const match = value.match(/@([\p{L}\p{N}]*)$/u);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  };

  const insertMention = (agent: Agent) => {
    const alias = mentionAlias(agent);
    const body = messageForm.data.body.replace(/@[\p{L}\p{N}]*$/u, `@${alias} `);
    messageForm.setData('body', body);
    setMentionQuery(null);
  };

  const mentionSuggestions =
    mentionQuery === null ? [] : agents.filter((agent) => mentionAlias(agent).startsWith(mentionQuery)).slice(0, 6);

  const accept = () => {
    if (!confirm('Accepter ce devis et créer ou lier la réparation ?')) return;
    router.post(`/devis/${devis.id}/accept`, { hiboutik_id: noteForm.data.hiboutik_id }, { preserveScroll: true });
  };

  const uploadPdf = (event: FormEvent) => {
    event.preventDefault();
    pdfForm.post(`/devis/${devis.id}/pdf`, { forceFormData: true, preserveScroll: true, onSuccess: () => pdfForm.reset() });
  };

  const statusMeta = STATUS_META[status] ?? { label: status, badge: 'outline' as const, dot: 'bg-muted-foreground' };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={devis.title} />
      <div className="space-y-6 py-2 sm:py-4">
        <Heading title={devis.title} description={`Devis #${devis.id}`} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Badge variant={statusMeta.badge} className="gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </Badge>
            <span>
              <span className="text-muted-foreground">Client </span>
              <Link href={`/users/${devis.user.id}/show`} className="font-medium hover:underline">
                {name(devis.user)}
              </Link>
            </span>
            <span className="text-muted-foreground">Créé le {formatDateFr(devis.created_at, { timeZone: 'Europe/Paris' })}</span>
          </div>
          <Link href="/devis">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la liste
            </Button>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Détails du devis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="devis-status">Statut</Label>
                    <Select value={status} onValueChange={updateStatus}>
                      <SelectTrigger id="devis-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_META).map(([value, meta]) => (
                          <SelectItem key={value} value={value}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hiboutik-quote-number">N° de devis Hiboutik</Label>
                    <Input
                      id="hiboutik-quote-number"
                      value={noteForm.data.hiboutik_id}
                      onChange={(event) => noteForm.setData('hiboutik_id', event.target.value)}
                      placeholder="Ex. DV-2026-0042"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le numéro Hiboutik est synchronisé dans le ticket lié lors de l’acceptation ou d’une resynchronisation.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes commerciales et techniques</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveNotes} className="space-y-3">
                  <Textarea
                    id="devis-notes"
                    value={noteForm.data.notes}
                    onChange={(event) => noteForm.setData('notes', event.target.value)}
                    rows={6}
                    placeholder="Contexte client, décisions, informations à transmettre au technicien..."
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Ces notes sont visibles par les agents autorisés.</p>
                    <Button type="submit" size="sm" disabled={noteForm.processing}>
                      {noteForm.processing ? <Spinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Échanges entre agents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                  {devis.messages?.length ? (
                    devis.messages.map((message) => (
                      <div key={message.id} className="flex gap-3">
                        <Avatar className="mt-0.5">
                          <AvatarFallback className="text-xs font-medium">{initials(message.user)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 rounded-lg border bg-muted/20 p-3">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{name(message.user)}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateFr(message.created_at, { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Aucun message. Utilisez cet espace pour transmettre une information au reste de l’équipe.
                    </p>
                  )}
                </div>
                <form onSubmit={sendMessage} className="space-y-2 border-t pt-4">
                  <div className="relative">
                    {mentionSuggestions.length > 0 && (
                      <div className="absolute inset-x-0 bottom-full z-10 mb-1 max-h-52 overflow-y-auto rounded-md border bg-background p-1 shadow-lg">
                        {mentionSuggestions.map((agent) => (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => insertMention(agent)}
                            className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            @{mentionAlias(agent)}{' '}
                            <span className="text-muted-foreground">{`${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <Textarea
                      value={messageForm.data.body}
                      onChange={(event) => handleMessageChange(event.target.value)}
                      rows={3}
                      placeholder="Écrire un message pour l’équipe... Utilisez @prenomnom pour notifier un agent."
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={messageForm.processing || !messageForm.data.body.trim()}>
                      {messageForm.processing && <Spinner className="mr-2" />}
                      Envoyer
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Réparation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {devis.ticket ? (
                  <>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-sm font-medium">Ticket #{devis.ticket.id}</p>
                      <p className="text-sm text-muted-foreground">{devis.ticket.title}</p>
                      {devis.ticket.hiboutik_quote_number && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          N° devis dans le ticket : <span className="font-medium text-foreground">{devis.ticket.hiboutik_quote_number}</span>
                        </p>
                      )}
                    </div>
                    <Link href={`/tickets/${devis.ticket.id}`}>
                      <Button variant="outline" className="w-full">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ouvrir le ticket
                      </Button>
                    </Link>
                    <Button onClick={accept} variant="secondary" className="w-full">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Synchroniser le numéro dans le ticket
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Aucune réparation liée pour l’instant.</p>
                    <Button onClick={accept} className="w-full">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {status === 'accepted' ? 'Créer et synchroniser la réparation' : 'Accepter et créer la réparation'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document du devis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {devis.pdf_path ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant={previewOpen ? 'default' : 'outline'} onClick={() => setPreviewOpen((open) => !open)}>
                        <FileText className="mr-2 h-4 w-4" />
                        {previewOpen ? 'Masquer l’aperçu' : 'Prévisualiser'}
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/devis/${devis.id}/download`}>
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </a>
                      </Button>
                    </div>
                    {devis.pdf_original_name && <p className="truncate text-xs text-muted-foreground">{devis.pdf_original_name}</p>}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-6 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Aucun PDF importé</p>
                  </div>
                )}
                <form onSubmit={uploadPdf} className="space-y-2 border-t pt-4">
                  <Label htmlFor="devis-pdf">{devis.pdf_path ? 'Remplacer le PDF' : 'Ajouter le PDF'}</Label>
                  <Input
                    id="devis-pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => pdfForm.setData('pdf', event.target.files?.[0] ?? null)}
                  />
                  {pdfForm.errors.pdf && <p className="text-sm text-destructive">{pdfForm.errors.pdf}</p>}
                  <Button type="submit" size="sm" className="w-full" disabled={pdfForm.processing || !pdfForm.data.pdf}>
                    {pdfForm.processing ? <Spinner className="mr-2" /> : <Upload className="mr-2 h-4 w-4" />}
                    Importer
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground">PDF uniquement, 20 Mo maximum. Un nouveau fichier remplace l’ancien.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {previewOpen && devis.pdf_path && (
          <Card>
            <CardHeader>
              <CardTitle>Aperçu du PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe
                title="Aperçu du devis PDF"
                src={`/devis/${devis.id}/preview`}
                className="h-[min(76vh,58rem)] min-h-[34rem] w-full rounded-md border bg-muted/20"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
