import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type DebugDefaults = {
  to: string;
  subject: string;
  message: string;
  from_address: string;
  from_name: string;
  reply_to: string;
  as_html: boolean;
  mailer: string;
};

type DebugResult = {
  ok: boolean;
  mailer: string;
  to: string;
  subject: string;
  from_address: string | null;
  from_name: string | null;
  reply_to: string | null;
  as_html: boolean;
  message: string;
  error: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Debug Mail',
    href: '/settings/mail-debug',
  },
];

export default function MailDebug({ defaults, result }: { defaults: DebugDefaults; result: DebugResult | null }) {
  const { data, setData, post, processing, errors } = useForm({
    to: defaults.to,
    subject: defaults.subject,
    message: defaults.message,
    from_address: defaults.from_address,
    from_name: defaults.from_name,
    reply_to: defaults.reply_to,
    as_html: defaults.as_html,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    post('/settings/mail-debug', {
      preserveScroll: true,
      preserveState: true,
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Debug Mail" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Test mail"
            description="Envoie un email de test avec le mailer configuré et affiche le résultat de l'envoi."
          />

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Paramètres du mail</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="to">Destinataire</Label>
                    <Input id="to" type="email" value={data.to} onChange={(event) => setData('to', event.target.value)} placeholder="client@exemple.com" />
                    <InputError message={errors.to} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="subject">Sujet</Label>
                    <Input id="subject" value={data.subject} onChange={(event) => setData('subject', event.target.value)} placeholder="Test mail SupportPC" />
                    <InputError message={errors.subject} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" rows={6} value={data.message} onChange={(event) => setData('message', event.target.value)} />
                  <InputError message={errors.message} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="from_address">Adresse expéditeur</Label>
                    <Input id="from_address" type="email" value={data.from_address} onChange={(event) => setData('from_address', event.target.value)} placeholder="noreply@votredomaine.tld" />
                    <InputError message={errors.from_address} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="from_name">Nom expéditeur</Label>
                    <Input id="from_name" value={data.from_name} onChange={(event) => setData('from_name', event.target.value)} placeholder="SupportPC" />
                    <InputError message={errors.from_name} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="reply_to">Reply-To</Label>
                    <Input id="reply_to" type="email" value={data.reply_to} onChange={(event) => setData('reply_to', event.target.value)} placeholder="support@votredomaine.tld" />
                    <InputError message={errors.reply_to} />
                  </div>

                  <div className="flex items-end gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                    <input id="as_html" type="checkbox" checked={data.as_html} onChange={(event) => setData('as_html', event.target.checked)} className="h-4 w-4 rounded border-input" />
                    <Label htmlFor="as_html" className="cursor-pointer">Envoyer en HTML</Label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={processing}>Envoyer le mail de test</Button>
                  <p className="text-sm text-muted-foreground">Mailer actif: {defaults.mailer}</p>
                </div>
              </form>
            </CardContent>
          </Card>

          {result && (
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>Résultat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <ResultPill label="Statut" value={result.ok ? 'OK' : 'Erreur'} />
                  <ResultPill label="Mailer" value={result.mailer} />
                  <ResultPill label="Format" value={result.as_html ? 'HTML' : 'Texte'} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ResultPill label="Destinataire" value={result.to} />
                  <ResultPill label="Sujet" value={result.subject} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ResultPill label="From" value={`${result.from_name ?? ''} <${result.from_address ?? ''}>`} />
                  <ResultPill label="Reply-To" value={result.reply_to ?? 'n/a'} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Message</p>
                  <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/30 p-4 text-xs whitespace-pre-wrap">{result.message}</pre>
                </div>

                {result.error && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">Erreur</p>
                    <pre className="overflow-x-auto rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs whitespace-pre-wrap text-destructive">{result.error}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}

function ResultPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
