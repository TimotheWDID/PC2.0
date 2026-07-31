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
  message: string;
  sender: string;
  base_url: string;
  send_path: string;
  api_key: string;
  auth_header: string;
  auth_prefix: string;
  verify_ssl: boolean;
};

type DebugResult = {
  ok: boolean;
  http_status: number | null;
  api_code: number | string | null;
  body: string | null;
  decoded: Record<string, unknown> | null;
  url: string;
  request: Record<string, unknown> | null;
};

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Debug SMS',
    href: '/settings/sms-debug',
  },
];

export default function SmsDebug({ defaults, result }: { defaults: DebugDefaults; result: DebugResult | null }) {
  const { data, setData, post, processing, errors } = useForm({
    to: defaults.to,
    message: defaults.message,
    sender: defaults.sender,
    base_url: defaults.base_url,
    send_path: defaults.send_path,
    api_key: defaults.api_key,
    auth_header: defaults.auth_header,
    auth_prefix: defaults.auth_prefix,
    verify_ssl: defaults.verify_ssl,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    post('/settings/sms-debug', {
      preserveScroll: true,
      preserveState: true,
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Debug SMS" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Debug SMSFactor"
            description="Envoie un SMS de test et affiche le code HTTP, le code API retourné et le corps brut de la réponse."
          />

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Test d'envoi</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="to">Numéro destinataire</Label>
                    <Input id="to" value={data.to} onChange={(event) => setData('to', event.target.value)} placeholder="+33612345678" />
                    <InputError message={errors.to} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sender">Expéditeur</Label>
                    <Input id="sender" value={data.sender} onChange={(event) => setData('sender', event.target.value)} placeholder="SupportPC" />
                    <InputError message={errors.sender} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" rows={4} maxLength={120} value={data.message} onChange={(event) => setData('message', event.target.value)} />
                  <p className="text-xs text-muted-foreground">Maximum 120 caractères (limite appliquée à tous les SMS).</p>
                  <InputError message={errors.message} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="base_url">Base URL</Label>
                    <Input id="base_url" value={data.base_url} onChange={(event) => setData('base_url', event.target.value)} />
                    <InputError message={errors.base_url} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="send_path">Chemin d'envoi</Label>
                    <Input id="send_path" value={data.send_path} onChange={(event) => setData('send_path', event.target.value)} />
                    <InputError message={errors.send_path} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="auth_header">Header d'authentification</Label>
                    <Input id="auth_header" value={data.auth_header} onChange={(event) => setData('auth_header', event.target.value)} placeholder="Authorization" />
                    <InputError message={errors.auth_header} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="auth_prefix">Préfixe auth</Label>
                    <Input id="auth_prefix" value={data.auth_prefix} onChange={(event) => setData('auth_prefix', event.target.value)} placeholder="Bearer" />
                    <InputError message={errors.auth_prefix} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="api_key">Token API</Label>
                    <Input id="api_key" value={data.api_key} onChange={(event) => setData('api_key', event.target.value)} placeholder="Token SMSFactor" />
                    <InputError message={errors.api_key} />
                  </div>

                  <div className="flex items-end gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                    <input id="verify_ssl" type="checkbox" checked={data.verify_ssl} onChange={(event) => setData('verify_ssl', event.target.checked)} className="h-4 w-4 rounded border-input" />
                    <Label htmlFor="verify_ssl" className="cursor-pointer">Vérifier le certificat SSL</Label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={processing}>Envoyer le SMS de test</Button>
                  <p className="text-sm text-muted-foreground">Le retour brut et le code API seront affichés après l'envoi.</p>
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
                  <ResultPill label="HTTP" value={result.http_status ?? 'n/a'} />
                  <ResultPill label="Code API" value={result.api_code ?? 'n/a'} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">URL appelée</p>
                  <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/30 p-4 text-xs">{result.url}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Requête envoyée</p>
                  <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/30 p-4 text-xs">{JSON.stringify(result.request ?? {}, null, 2)}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Réponse brute</p>
                  <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/30 p-4 text-xs whitespace-pre-wrap">{result.body ?? 'Aucune réponse'}</pre>
                </div>

                {result.decoded && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Réponse décodée</p>
                    <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/30 p-4 text-xs">{JSON.stringify(result.decoded, null, 2)}</pre>
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
