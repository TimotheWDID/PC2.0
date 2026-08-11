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

type TicketCreatedSettings = {
  enabled: boolean;
  mail_subject: string;
  mail_body: string;
  sms_body: string;
};

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Notification creation ticket',
    href: '/settings/ticket-created-notification',
  },
];

export default function TicketCreatedNotificationPage({
  settings,
  placeholders,
}: {
  settings: TicketCreatedSettings;
  placeholders: string[];
}) {
  const { data, setData, put, processing, errors } = useForm<TicketCreatedSettings>({
    enabled: settings?.enabled ?? true,
    mail_subject: settings?.mail_subject ?? '',
    mail_body: settings?.mail_body ?? '',
    sms_body: settings?.sms_body ?? '',
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    put('/settings/ticket-created-notification', {
      preserveScroll: true,
      preserveState: true,
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Notification creation ticket" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Notification a la creation d'un ticket"
            description="Envoi automatique au client via email ou SMS, selon les informations de sa fiche et le canal selectionne sur le ticket."
          />

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Parametres d'envoi</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-6">
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
                  <input
                    id="enabled"
                    type="checkbox"
                    checked={data.enabled}
                    onChange={(event) => setData('enabled', event.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="enabled" className="cursor-pointer">Activer l'envoi automatique a la creation</Label>
                </div>
                <InputError message={errors.enabled} />

                <div className="grid gap-2">
                  <Label htmlFor="mail_subject">Sujet du mail</Label>
                  <Input
                    id="mail_subject"
                    value={data.mail_subject}
                    onChange={(event) => setData('mail_subject', event.target.value)}
                    placeholder="Votre ticket #{ticket_id} a ete cree"
                  />
                  <InputError message={errors.mail_subject} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mail_body">Corps du mail</Label>
                  <Textarea
                    id="mail_body"
                    rows={8}
                    value={data.mail_body}
                    onChange={(event) => setData('mail_body', event.target.value)}
                  />
                  <InputError message={errors.mail_body} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sms_body">Contenu SMS</Label>
                  <Textarea
                    id="sms_body"
                    rows={4}
                    value={data.sms_body}
                    onChange={(event) => setData('sms_body', event.target.value)}
                  />
                  <InputError message={errors.sms_body} />
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <p className="text-sm font-medium">Placeholders disponibles</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Utilisez ces variables dans le sujet/contenu. Elles seront remplacees a l'envoi.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {placeholders.map((item) => (
                      <span key={item} className="rounded-full border border-border bg-background px-2 py-1 text-xs">
                        {item}
                      </span>
                    ))}
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-xs">[MagicLink]</span>
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-xs">[signature]</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={processing}>Enregistrer</Button>
                  <p className="text-sm text-muted-foreground">Le canal utilise depend du client: email ou SMS.</p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </SettingsLayout>
    </AppLayout>
  );
}
