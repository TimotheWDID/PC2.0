import React from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import MobileNativeNav from '@/components/mobile-native-nav';

export default function Edit({ ticket, categories, agents, userDevices = [] }: any) {
  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Tickets', href: '/tickets' },
    { title: ticket.title ?? 'Modifier', href: `/tickets/${ticket.id}/edit` },
  ];
  const { data, setData, put, processing, errors } = useForm<{
    title: string;
    message: string;
    category_id: string;
    status: string;
    priority: string;
    assignee_id: string;
    device_id: string;
    invoice_id: string;
    notify_by: string;
    contact_phone: string;
    contact_email: string;
    is_resolved: boolean;
    is_locked: boolean;
  }>({
    title: ticket.title || '',
    message: ticket.message || '',
    category_id: ticket.category_id || '',
    status: ticket.status || 'open',
    priority: ticket.priority || 'low',
    assignee_id: ticket.assignee_id || '',
    device_id: ticket.device_id || '',
    invoice_id: ticket.invoice_id || '',
    notify_by: ticket.notify_by || 'None',
    contact_phone: ticket.contact_phone || '',
    contact_email: ticket.contact_email || '',
    is_resolved: ticket.is_resolved || false,
    is_locked: ticket.is_locked || false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    put(`/tickets/${ticket.id}`);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Modifier: ${ticket.title}`} />
      <div className="py-4 w-full">
        <Heading title={`Modifier: ${ticket.title}`} description="Modifiez les informations du ticket" />

        <Card>
          <CardHeader>
            <CardTitle>Modifier le ticket</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="title">Sujet</Label>
                <Input id="title" name="title" value={data.title} onChange={(e) => setData('title', e.target.value)} required />
                {errors.title && <div className="text-destructive">{errors.title}</div>}
              </div>

              <div>
                <Label htmlFor="message">Description</Label>
                <Textarea id="message" name="message" rows={6} value={data.message} onChange={(e) => setData('message', e.target.value)} />
                {errors.message && <div className="text-destructive">{errors.message}</div>}
              </div>

              <div>
                <Label htmlFor="category_id">Catégorie</Label>
                <Select value={data.category_id.toString()} onValueChange={(value) => setData('category_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Sélectionner --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">-- Sélectionner --</SelectItem>
                    {categories && categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="assignee_id">Agent assigné</Label>
                <Select value={data.assignee_id.toString()} onValueChange={(value) => setData('assignee_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Sélectionner --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Aucun</SelectItem>
                    {agents && agents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="device_id">Appareil lié</Label>
                <Select value={data.device_id ? data.device_id.toString() : '0'} onValueChange={(value) => setData('device_id', value === '0' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Sélectionner --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Aucun</SelectItem>
                    {userDevices && userDevices.map((device: any) => (
                      <SelectItem key={device.id} value={device.id.toString()}>{device.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.device_id && <div className="text-destructive">{errors.device_id}</div>}
              </div>

              <div>
                <Label htmlFor="invoice_id">Numéro de facture</Label>
                <Input id="invoice_id" name="invoice_id" value={data.invoice_id} onChange={(e) => setData('invoice_id', e.target.value)} placeholder="Optionnel" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_email">Email de contact</Label>
                  <Input id="contact_email" name="contact_email" type="email" value={data.contact_email} onChange={(e) => setData('contact_email', e.target.value)} placeholder="Optionnel" />
                </div>

                <div>
                  <Label htmlFor="contact_phone">Téléphone de contact</Label>
                  <Input id="contact_phone" name="contact_phone" type="tel" value={data.contact_phone} onChange={(e) => setData('contact_phone', e.target.value)} placeholder="Optionnel" />
                </div>
              </div>

              <div>
                <Label htmlFor="notify_by">Méthode de notification</Label>
                <Select value={data.notify_by} onValueChange={(value) => setData('notify_by', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">Aucune</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_resolved"
                    checked={data.is_resolved}
                    onChange={(e) => setData('is_resolved', e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="is_resolved" className="cursor-pointer">Ticket résolu</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_locked"
                    checked={data.is_locked}
                    onChange={(e) => setData('is_locked', e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="is_locked" className="cursor-pointer">Ticket verrouillé</Label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={processing} variant="default">Enregistrer</Button>
                <Button asChild variant="secondary"><a href="/tickets">Annuler</a></Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  );
}

