import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { type BreadcrumbItem } from '@/types';

type LabelSettings = {
  widthMm: number;
  heightMm: number;
  qrSizeMm: number;
  marginMm: number;
  layout: 'qr-right' | 'qr-left';
  showId: boolean;
  showClient: boolean;
  showTitle: boolean;
  showMessage: boolean;
  showCategory: boolean;
  showPriority: boolean;
  showStatus: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showDate: boolean;
  showTime: boolean;
  showQr: boolean;
};

const defaults: LabelSettings = {
  widthMm: 29,
  heightMm: 62,
  qrSizeMm: 18,
  marginMm: 1,
  layout: 'qr-right',
  showId: true,
  showClient: true,
  showTitle: true,
  showMessage: false,
  showCategory: true,
  showPriority: true,
  showStatus: false,
  showEmail: true,
  showPhone: true,
  showAddress: false,
  showDate: true,
  showTime: true,
  showQr: true,
};

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Parametres etiquette ticket', href: '/settings/ticket-label' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function TicketLabelSettings({
  settings,
  canManage,
}: {
  settings: LabelSettings;
  canManage: boolean;
}) {
  const [widthMm, setWidthMm] = useState(String(settings?.widthMm ?? defaults.widthMm));
  const [heightMm, setHeightMm] = useState(String(settings?.heightMm ?? defaults.heightMm));
  const [qrSizeMm, setQrSizeMm] = useState(String(settings?.qrSizeMm ?? defaults.qrSizeMm));
  const [marginMm, setMarginMm] = useState(String(settings?.marginMm ?? defaults.marginMm));
  const [layout, setLayout] = useState<LabelSettings['layout']>(settings?.layout ?? defaults.layout);
  const [showId, setShowId] = useState(settings?.showId ?? defaults.showId);
  const [showClient, setShowClient] = useState(settings?.showClient ?? defaults.showClient);
  const [showTitle, setShowTitle] = useState(settings?.showTitle ?? defaults.showTitle);
  const [showMessage, setShowMessage] = useState(settings?.showMessage ?? defaults.showMessage);
  const [showCategory, setShowCategory] = useState(settings?.showCategory ?? defaults.showCategory);
  const [showPriority, setShowPriority] = useState(settings?.showPriority ?? defaults.showPriority);
  const [showStatus, setShowStatus] = useState(settings?.showStatus ?? defaults.showStatus);
  const [showEmail, setShowEmail] = useState(settings?.showEmail ?? defaults.showEmail);
  const [showPhone, setShowPhone] = useState(settings?.showPhone ?? defaults.showPhone);
  const [showAddress, setShowAddress] = useState(settings?.showAddress ?? defaults.showAddress);
  const [showDate, setShowDate] = useState(settings?.showDate ?? defaults.showDate);
  const [showTime, setShowTime] = useState(settings?.showTime ?? defaults.showTime);
  const [showQr, setShowQr] = useState(settings?.showQr ?? defaults.showQr);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setWidthMm(String(settings?.widthMm ?? defaults.widthMm));
    setHeightMm(String(settings?.heightMm ?? defaults.heightMm));
    setQrSizeMm(String(settings?.qrSizeMm ?? defaults.qrSizeMm));
    setMarginMm(String(settings?.marginMm ?? defaults.marginMm));
    setLayout(settings?.layout ?? defaults.layout);
    setShowId(settings?.showId ?? defaults.showId);
    setShowClient(settings?.showClient ?? defaults.showClient);
    setShowTitle(settings?.showTitle ?? defaults.showTitle);
    setShowMessage(settings?.showMessage ?? defaults.showMessage);
    setShowCategory(settings?.showCategory ?? defaults.showCategory);
    setShowPriority(settings?.showPriority ?? defaults.showPriority);
    setShowStatus(settings?.showStatus ?? defaults.showStatus);
    setShowEmail(settings?.showEmail ?? defaults.showEmail);
    setShowPhone(settings?.showPhone ?? defaults.showPhone);
    setShowAddress(settings?.showAddress ?? defaults.showAddress);
    setShowDate(settings?.showDate ?? defaults.showDate);
    setShowTime(settings?.showTime ?? defaults.showTime);
    setShowQr(settings?.showQr ?? defaults.showQr);
  }, [settings]);

  const normalized = useMemo<LabelSettings>(() => {
    const width = clamp(Number(widthMm || defaults.widthMm), 1, 120);
    const height = clamp(Number(heightMm || defaults.heightMm), 20, 80);
    const qrSize = clamp(Number(qrSizeMm || defaults.qrSizeMm), 10, 40);
    const margin = clamp(Number(marginMm || defaults.marginMm), 0, 5);

    return {
      widthMm: width,
      heightMm: height,
      qrSizeMm: qrSize,
      marginMm: margin,
      layout,
      showId,
      showClient,
      showTitle,
      showMessage,
      showCategory,
      showPriority,
      showStatus,
      showEmail,
      showPhone,
      showAddress,
      showDate,
      showTime,
      showQr,
    };
  }, [widthMm, heightMm, qrSizeMm, marginMm, layout, showId, showClient, showTitle, showMessage, showCategory, showPriority, showStatus, showEmail, showPhone, showAddress, showDate, showTime, showQr]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    router.put('/settings/ticket-label', normalized, {
      preserveScroll: true,
      onSuccess: () => {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1500);
      },
    });
  };

  const handleReset = () => {
    setWidthMm(String(defaults.widthMm));
    setHeightMm(String(defaults.heightMm));
    setQrSizeMm(String(defaults.qrSizeMm));
    setMarginMm(String(defaults.marginMm));
    setLayout(defaults.layout);
    setShowId(defaults.showId);
    setShowClient(defaults.showClient);
    setShowTitle(defaults.showTitle);
    setShowMessage(defaults.showMessage);
    setShowCategory(defaults.showCategory);
    setShowPriority(defaults.showPriority);
    setShowStatus(defaults.showStatus);
    setShowEmail(defaults.showEmail);
    setShowPhone(defaults.showPhone);
    setShowAddress(defaults.showAddress);
    setShowDate(defaults.showDate);
    setShowTime(defaults.showTime);
    setShowQr(defaults.showQr);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Parametres etiquette ticket" />

      <SettingsLayout>
        <div className="space-y-6">
          <HeadingSmall
            title="Etiquette ticket"
            description="Definissez la taille et la mise en page de l'etiquette imprimee."
          />

          <Card>
            <CardHeader>
              <CardTitle>Taille et QR code</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label htmlFor="label_width">Long (mm)</Label>
                    <Input
                      id="label_width"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={120}
                      value={widthMm}
                      onChange={(e) => setWidthMm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="label_height">Larg ruban (mm)</Label>
                    <Input
                      id="label_height"
                      type="number"
                      inputMode="decimal"
                      min={20}
                      max={80}
                      value={heightMm}
                      onChange={(e) => setHeightMm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="qr_size">Taille QR (mm)</Label>
                    <Input
                      id="qr_size"
                      type="number"
                      inputMode="decimal"
                      min={10}
                      max={40}
                      value={qrSizeMm}
                      onChange={(e) => setQrSizeMm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="label_margin">Marge (mm)</Label>
                    <Input
                      id="label_margin"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={5}
                      value={marginMm}
                      onChange={(e) => setMarginMm(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="layout">Mise en page</Label>
                  <select
                    id="layout"
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={layout}
                    onChange={(e) => setLayout(e.target.value as LabelSettings['layout'])}
                  >
                    <option value="qr-right">QR a droite</option>
                    <option value="qr-left">QR a gauche</option>
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_id" checked={showId} onCheckedChange={(value) => setShowId(Boolean(value))} />
                    <Label htmlFor="show_id">Afficher ID</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_client" checked={showClient} onCheckedChange={(value) => setShowClient(Boolean(value))} />
                    <Label htmlFor="show_client">Afficher client</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_title" checked={showTitle} onCheckedChange={(value) => setShowTitle(Boolean(value))} />
                    <Label htmlFor="show_title">Afficher sujet</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_message" checked={showMessage} onCheckedChange={(value) => setShowMessage(Boolean(value))} />
                    <Label htmlFor="show_message">Afficher message</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_category" checked={showCategory} onCheckedChange={(value) => setShowCategory(Boolean(value))} />
                    <Label htmlFor="show_category">Afficher categorie</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_priority" checked={showPriority} onCheckedChange={(value) => setShowPriority(Boolean(value))} />
                    <Label htmlFor="show_priority">Afficher priorite</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_status" checked={showStatus} onCheckedChange={(value) => setShowStatus(Boolean(value))} />
                    <Label htmlFor="show_status">Afficher status</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_email" checked={showEmail} onCheckedChange={(value) => setShowEmail(Boolean(value))} />
                    <Label htmlFor="show_email">Afficher email</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_phone" checked={showPhone} onCheckedChange={(value) => setShowPhone(Boolean(value))} />
                    <Label htmlFor="show_phone">Afficher telephone</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_address" checked={showAddress} onCheckedChange={(value) => setShowAddress(Boolean(value))} />
                    <Label htmlFor="show_address">Afficher adresse</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_date" checked={showDate} onCheckedChange={(value) => setShowDate(Boolean(value))} />
                    <Label htmlFor="show_date">Afficher date</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_time" checked={showTime} onCheckedChange={(value) => setShowTime(Boolean(value))} />
                    <Label htmlFor="show_time">Afficher heure</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="show_qr" checked={showQr} onCheckedChange={(value) => setShowQr(Boolean(value))} />
                    <Label htmlFor="show_qr">Afficher QR code</Label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={!canManage}>Enregistrer</Button>
                  <Button type="button" variant="secondary" onClick={handleReset} disabled={!canManage}>
                    Reinitialiser
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/tickets/print-settings">Imprimante tickets</Link>
                  </Button>
                  {saved && <span className="text-sm text-primary">Enregistre</span>}
                </div>
                {!canManage && (
                  <p className="text-sm text-muted-foreground">
                    Seuls les administrateurs peuvent modifier ces parametres.
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
