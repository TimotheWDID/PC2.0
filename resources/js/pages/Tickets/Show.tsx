import React, { useMemo, useState } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import Heading from '@/components/heading';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, Mail, Phone, FolderOpen, UserCheck, MapPin, Save, Edit, Check, X, Plus, ShoppingCart, History, Sparkles, Trash2, RotateCcw } from 'lucide-react';
import TicketChat from '@/components/TicketChat';

// Fonction pour traduire les statuts en français
const translateStatus = (status: string): string => {
  const translations: Record<string, string> = {
    'open': 'Ouvert',
    'in_progress': 'En cours',
    'pending': 'En attente',
    'resolved': 'Résolu',
    'closed': 'Fermé',
  };
  return translations[status] || status;
};

// Fonction pour traduire les priorités en français
const translatePriority = (priority: string): string => {
  const translations: Record<string, string> = {
    'low': 'Basse',
    'medium': 'Moyenne',
    'high': 'Haute',
  };
  return translations[priority] || priority;
};

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTimelineDetailValue = (value: unknown): string => {
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
};

const builtInEventTypeLabels: Record<string, string> = {
  ticket_created_by_technician: 'Creation',
  ticket_updated: 'Modification',
  status_changed: 'Statut',
  priority_changed: 'Priorite',
  internal_note_added: 'Note interne',
  public_reply_added: 'Reponse',
  commande_linked: 'Commande',
  commande_created_direct: 'Commande creee',
  commande_updated_direct: 'Commande modifiee',
  commande_status_changed_direct: 'Statut commande',
};

const getTimelineAccent = (eventType: string) => {
  if (eventType.startsWith('commande_')) {
    return {
      dot: 'bg-[#e6892e]',
      badge: 'border-[#e6892e] text-[#b55f00] dark:text-[#ffb86b]',
    };
  }

  return {
    dot: 'bg-[#2a3ff5]',
    badge: '',
  };
};

const statutLabels: Record<string, string> = {
  'open': 'Ouvert',
  'in_progress': 'En cours',
  'pending': 'En attente',
  'resolved': 'Résolu',
  'closed': 'Fermé',
};

const statutUI: Record<string, { badge: string; btn: string; btnActive: string }> = {
  open: {
    badge: 'bg-[#2a3ff5] text-white',
    btn: 'border border-border bg-background text-foreground hover:bg-muted',
    btnActive: 'bg-[#2a3ff5] text-white border border-[#2a3ff5] shadow-sm dark:bg-[#3a4dff] dark:border-[#3a4dff]',
  },
  in_progress: {
    badge: 'bg-[#63d7ca] text-[#141d3a]',
    btn: 'border border-border bg-background text-foreground hover:bg-muted',
    btnActive: 'bg-[#63d7ca] text-[#141d3a] border border-[#63d7ca] shadow-sm dark:bg-[#43bfb1] dark:border-[#43bfb1] dark:text-[#081a2b]',
  },
  pending: {
    badge: 'bg-[#b3b6bf] text-[#141d3a]',
    btn: 'border border-border bg-background text-foreground hover:bg-muted',
    btnActive: 'bg-[#b3b6bf] text-[#141d3a] border border-[#b3b6bf] shadow-sm dark:bg-[#8f95a3] dark:border-[#8f95a3] dark:text-[#0f1426]',
  },
  resolved: {
    badge: 'bg-[#141d3a] text-white',
    btn: 'border border-border bg-background text-foreground hover:bg-muted',
    btnActive: 'bg-[#141d3a] text-white border border-[#141d3a] shadow-sm dark:bg-[#26325f] dark:border-[#26325f]',
  },
  closed: {
    badge: 'bg-[#f3f4f6] text-[#141d3a] border border-[#b3b6bf]',
    btn: 'border border-border bg-background text-foreground hover:bg-muted',
    btnActive: 'bg-[#f3f4f6] text-[#141d3a] border border-[#b3b6bf] shadow-sm dark:bg-[#7e8594] dark:border-[#7e8594] dark:text-[#0f1426]',
  },
};

