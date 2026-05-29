import { Head, Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets', href: '/tickets' },
  { title: 'Imprimante tickets', href: '/tickets/print-settings' },
];

export default function PrinterSettings() {
  const [printerName, setPrinterName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('ticketPrinterName');
    if (stored) setPrinterName(stored);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ticketPrinterName', printerName.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Imprimante tickets" />
      <div className="py-4 w-full space-y-6">
        <Heading
          title="Imprimante tickets"
          description="Selectionnez l'imprimante utilisee pour les etiquettes de tickets."
        />

        <Card>
          <CardHeader>
            <CardTitle>Imprimante par defaut</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="printer_name">Nom de l'imprimante (info)</Label>
                <Input
                  id="printer_name"
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  placeholder="Ex: Zebra GK420d"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Le navigateur affichera toujours la boite de dialogue d'impression.
                  Ce champ sert a vous rappeler l'imprimante a choisir.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit">Enregistrer</Button>
                <Button variant="secondary" asChild>
                  <Link href="/tickets">Retour</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/settings/ticket-label">Options etiquette</Link>
                </Button>
                {saved && (
                  <span className="text-sm text-emerald-600">Enregistre</span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Format etiquette</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Taille cible: 62 x 29 mm (DK-44205).</p>
            <p>Contenu: ID, client, sujet, date, QR code, priorite, categorie, email, telephone.</p>
            <p>Modifiez la taille dans "Options etiquette".</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