const priorityLabels: Record<string, string> = {
  'low': 'Basse',
  'medium': 'Moyenne',
  'high': 'Haute',
};

const priorityUI: Record<string, { badge: string; btn: string; btnActive: string }> = {
  low: {
    badge: 'bg-[#b3b6bf] text-[#141d3a]',
    btn: 'border border-border bg-background text-foreground hover:bg-muted',
    btnActive: 'bg-[#b3b6bf] text-[#141d3a] border border-[#b3b6bf] shadow-sm dark:bg-[#8f95a3] dark:border-[#8f95a3] dark:text-[#0f1426]',
  },
  medium: {
    badge: 'bg-[#63d7ca] text-[#141d3a]',
    btn: 'border border-border bg-background text-foreground hover:bg-muted',
    btnActive: 'bg-[#63d7ca] text-[#141d3a] border border-[#63d7ca] shadow-sm dark:bg-[#43bfb1] dark:border-[#43bfb1] dark:text-[#081a2b]',
  },
  high: {
    badge: 'bg-[#2a3ff5] text-white',
    btn: 'border border-border bg-background text-foreground hover:bg-muted',
    btnActive: 'bg-[#2a3ff5] text-white border border-[#2a3ff5] shadow-sm dark:bg-[#3a4dff] dark:border-[#3a4dff]',
  },
};

export default function Show({ ticket, categories, agents, commandes, timelineEvents = [], timelineTemplateSettings = { templates: [] } }: any) {
  const { auth } = usePage().props as any;
  const isAgent = !!auth.user?.agent;

  const [isEditing, setIsEditing] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [formData, setFormData] = useState({
    title: ticket.title ?? '',
    message: ticket.message ?? '',
    status: ticket.status ?? 'open',
    priority: ticket.priority ?? 'low',
    category_id: ticket.category?.id ?? '',
    assignee_id: ticket.assignee?.id ?? '',
    invoice_id: ticket.invoice_id ?? '',
    notify_by: ticket.notify_by ?? 'None',
    contact_phone: ticket.contact_phone ?? '',
    contact_email: ticket.contact_email ?? '',
    is_resolved: ticket.is_resolved ?? false,
    is_locked: ticket.is_locked ?? false,
  });

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [internalNote, setInternalNote] = useState(ticket.user?.internal_note ?? '');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineTypeFilter, setTimelineTypeFilter] = useState('all');
  const [timelineTechnicianFilter, setTimelineTechnicianFilter] = useState('all');
  const [showRemovedEvents, setShowRemovedEvents] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [manualEventForm, setManualEventForm] = useState({
    event_type: 'manual_note',
    summary: '',
    details: '',
    happened_at: '',
  });
  const [manualPrerequisites, setManualPrerequisites] = useState<Array<{ name: string; met: boolean }>>([]);

  const timelineTemplatesByType = useMemo(() => {
    const map = new Map<string, { label: string; enabled: boolean; summary: string; details: string }>();

    (timelineTemplateSettings?.templates ?? []).forEach((template: any) => {
      if (!template?.eventType) {
        return;
      }

      map.set(String(template.eventType), {
        label: String(template.label ?? template.eventType),
        enabled: Boolean(template.enabled),
        summary: String(template.summary ?? ''),
        details: String(template.details ?? ''),
      });
    });

    return map;
  }, [timelineTemplateSettings]);

  const selectedTemplate = timelineTemplatesByType.get(manualEventForm.event_type);
  const hasPrefillTemplate = Boolean(
    selectedTemplate?.enabled &&
    ((selectedTemplate.summary ?? '').trim() !== '' || (selectedTemplate.details ?? '').trim() !== ''),
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Tickets', href: '/tickets' },
    { title: ticket.title ?? 'Ticket', href: `/tickets/${ticket.id}` },
  ];

  const manualEventOptions = useMemo(() => {
    return Array.from(timelineTemplatesByType.entries()).map(([value, template]) => ({
      value,
      label: template.label || value,
      enabled: template.enabled,
    }));
  }, [timelineTemplatesByType]);

  const eventTypeLabels = useMemo(() => {
    const dynamicLabels: Record<string, string> = {};

    manualEventOptions.forEach((option) => {
      dynamicLabels[option.value] = option.label;
    });

    return {
      ...builtInEventTypeLabels,
      ...dynamicLabels,
    };
  }, [manualEventOptions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.put(`/tickets/${ticket.id}`, formData, {
      onSuccess: () => {
        setIsEditing(false);
      },
    });
  };

  const handleSaveNote = () => {
    router.patch(`/users/${ticket.user.id}/internal-note`, { internal_note: internalNote }, {
      onSuccess: () => {
        setIsEditingNote(false);
      },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    router.post(`/tickets/${ticket.id}/status`, { status: newStatus, _method: 'patch' }, {
      preserveScroll: true,
      onSuccess: () => {
        setFormData({ ...formData, status: newStatus });
      },
    });
  };

  const handlePriorityChange = (newPriority: string) => {
    router.post(`/tickets/${ticket.id}/priority`, { priority: newPriority, _method: 'patch' }, {
      preserveScroll: true,
      onSuccess: () => {
        setFormData({ ...formData, priority: newPriority });
      },
    });
  };

  const timelineTechnicians = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    timelineEvents.forEach((event: any) => {
      if (!event.technician?.id) {
        return;
      }

      map.set(String(event.technician.id), {
        id: String(event.technician.id),
        name: event.technician.name ?? 'Technicien',
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [timelineEvents]);

  const filteredTimelineEvents = useMemo(() => {
    const search = timelineSearch.trim().toLowerCase();

    return timelineEvents.filter((event: any) => {
      if (!showRemovedEvents && event.is_removed) {
        return false;
      }

      if (timelineTypeFilter !== 'all' && event.event_type !== timelineTypeFilter) {
        return false;
      }

      if (timelineTechnicianFilter !== 'all' && String(event.technician?.id ?? '') !== timelineTechnicianFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      const searchableText = [
        event.summary,
        event.technician?.name,
        event.removed_by?.name,
        event.details?.preview,
        event.details?.note,
        event.details?.changes?.map((change: any) => `${change.label ?? change.field} ${change.before ?? ''} ${change.after ?? ''}`).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [timelineEvents, timelineSearch, timelineTypeFilter, timelineTechnicianFilter, showRemovedEvents]);

  const handleCreateTimelineEvent = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...manualEventForm,
      prerequisites: manualPrerequisites.filter((prereq) => prereq.name.trim() !== ''),
    };

    router.post(`/tickets/${ticket.id}/timeline-events`, payload, {
      preserveScroll: true,
      onSuccess: () => {
        setIsAddEventModalOpen(false);
        setManualEventForm({
          event_type: 'manual_note',
          summary: '',
          details: '',
          happened_at: '',
        });
        setManualPrerequisites([]);
      },
    });
  };

  const applyPrefillTemplate = (eventType: string) => {
    const template = timelineTemplatesByType.get(eventType);

    if (!template || !template.enabled) {
      return;
    }

    const summary = (template.summary ?? '').trim();
    const details = (template.details ?? '').trim();

    setManualEventForm((current) => ({
      ...current,
      summary: summary !== '' ? summary : current.summary,
      details: details !== '' ? details : current.details,
    }));

    if (eventType === 'commande_modification_prerequis') {
      setManualPrerequisites([
        { name: 'fournisseur renseigne (si statut != new)', met: false },
        { name: 'numero de commande renseigne (commande/reception/traite)', met: false },
      ]);
    }
  };

  const addManualPrerequisite = () => {
    setManualPrerequisites((current) => [...current, { name: '', met: false }]);
  };

  const updateManualPrerequisite = (index: number, patch: Partial<{ name: string; met: boolean }>) => {
    setManualPrerequisites((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const removeManualPrerequisite = (index: number) => {
    setManualPrerequisites((current) => current.filter((_, i) => i !== index));
  };

  const handleRemoveTimelineEvent = (eventId: number) => {
    const reason = window.prompt('Raison du retrait (optionnel):') ?? '';

    router.delete(`/tickets/${ticket.id}/timeline-events/${eventId}`, {
      preserveScroll: true,
      data: { reason },
    });
  };

  const handleRestoreTimelineEvent = (eventId: number) => {
    router.post(`/tickets/${ticket.id}/timeline-events/${eventId}/restore`, {
      _method: 'patch',
    }, {
      preserveScroll: true,
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={ticket.title ?? 'Ticket'} />
      <div className="py-4 w-full">
        <div className="mb-4 flex items-center gap-2">
          <Link href="/tickets">
            <Button variant="outline" size="sm">
              ← Retour
            </Button>
          </Link>
          {isAgent && (
            <Link href={`/tickets/${ticket.id}/print-label`}>
              <Button variant="default" size="sm">
                Imprimer étiquette
              </Button>
            </Link>
          )}
        </div>
        <div className="mb-6">
          <h1 className="text-4xl font-bold tracking-tight">{ticket.title ?? 'Ticket'}</h1>
          {ticket.priority && (
            <p className="text-lg text-muted-foreground mt-2">
              Priorité: {translatePriority(ticket.priority)}
            </p>
          )}
        </div>

        {isAgent && (
          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <Card>
              <CardHeader>
                <CardTitle>Changer le statut</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statutLabels).map(([value, label]) => {
                    const isCurrent = formData.status === value;

                    return (
                      <Button
                        key={value}
                        variant="outline"
                        className={isCurrent ? statutUI[value]?.btnActive : statutUI[value]?.btn}
                        onClick={() => {
                          if (!isCurrent) {
                            handleStatusChange(value);
                          }
                        }}
                        type="button"
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Changer la priorité</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(priorityLabels).map(([value, label]) => {
                    const isCurrent = formData.priority === value;

                    return (
                      <Button
                        key={value}
                        variant="outline"
                        className={isCurrent ? priorityUI[value]?.btnActive : priorityUI[value]?.btn}
                        onClick={() => {
                          if (!isCurrent) {
                            handlePriorityChange(value);
                          }
                        }}
                        type="button"
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Ticket Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Détails du ticket</CardTitle>
                  {isAgent && !isEditing && (
                    <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                      Modifier
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {isAgent && isEditing ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Titre</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Catégorie</Label>
                      <Select value={formData.category_id.toString()} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((cat: any) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="assignee">Agent assigné</Label>
                      <Select value={formData.assignee_id.toString()} onValueChange={(value) => setFormData({ ...formData, assignee_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un agent" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Aucun</SelectItem>
                          {agents?.map((agent: any) => (
                            <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invoice_id">Numéro de facture</Label>
                      <Input
                        id="invoice_id"
                        value={formData.invoice_id}
                        onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                        placeholder="Optionnel"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contact_email">Email de contact</Label>
                        <Input
                          id="contact_email"
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                          placeholder="Optionnel"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact_phone">Téléphone de contact</Label>
                        <Input
                          id="contact_phone"
                          type="tel"
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                          placeholder="Optionnel"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notify_by">Méthode de notification</Label>
                      <Select value={formData.notify_by} onValueChange={(value) => setFormData({ ...formData, notify_by: value })}>
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
                          checked={formData.is_resolved}
                          onChange={(e) => setFormData({ ...formData, is_resolved: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="is_resolved" className="cursor-pointer">Ticket résolu</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="is_locked"
                          checked={formData.is_locked}
                          onChange={(e) => setFormData({ ...formData, is_locked: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="is_locked" className="cursor-pointer">Ticket verrouillé</Label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="submit">
                        <Save className="mr-2 h-4 w-4" />
                        Enregistrer
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                        Annuler
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">{ticket.message}</div>

                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Référence:</span>{' '}
                        <strong>#{ticket.id}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Créé le:</span>{' '}
                        <strong>{formatDateTime(ticket.created_at)}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Demandeur:</span>{' '}
                        <strong>{ticket.user?.name ?? '-'}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Agent assigné:</span>{' '}
                        <strong>{ticket.assignee?.name ?? 'Non assigné'}</strong>
                      </div>
                    </div>

                    {ticket.category && (
                      <div className="flex items-center gap-2 text-sm">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Catégorie:</span>
                        <strong>{ticket.category.name}</strong>
                      </div>
                    )}

                    {isAgent && (
                      <div className="pt-4 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowMoreInfo(!showMoreInfo)}
                          className="text-sm font-semibold -ml-2"
                        >
                          {showMoreInfo ? '− Masquer les informations' : '+ Montrer plus'}
                        </Button>

                        {showMoreInfo && (
                          <div className="space-y-3 mt-3">
                            {ticket.invoice_id && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Numéro de facture:</span>{' '}
                                <strong>{ticket.invoice_id}</strong>
                              </div>
                            )}

                            {ticket.contact_email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Contact:</span>
                                <a href={`mailto:${ticket.contact_email}`} className="text-primary hover:underline">
                                  {ticket.contact_email}
                                </a>
                              </div>
                            )}

                            {ticket.contact_phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Téléphone:</span>
                                <a href={`tel:${ticket.contact_phone}`} className="text-primary hover:underline">
                                  {ticket.contact_phone}
                                </a>
                              </div>
                            )}

                            <div className="text-sm">
                              <span className="text-muted-foreground">Notification:</span>{' '}
                              <Badge variant="outline">{ticket.notify_by || 'None'}</Badge>
                            </div>

                            <div className="flex gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                {ticket.is_resolved ? (
                                  <Badge variant="default" className="bg-green-600">Résolu</Badge>
                                ) : (
                                  <Badge variant="secondary">Non résolu</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {ticket.is_locked ? (
                                  <Badge variant="destructive">Verrouillé</Badge>
                                ) : (
                                  <Badge variant="outline">Non verrouillé</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Commandes Section - Only for agents */}
            {isAgent && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShoppingCart className="h-4 w-4" />
                      Commandes liées
                    </CardTitle>
                    <Link href={`/commandes/create?ticket_id=${ticket.id}`}>
                      <Button size="sm" variant="outline">
                        <Plus className="h-3 w-3 mr-1" />
                        Nouvelle
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {commandes && commandes.length > 0 ? (
                    <div className="space-y-2">
                      {commandes.map((commande: any) => (
                        <div
                          key={commande.id}
                          className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium truncate">{commande.nom}</span>
                              <Badge className={
                                commande.statut === 'traité' ? 'bg-gray-500 text-xs' :
                                commande.statut === 'réceptionner' ? 'bg-green-500 text-xs' :
                                commande.statut === 'commandé' ? 'bg-purple-500 text-xs' :
                                commande.statut === 'panier' ? 'bg-yellow-500 text-xs' :
                                'bg-blue-500 text-xs'
                              }>
                                {commande.statut === 'new' ? 'Nouveau' :
                                 commande.statut === 'panier' ? 'Panier' :
                                 commande.statut === 'commandé' ? 'Commandé' :
                                 commande.statut === 'réceptionner' ? 'Réceptionné' :
                                 'Traité'}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              <span className="font-mono">{commande.command_number}</span>
                              {' • '}
                              <span>{commande.fournisseur}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Link href={`/commandes/${commande.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                Voir
                              </Button>
                            </Link>
                            <Link href={`/commandes/${commande.id}/edit`}>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Aucune commande</p>
                      <Link href={`/commandes/create?ticket_id=${ticket.id}`}>
                        <Button variant="ghost" size="sm" className="mt-2 text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Créer
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isAgent && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-4 w-4" />
                      Suivi techniciens
                    </CardTitle>
                    <Dialog
                      open={isAddEventModalOpen}
                      onOpenChange={(open) => {
                        setIsAddEventModalOpen(open);

                        if (open) {
                          applyPrefillTemplate(manualEventForm.event_type);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter un evenement
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                          <DialogTitle>Ajouter un evenement de suivi</DialogTitle>
                          <DialogDescription>
                            Cet evenement sera visible dans la timeline du ticket avec votre nom et l&apos;heure.
                          </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleCreateTimelineEvent} className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Type d&apos;evenement</Label>
                              {hasPrefillTemplate && (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Pre-rempli actif
                                </span>
                              )}
                            </div>
                            <Select
                              value={manualEventForm.event_type}
                              onValueChange={(value) => {
                                setManualEventForm((current) => ({ ...current, event_type: value }));
                                applyPrefillTemplate(value);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {manualEventOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <span className="inline-flex items-center gap-1.5">
                                      {option.enabled ? (
                                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                                      ) : null}
                                      <span>{option.label}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="manual-summary">Resume</Label>
                            <Input
                              id="manual-summary"
                              value={manualEventForm.summary}
                              onChange={(e) => setManualEventForm({ ...manualEventForm, summary: e.target.value })}
                              placeholder="Ex: Diagnostic realise, alimentation HS identifiee"
                              maxLength={500}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="manual-details">Details</Label>
                            <Textarea
                              id="manual-details"
                              value={manualEventForm.details}
                              onChange={(e) => setManualEventForm({ ...manualEventForm, details: e.target.value })}
                              placeholder="Infos techniques, pieces changees, actions realisees..."
                              rows={4}
                              maxLength={3000}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="manual-happened-at">Date et heure (optionnel)</Label>
                            <Input
                              id="manual-happened-at"
                              type="datetime-local"
                              value={manualEventForm.happened_at}
                              onChange={(e) => setManualEventForm({ ...manualEventForm, happened_at: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Prerequis (optionnel)</Label>
                              <Button type="button" variant="ghost" size="sm" onClick={addManualPrerequisite}>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Ajouter prerequis
                              </Button>
                            </div>

                            {manualPrerequisites.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Aucun prerequis ajoute.</p>
                            ) : (
                              <div className="space-y-2">
                                {manualPrerequisites.map((prereq, index) => (
                                  <div key={`manual-prereq-${index}`} className="flex items-center gap-2">
                                    <Input
                                      value={prereq.name}
                                      onChange={(e) => updateManualPrerequisite(index, { name: e.target.value })}
                                      placeholder="Ex: Fournisseur renseigne"
                                      maxLength={160}
                                    />
                                    <Button
                                      type="button"
                                      variant={prereq.met ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => updateManualPrerequisite(index, { met: !prereq.met })}
                                    >
                                      {prereq.met ? 'OK' : 'A verifier'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => removeManualPrerequisite(index)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddEventModalOpen(false)}>
                              Annuler
                            </Button>
                            <Button type="submit">Ajouter</Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-4 grid gap-2 md:grid-cols-3">
                    <Input
                      value={timelineSearch}
                      onChange={(e) => setTimelineSearch(e.target.value)}
                      placeholder="Rechercher dans le suivi..."
                    />

                    <Select value={timelineTypeFilter} onValueChange={setTimelineTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Type d&apos;evenement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les types</SelectItem>
                        {Object.keys(eventTypeLabels).map((eventType) => (
                          <SelectItem key={eventType} value={eventType}>{eventTypeLabels[eventType]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={timelineTechnicianFilter} onValueChange={setTimelineTechnicianFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Technicien" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les techniciens</SelectItem>
                        {timelineTechnicians.map((technician) => (
                          <SelectItem key={technician.id} value={technician.id}>{technician.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-3 flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Afficher les evenements retires</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowRemovedEvents((value) => !value)}>
                      {showRemovedEvents ? 'Masquer retires' : 'Voir retires'}
                    </Button>
                  </div>

                  {filteredTimelineEvents.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Aucune action technicien enregistree pour le moment.</div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTimelineEvents.map((event: any) => (
                        <div key={event.id} className="relative border-l pl-5 pb-4 last:pb-0">
                          <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ${getTimelineAccent(event.event_type).dot}`} />
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className={`text-sm font-medium ${event.is_removed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                {event.summary}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {event.technician?.name ?? 'Technicien'}{' '}
                                • {formatDateTime(event.happened_at)}
                              </p>
                              {event.is_removed && (
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                  {event.removed_by?.name ?? 'Technicien'} a retire un evenement le {formatDateTime(event.removed_at)}
                                  {event.removed_reason ? ` - ${event.removed_reason}` : ''}
                                </p>
                              )}
                              {!event.is_removed && event.restored_by?.name && (
                                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                  Evenement restaure par {event.restored_by.name} le {formatDateTime(event.restored_at)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {event.event_type && (
                                <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${getTimelineAccent(event.event_type).badge}`}>
                                  {eventTypeLabels[event.event_type] ?? event.event_type}
                                </Badge>
                              )}

                              {!event.is_removed ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => handleRemoveTimelineEvent(event.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Retirer
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => handleRestoreTimelineEvent(event.id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                  Restaurer
                                </Button>
                              )}
                            </div>
                          </div>

                          {Array.isArray(event.details?.changes) && event.details.changes.length > 0 && (
                            <div className="mt-2 space-y-1 rounded-md border bg-muted/30 p-2">
                              {event.details.changes.map((change: any, index: number) => (
                                <p key={`${event.id}-change-${index}`} className="text-xs text-muted-foreground">
                                  <strong className="text-foreground">{change.label ?? change.field}:</strong>{' '}
                                  {formatTimelineDetailValue(change.before)} → {formatTimelineDetailValue(change.after)}
                                </p>
                              ))}
                            </div>
                          )}

                          {event.details?.preview && (
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">"{event.details.preview}"</p>
                          )}

                          {event.details?.note && (
                            <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{event.details.note}</p>
                          )}

                          {Array.isArray(event.details?.prerequisites) && event.details.prerequisites.length > 0 && (
                            <div className="mt-2 rounded-md border border-[#e6892e]/40 bg-[#e6892e]/10 p-2">
                              <p className="text-[11px] font-medium text-[#b55f00] dark:text-[#ffb86b]">Prerequis commande</p>
                              <div className="mt-1 space-y-1">
                                {event.details.prerequisites.map((prereq: any, index: number) => (
                                  <p key={`${event.id}-prereq-${index}`} className="text-[11px] text-muted-foreground">
                                    {prereq.met ? 'OK' : 'A verifier'} - {prereq.name}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}


          </div>

          {/* Chat Component */}
          <TicketChat ticketId={ticket.id} currentUserId={auth.user?.id} isAgent={isAgent} />
        </div>

        {/* User and Assignee Information - Side by side */}
        <div className="grid gap-4 md:grid-cols-2 mt-6">
          {/* User Information */}
          {ticket.user && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Demandeur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{ticket.user.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${ticket.user.email}`} className="text-primary hover:underline">
                    {ticket.user.email}
                  </a>
                </div>
                {ticket.user.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${ticket.user.phone}`} className="text-primary hover:underline">
                      {ticket.user.phone}
                    </a>
                  </div>
                )}
                {ticket.user.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{ticket.user.address}</span>
                  </div>
                )}
                {isAgent && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Note interne</Label>
                      {!isEditingNote && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingNote(true)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {isEditingNote ? (
                      <div className="space-y-2">
                        <Textarea
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                          placeholder="Ajouter une note interne..."
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveNote}>
                            <Check className="h-4 w-4 mr-1" />
                            Sauvegarder
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsEditingNote(false);
                              setInternalNote(ticket.user.internal_note ?? '');
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {internalNote || 'Aucune note'}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Assignee Information */}
          {ticket.assignee && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Agent assigné
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{ticket.assignee.name}</span>
                </div>
                {ticket.assignee.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${ticket.assignee.phone}`} className="text-primary hover:underline">
                      {ticket.assignee.phone}
                    </a>
                  </div>
                )}
                {isAgent && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${ticket.assignee.email}`} className="text-primary hover:underline">
                        {ticket.assignee.email}
                      </a>
                    </div>
                    {ticket.assignee.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{ticket.assignee.address}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
