import React, { useMemo, useState } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, Mail, Phone, FolderOpen, UserCheck, MapPin, Save, Edit, Check, X, Plus, ShoppingCart, History, Sparkles, Trash2, RotateCcw, Eye, EyeOff, Ticket, Cpu, ShieldCheck, Printer, NotebookPen, Loader2 } from 'lucide-react';
import TicketChat from '@/components/TicketChat';
import { formatDateTimeFr } from '@/lib/datetime';
import MobileNativeNav from '@/components/mobile-native-nav';

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
  return formatDateTimeFr(value, { timeZone: 'Europe/Paris' });
};

const formatElapsedFromNow = (value?: string | null): string => {
  if (!value) {
    return '-';
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return '-';
  }

  const diffMs = Date.now() - target.getTime();
  if (diffMs < 0) {
    return 'A venir';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} j`;
};

const toUtcNaiveDateTime = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const localDate = new Date(value);
  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return localDate.toISOString().slice(0, 19).replace('T', ' ');
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
  device_event_added: 'Intervention appareil',
  task_completed: 'Action realisee',
  task_reopened: 'Action reouverte',
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

type PredefinedTaskList = {
  key: string;
  label: string;
  tasks: string[];
};

export default function Show({ ticket, categories, agents, commandes, userDevices = [], timelineEvents = [], deviceEvents = [], timelineTemplateSettings = { templates: [] }, actionListSettings = { lists: [] } }: any) {
  const { auth } = usePage().props as any;
  const isAgent = !!auth.user?.agent;
  const [pendingTimelineActions, setPendingTimelineActions] = useState<string[]>([]);
  const [pendingRemovedTimelineEvents, setPendingRemovedTimelineEvents] = useState<number[]>([]);
  const [pendingRestoredTimelineEvents, setPendingRestoredTimelineEvents] = useState<number[]>([]);
  const [pendingStatusValue, setPendingStatusValue] = useState<string | null>(null);
  const [pendingPriorityValue, setPendingPriorityValue] = useState<string | null>(null);
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [isSavingInternalNote, setIsSavingInternalNote] = useState(false);
  const [isAddingTimelineEvent, setIsAddingTimelineEvent] = useState(false);
  const [isAddingDeviceEvent, setIsAddingDeviceEvent] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [formData, setFormData] = useState({
    title: ticket.title ?? '',
    message: ticket.message ?? '',
    status: ticket.status ?? 'open',
    priority: ticket.priority ?? 'low',
    category_id: ticket.category?.id ?? '',
    assignee_id: ticket.assignee?.id ?? '',
    device_id: ticket.device?.id ?? '',
    invoice_id: ticket.invoice_id ?? '',
    notify_by: ticket.notify_by ?? 'None',
    contact_phone: ticket.contact_phone ?? '',
    contact_email: ticket.contact_email ?? '',
    is_resolved: ticket.is_resolved ?? false,
    is_locked: ticket.is_locked ?? false,
  });

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [internalNote, setInternalNote] = useState(ticket.user?.internal_note ?? '');
  const [showTicketPassword, setShowTicketPassword] = useState(false);
  const [showDevicePassword, setShowDevicePassword] = useState(false);
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineTypeFilter, setTimelineTypeFilter] = useState('all');
  const [timelineTechnicianFilter, setTimelineTechnicianFilter] = useState('all');
  const [showRemovedEvents, setShowRemovedEvents] = useState(false);
  const [isTimelinePanelOpen, setIsTimelinePanelOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [manualEventForm, setManualEventForm] = useState({
    event_type: 'manual_note',
    summary: '',
    details: '',
    happened_at: '',
  });
  const [manualPrerequisites, setManualPrerequisites] = useState<Array<{ name: string; met: boolean }>>([]);
  const [manualActions, setManualActions] = useState<Array<{ label: string; done: boolean }>>([]);
  const [deviceEventForm, setDeviceEventForm] = useState({
    event_type: 'maintenance',
    summary: '',
    details: '',
    happened_at: '',
  });
  const [isDeviceActionModalOpen, setIsDeviceActionModalOpen] = useState(false);
  const [deviceIdToAttach, setDeviceIdToAttach] = useState(ticket.device?.id ? String(ticket.device.id) : '');
  const [isAttachingDevice, setIsAttachingDevice] = useState(false);
  const [isCreatingDevice, setIsCreatingDevice] = useState(false);
  const [newDeviceForm, setNewDeviceForm] = useState({
    device_type: 'computer',
    brand: '',
    model: '',
    serial_number: '',
    asset_tag: '',
    purchase_date: '',
    warranty_end_date: '',
  });

  const ticketActionBtnClass = 'h-8 px-2 text-[11px] whitespace-normal text-foreground';

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

  const requesterHref = ticket.user ? `/users/${ticket.user.id}/edit#tickets-client` : null;
  const assigneeHref = ticket.assignee ? `/users/${ticket.assignee.id}/edit` : null;
  const deviceHref = ticket.device ? `/devices/${ticket.device.id}` : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingTicket) {
      return;
    }

    setIsSavingTicket(true);
    router.put(`/tickets/${ticket.id}`, formData, {
      onSuccess: () => {
        setIsEditing(false);
      },
      onFinish: () => {
        setIsSavingTicket(false);
      },
    });
  };

  const handleSaveNote = () => {
    if (isSavingInternalNote) {
      return;
    }

    setIsSavingInternalNote(true);
    router.patch(`/users/${ticket.user.id}/internal-note`, { internal_note: internalNote }, {
      onSuccess: () => {
        setIsEditingNote(false);
      },
      onFinish: () => {
        setIsSavingInternalNote(false);
      },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    if (pendingStatusValue !== null) {
      return;
    }

    setPendingStatusValue(newStatus);
    router.post(`/tickets/${ticket.id}/status`, { status: newStatus, _method: 'patch' }, {
      preserveScroll: true,
      onSuccess: () => {
        setFormData({ ...formData, status: newStatus });
      },
      onFinish: () => {
        setPendingStatusValue(null);
      },
    });
  };

  const handlePriorityChange = (newPriority: string) => {
    if (pendingPriorityValue !== null) {
      return;
    }

    setPendingPriorityValue(newPriority);
    router.post(`/tickets/${ticket.id}/priority`, { priority: newPriority, _method: 'patch' }, {
      preserveScroll: true,
      onSuccess: () => {
        setFormData({ ...formData, priority: newPriority });
      },
      onFinish: () => {
        setPendingPriorityValue(null);
      },
    });
  };

  const handleCreateDeviceEvent = (e: React.FormEvent) => {
    e.preventDefault();

    if (isAddingDeviceEvent) {
      return;
    }

    setIsAddingDeviceEvent(true);

    const payload = {
      ...deviceEventForm,
      happened_at: toUtcNaiveDateTime(deviceEventForm.happened_at),
    };

    router.post(`/tickets/${ticket.id}/device-events`, payload, {
      preserveScroll: true,
      onSuccess: () => {
        setDeviceEventForm({
          event_type: 'maintenance',
          summary: '',
          details: '',
          happened_at: '',
        });
      },
      onFinish: () => {
        setIsAddingDeviceEvent(false);
      },
    });
  };

  const openDeviceActionModal = () => {
    setDeviceIdToAttach(ticket.device?.id ? String(ticket.device.id) : '');
    setNewDeviceForm({
      device_type: 'computer',
      brand: '',
      model: '',
      serial_number: '',
      asset_tag: '',
      purchase_date: '',
      warranty_end_date: '',
    });
    setIsDeviceActionModalOpen(true);
  };

  const closeDeviceActionModal = () => {
    setIsDeviceActionModalOpen(false);
    setIsAttachingDevice(false);
    setIsCreatingDevice(false);
  };

  const handleAttachDeviceFromActions = () => {
    setIsAttachingDevice(true);
    router.patch(
      `/tickets/${ticket.id}/attach-device`,
      { device_id: deviceIdToAttach || null },
      {
        preserveScroll: true,
        onSuccess: () => closeDeviceActionModal(),
        onFinish: () => setIsAttachingDevice(false),
      },
    );
  };

  const handleCreateDeviceFromActions = () => {
    setIsCreatingDevice(true);
    router.post(
      `/tickets/${ticket.id}/create-device`,
      newDeviceForm,
      {
        preserveScroll: true,
        onSuccess: () => closeDeviceActionModal(),
        onFinish: () => setIsCreatingDevice(false),
      },
    );
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
        event.details?.actions?.map((action: any) => `${action.label ?? ''} ${action.done_by_name ?? ''}`).join(' '),
        event.details?.changes?.map((change: any) => `${change.label ?? change.field} ${change.before ?? ''} ${change.after ?? ''}`).join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [timelineEvents, timelineSearch, timelineTypeFilter, timelineTechnicianFilter, showRemovedEvents]);

  const latestTimelineEvents = useMemo(() => {
    return timelineEvents.filter((event: any) => !event.is_removed).slice(0, 8);
  }, [timelineEvents]);

  const pendingTimelineTodos = useMemo(() => {
    return timelineEvents
      .filter((event: any) => !event.is_removed && Array.isArray(event.details?.actions))
      .flatMap((event: any) =>
        event.details.actions
          .map((action: any, originalIndex: number) => ({
            event,
            action,
            originalIndex,
          }))
          .filter(({ action }: any) => !action.done),
      )
      .sort((left: any, right: any) => {
        const leftAt = left.event?.happened_at ? new Date(left.event.happened_at).getTime() : 0;
        const rightAt = right.event?.happened_at ? new Date(right.event.happened_at).getTime() : 0;

        if (leftAt !== rightAt) {
          return rightAt - leftAt;
        }

        return left.originalIndex - right.originalIndex;
      });
  }, [timelineEvents]);

  const operationalInsights = useMemo(() => {
    const lastTimelineAt = timelineEvents.find((event: any) => !event.is_removed)?.happened_at ?? null;
    const lastDeviceAt = deviceEvents[0]?.happened_at ?? null;
    const lastCommandeAt = commandes?.[0]?.created_at ?? null;

    const latestActivityAt = [lastTimelineAt, lastDeviceAt, lastCommandeAt]
      .filter(Boolean)
      .map((value) => new Date(String(value)))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const latestActivityMs = latestActivityAt ? (Date.now() - latestActivityAt.getTime()) : null;
    const latestActivityHours = latestActivityMs !== null ? Math.floor(latestActivityMs / (1000 * 60 * 60)) : null;

    let slaLevel: 'ok' | 'watch' | 'critical' = 'ok';
    if (latestActivityHours !== null && latestActivityHours >= 72) {
      slaLevel = 'critical';
    } else if (latestActivityHours !== null && latestActivityHours >= 24) {
      slaLevel = 'watch';
    }

    if (formData.status === 'pending' && latestActivityHours !== null && latestActivityHours >= 24) {
      slaLevel = 'critical';
    }

    const activeCommandesCount = (commandes ?? []).filter((commande: any) => {
      const statut = String(commande.statut ?? '').toLowerCase();
      return statut !== 'traite' && statut !== 'traité';
    }).length;

    return {
      ticketAge: formatElapsedFromNow(ticket.created_at),
      latestActivityAt: latestActivityAt ? latestActivityAt.toISOString() : null,
      activeCommandesCount,
      latestTimelineAt: lastTimelineAt,
      latestActivityHours,
      slaLevel,
      technicianActionsCount: timelineEvents.filter((event: any) => !event.is_removed).length,
      isAssigned: Boolean(ticket.assignee?.id),
      isDeviceLinked: Boolean(ticket.device?.id),
    };
  }, [ticket.created_at, ticket.assignee?.id, ticket.device?.id, timelineEvents, deviceEvents, commandes, formData.status]);

  const topInfoCards = useMemo(() => {
    const isLockedLabel = ticket.is_locked ? 'Verrouille' : 'Actif';
    const isResolvedLabel = ticket.is_resolved ? 'Resolu' : 'A traiter';

    return [
      {
        title: 'Ticket',
        icon: Ticket,
        lines: [
          `#${ticket.id}`,
          `${translateStatus(formData.status)} · ${translatePriority(formData.priority)}`,
          `Cree le ${formatDateTime(ticket.created_at)}`,
          `${isResolvedLabel} · ${isLockedLabel} · Age: ${operationalInsights.ticketAge}`,
        ],
      },
      {
        title: 'Appareil',
        icon: Cpu,
        lines: [
          ticket.device?.display_name ?? 'Aucun appareil lie',
          ticket.device?.serial_number ? `S/N: ${ticket.device.serial_number}` : 'Numero de serie non renseigne',
          ticket.device?.asset_tag ? `Suivi: ${ticket.device.asset_tag}` : 'Numero de suivi non renseigne',
          ticket.no_device_password ? 'Mot de passe non fourni' : (ticket.device_password ? 'Mot de passe ticket enregistre' : 'Mot de passe non renseigne'),
        ],
      },
      {
        title: 'Commandes liees',
        icon: ShoppingCart,
        lines: [
          `${commandes?.length ?? 0} commande(s) dont ${operationalInsights.activeCommandesCount} active(s)`,
          commandes?.[0]?.nom ? `Derniere: ${commandes[0].nom}` : 'Aucune commande rattachee',
          commandes?.[0]?.statut ? `Statut: ${commandes[0].statut}` : 'Statut: -',
          commandes?.[0]?.fournisseur ? `Fournisseur: ${commandes[0].fournisseur}` : 'Fournisseur: -',
        ],
      },
      {
        title: 'SLA et contacts',
        icon: ShieldCheck,
        lines: [
          `Dernier mouvement: ${formatElapsedFromNow(operationalInsights.latestActivityAt)}`,
          ticket.user?.name ?? 'Demandeur inconnu',
          ticket.contact_phone || ticket.user?.phone || 'Telephone non renseigne',
          ticket.contact_email || ticket.user?.email || 'Email non renseigne',
          ticket.assignee?.name ? `Assigne a ${ticket.assignee.name}` : 'Aucun technicien assigne',
        ],
      },
    ];
  }, [ticket, commandes, formData.status, formData.priority, operationalInsights]);

  const mobileTopInfoCards = useMemo(() => {
    return [
      { title: 'Ticket', icon: Ticket, value: `#${ticket.id} · ${translateStatus(formData.status)}` },
      { title: 'SLA', icon: ShieldCheck, value: operationalInsights.slaLevel === 'critical' ? 'Critique' : operationalInsights.slaLevel === 'watch' ? 'A surveiller' : 'OK' },
      { title: 'Appareil', icon: Cpu, value: ticket.device?.display_name ?? 'Non lie' },
      { title: 'Cmd actives', icon: ShoppingCart, value: String(operationalInsights.activeCommandesCount) },
    ];
  }, [ticket.id, ticket.device, formData.status, operationalInsights]);

  const handleCreateTimelineEvent = (e: React.FormEvent) => {
    e.preventDefault();

    if (isAddingTimelineEvent) {
      return;
    }

    setIsAddingTimelineEvent(true);

    const payload = {
      ...manualEventForm,
      happened_at: toUtcNaiveDateTime(manualEventForm.happened_at),
      prerequisites: manualPrerequisites.filter((prereq) => prereq.name.trim() !== ''),
      actions: manualActions.filter((action) => action.label.trim() !== ''),
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
        setManualActions([]);
      },
      onFinish: () => {
        setIsAddingTimelineEvent(false);
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

    setManualActions([]);

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

  const addManualAction = () => {
    setManualActions((current) => [...current, { label: '', done: false }]);
  };

  const updateManualAction = (index: number, patch: Partial<{ label: string; done: boolean }>) => {
    setManualActions((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const removeManualAction = (index: number) => {
    setManualActions((current) => current.filter((_, i) => i !== index));
  };

  const predefinedTaskLists = useMemo<PredefinedTaskList[]>(() => {
    return (actionListSettings?.lists ?? [])
      .map((list: any) => ({
        key: String(list?.key ?? ''),
        label: String(list?.label ?? list?.key ?? ''),
        tasks: Array.isArray(list?.tasks)
          ? list.tasks.map((task: unknown) => String(task ?? '').trim()).filter((task: string) => task !== '')
          : [],
      }))
      .filter((list: PredefinedTaskList) => list.key !== '' && list.tasks.length > 0);
  }, [actionListSettings]);

  const applyPredefinedTaskList = (listKey: string) => {
    const list = predefinedTaskLists.find((item: PredefinedTaskList) => item.key === listKey);

    if (!list || !Array.isArray(list.tasks) || list.tasks.length === 0) {
      return;
    }

    setManualActions(list.tasks.map((task: string) => ({ label: task, done: false })));
  };

  const handleRemoveTimelineEvent = (eventId: number) => {
    if (pendingRemovedTimelineEvents.includes(eventId)) {
      return;
    }

    setPendingRemovedTimelineEvents((current) => [...current, eventId]);
    const reason = window.prompt('Raison du retrait (optionnel):') ?? '';

    router.delete(`/tickets/${ticket.id}/timeline-events/${eventId}`, {
      preserveScroll: true,
      data: { reason },
      onFinish: () => {
        setPendingRemovedTimelineEvents((current) => current.filter((id) => id !== eventId));
      },
    });
  };

  const handleRestoreTimelineEvent = (eventId: number) => {
    if (pendingRestoredTimelineEvents.includes(eventId)) {
      return;
    }

    setPendingRestoredTimelineEvents((current) => [...current, eventId]);
    router.post(`/tickets/${ticket.id}/timeline-events/${eventId}/restore`, {
      _method: 'patch',
    }, {
      preserveScroll: true,
      onFinish: () => {
        setPendingRestoredTimelineEvents((current) => current.filter((id) => id !== eventId));
      },
    });
  };

  const handleToggleTimelineAction = (eventId: number, actionIndex: number, done: boolean) => {
    const actionKey = `${eventId}:${actionIndex}`;

    if (pendingTimelineActions.includes(actionKey)) {
      return;
    }

    setPendingTimelineActions((current) => [...current, actionKey]);

    router.post(`/tickets/${ticket.id}/timeline-events/${eventId}/actions`, {
      _method: 'patch',
      action_index: actionIndex,
      done,
    }, {
      preserveScroll: true,
      onFinish: () => {
        setPendingTimelineActions((current) => current.filter((key) => key !== actionKey));
      },
    });
  };

  const renderTimelineEventItem = (event: any, showActions = true) => (
    <div
      key={event.id}
      className={`relative rounded-lg border border-border/70 bg-background/80 px-3 py-3 shadow-sm ${event.is_removed ? 'opacity-75' : ''}`}
    >
      <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ${getTimelineAccent(event.event_type).dot}`} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-sm font-medium ${event.is_removed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{event.summary}</p>
          <p className="text-xs text-muted-foreground">{event.technician?.name ?? 'Technicien'} • {formatDateTime(event.happened_at)}</p>
          {event.is_removed && (
            <p className="text-xs text-muted-foreground">
              {event.removed_by?.name ?? 'Technicien'} a retiré un événement le {formatDateTime(event.removed_at)}{event.removed_reason ? ` - ${event.removed_reason}` : ''}
            </p>
          )}
          {!event.is_removed && event.restored_by?.name && (
            <p className="text-xs text-primary">Événement restauré par {event.restored_by.name} le {formatDateTime(event.restored_at)}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {event.event_type && (
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${getTimelineAccent(event.event_type).badge}`}>
              {eventTypeLabels[event.event_type] ?? event.event_type}
            </Badge>
          )}
          {showActions && (
            !event.is_removed ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive"
                onClick={() => handleRemoveTimelineEvent(event.id)}
                disabled={pendingRemovedTimelineEvents.includes(event.id)}
              >
                {pendingRemovedTimelineEvents.includes(event.id)
                  ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Retirer
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => handleRestoreTimelineEvent(event.id)}
                disabled={pendingRestoredTimelineEvents.includes(event.id)}
              >
                {pendingRestoredTimelineEvents.includes(event.id)
                  ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                Restaurer
              </Button>
            )
          )}
        </div>
      </div>
      {Array.isArray(event.details?.changes) && event.details.changes.length > 0 && (
        <div className="mt-2 space-y-1 rounded-md border bg-muted/30 p-2">
          {event.details.changes.map((change: any, index: number) => (
            <p key={`${event.id}-chg-${index}`} className="text-xs text-muted-foreground">
              <strong className="text-foreground">{change.label ?? change.field}:</strong>{' '}
              {formatTimelineDetailValue(change.before)} → {formatTimelineDetailValue(change.after)}
            </p>
          ))}
        </div>
      )}
      {event.details?.preview && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">"{event.details.preview}"</p>}
      {event.details?.note && <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{event.details.note}</p>}
      {Array.isArray(event.details?.actions) && event.details.actions.length > 0 && (
        <div className="mt-2 rounded-md border border-border/70 bg-muted/20 p-2">
          <p className="text-[11px] font-medium text-foreground">Actions a realiser</p>
          <div className="mt-1 space-y-1.5">
            {[...event.details.actions]
              .map((action: any, originalIndex: number) => ({ action, originalIndex }))
              .sort((left: any, right: any) => Number(Boolean(left.done)) - Number(Boolean(right.done)))
              .map(({ action, originalIndex }: any) => {
              const actionKey = `${event.id}:${originalIndex}`;
              const isPending = pendingTimelineActions.includes(actionKey);

              return (
                <div
                  key={`${event.id}-act-${originalIndex}`}
                  className={`text-[11px] ${action.done ? 'text-muted-foreground' : 'rounded-md border border-border/60 bg-background/80 px-2 py-1.5 text-foreground shadow-sm'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isAgent && !event.is_removed ? (
                        isPending ? (
                          <span className="inline-flex h-4 w-4 items-center justify-center text-primary" aria-hidden="true">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          </span>
                        ) : (
                          <Checkbox
                            checked={Boolean(action.done)}
                            disabled={isPending}
                            onCheckedChange={(value) => handleToggleTimelineAction(event.id, originalIndex, Boolean(value))}
                            id={`timeline-action-${event.id}-${originalIndex}`}
                          />
                        )
                      ) : (
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${action.done ? 'bg-primary' : 'bg-muted-foreground/50'}`} />
                      )}
                      <p className="leading-snug">{action.done ? 'FAIT' : 'A FAIRE'} - {action.label}</p>
                    </div>
                  </div>
                  {action.done && (
                    <p className="text-[11px] text-primary">
                      Realisee par {action.done_by_name ?? event.technician?.name ?? 'Technicien'} le {formatDateTime(action.done_at ?? event.happened_at)}
                    </p>
                  )}
                </div>
              );
              })}
          </div>
        </div>
      )}
      {Array.isArray(event.details?.prerequisites) && event.details.prerequisites.length > 0 && (
        <div className="mt-2 rounded-md border border-[#e6892e]/40 bg-[#e6892e]/10 p-2">
          <p className="text-[11px] font-medium text-[#b55f00] dark:text-[#ffb86b]">Prerequis commande</p>
          <div className="mt-1 space-y-1">
            {event.details.prerequisites.map((prereq: any, index: number) => (
              <p key={`${event.id}-pre-${index}`} className="text-[11px] text-muted-foreground">{prereq.met ? 'OK' : 'A verifier'} - {prereq.name}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={ticket.title ?? 'Ticket'} />
      <div className="w-full overflow-x-hidden px-2 py-2 pb-24 sm:px-0 sm:py-4 lg:pb-0">
        {isAgent && (
          <div className="sticky top-0 z-30 mb-3 grid w-full grid-cols-2 gap-1 border-y bg-background/95 py-1 backdrop-blur sm:hidden">
            <Button type="button" size="sm" variant="outline" className="h-8 w-full text-[11px]" onClick={() => document.getElementById('ticket-discussion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Discussion
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 w-full text-[11px]" onClick={() => document.getElementById('ticket-suivi-tech')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Suivi
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 w-full text-[11px]" onClick={() => document.getElementById('commandes-liees')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Commandes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full text-[11px]"
              disabled={!ticket.device}
              onClick={() => document.getElementById('ticket-appareil')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Appareil
            </Button>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/tickets">
            <Button variant="outline" size="sm">
              ← Retour
            </Button>
          </Link>
        </div>
        <div className="mb-3 space-y-2">
          <h1 className="break-words text-xl font-bold tracking-tight sm:text-4xl">{ticket.title ?? 'Ticket'}</h1>

          {isAgent ? (
            <div className="grid gap-2 text-xs lg:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-md border bg-muted/30 px-2 py-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Statut rapide</p>
                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                  {Object.entries(statutLabels).map(([value, label]) => {
                    const isCurrent = formData.status === value;

                    return (
                      <Button
                        key={`quick-status-${value}`}
                        variant="outline"
                        size="sm"
                        className={`h-7 px-2 text-[11px] whitespace-normal ${isCurrent ? statutUI[value]?.btnActive : statutUI[value]?.btn}`}
                        onClick={() => {
                          if (!isCurrent) {
                            handleStatusChange(value);
                          }
                        }}
                        type="button"
                        disabled={pendingStatusValue !== null}
                      >
                        {pendingStatusValue === value ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 px-2 py-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priorite rapide</p>
                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                  {Object.entries(priorityLabels).map(([value, label]) => {
                    const isCurrent = formData.priority === value;

                    return (
                      <Button
                        key={`quick-priority-${value}`}
                        variant="outline"
                        size="sm"
                        className={`h-7 px-2 text-[11px] whitespace-normal ${isCurrent ? priorityUI[value]?.btnActive : priorityUI[value]?.btn}`}
                        onClick={() => {
                          if (!isCurrent) {
                            handlePriorityChange(value);
                          }
                        }}
                        type="button"
                        disabled={pendingPriorityValue !== null}
                      >
                        {pendingPriorityValue === value ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        {label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 px-2 py-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions ticket</p>
                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
                  <Button variant="outline" size="sm" className={ticketActionBtnClass} onClick={() => setIsEditing(true)}>
                    <NotebookPen className="mr-1 h-3.5 w-3.5" />
                    Modifier ticket
                  </Button>
                  <Button variant="outline" size="sm" className={ticketActionBtnClass} onClick={() => setIsAddEventModalOpen(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Ajouter evenement
                  </Button>
                  <Button variant="outline" size="sm" className={ticketActionBtnClass} onClick={openDeviceActionModal}>
                    <Cpu className="mr-1 h-3.5 w-3.5" />
                    Appareil
                  </Button>
                  <Link href={`/commandes/create?ticket_id=${ticket.id}`}>
                    <Button variant="outline" size="sm" className={`${ticketActionBtnClass} w-full sm:w-auto`}>
                      <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                      Ajouter commande
                    </Button>
                  </Link>
                  <Link href={`/tickets/${ticket.id}/print-label`}>
                    <Button variant="outline" size="sm" className={`${ticketActionBtnClass} w-full sm:w-auto`}>
                      <Printer className="mr-1 h-3.5 w-3.5" />
                      Imprimer etiquette
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-2 text-xs sm:grid-cols-2 sm:text-sm lg:grid-cols-4">
              <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                <span className="text-muted-foreground">Ticket:</span>{' '}
                <strong>#{ticket.id}</strong>
              </div>
              <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                <span className="text-muted-foreground">Statut:</span>{' '}
                <Badge className={statutUI[formData.status]?.badge ?? 'bg-muted text-foreground'}>{translateStatus(formData.status)}</Badge>
              </div>
              <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                <span className="text-muted-foreground">Créé le:</span>{' '}
                <strong>{formatDateTime(ticket.created_at)}</strong>
              </div>
              <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                <span className="text-muted-foreground">Assigné:</span>{' '}
                {assigneeHref ? (
                  <Link href={assigneeHref} className="font-semibold link-readable">
                    {ticket.assignee?.name}
                  </Link>
                ) : (
                  <strong>Non assigné</strong>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:hidden">
          {mobileTopInfoCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={`m-${card.title}`} className="border-border/70 bg-muted/20">
                <CardContent className="space-y-1 p-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {card.title}
                  </p>
                  <p className="truncate text-[11px] text-foreground">{card.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mb-4 hidden gap-2 sm:grid sm:grid-cols-2 xl:grid-cols-4">
          {topInfoCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.title} className="border-border/70 bg-muted/20">
                <CardContent className="space-y-1.5 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                    {card.title}
                  </p>
                  {card.lines.map((line, index) => (
                    <p key={`${card.title}-${index}`} className="truncate text-xs text-foreground sm:text-[13px]">{line}</p>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {isAgent && (
          <div className="mb-2 flex flex-wrap gap-1.5 sm:hidden">
            <Badge variant="outline" className="text-[10px]">Age: {operationalInsights.ticketAge}</Badge>
            <Badge
              className={`text-[10px] ${
                operationalInsights.slaLevel === 'critical'
                  ? 'bg-destructive text-destructive-foreground'
                  : operationalInsights.slaLevel === 'watch'
                    ? 'bg-[#e6892e] text-white'
                    : 'bg-[#63d7ca] text-[#141d3a]'
              }`}
            >
              {operationalInsights.slaLevel === 'critical' ? 'SLA critique' : operationalInsights.slaLevel === 'watch' ? 'SLA surveiller' : 'SLA OK'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">Cmd: {operationalInsights.activeCommandesCount}</Badge>
            <Badge variant="outline" className="text-[10px]">Tech: {operationalInsights.technicianActionsCount}</Badge>
          </div>
        )}

        {isAgent && (
          <div className="mb-4 hidden flex-wrap items-center gap-2 sm:flex">
            <Badge variant="outline" className="text-[11px]">
              Age ticket: {operationalInsights.ticketAge}
            </Badge>
            <Badge
              className={
                operationalInsights.slaLevel === 'critical'
                  ? 'bg-destructive text-destructive-foreground'
                  : operationalInsights.slaLevel === 'watch'
                    ? 'bg-[#e6892e] text-white'
                    : 'bg-[#63d7ca] text-[#141d3a]'
              }
            >
              {operationalInsights.slaLevel === 'critical'
                ? 'SLA critique'
                : operationalInsights.slaLevel === 'watch'
                  ? 'SLA a surveiller'
                  : 'SLA OK'}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              Dernier mouvement: {formatElapsedFromNow(operationalInsights.latestActivityAt)}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              Actions tech: {operationalInsights.technicianActionsCount}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              Commandes actives: {operationalInsights.activeCommandesCount}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              {operationalInsights.isAssigned ? 'Technicien assigne' : 'Non assigne'}
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              {operationalInsights.isDeviceLinked ? 'Appareil lie' : 'Sans appareil'}
            </Badge>
          </div>
        )}

        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="order-2 min-w-0 flex flex-col gap-3 xl:order-2">
            {isAgent ? (
              <div className="grid gap-3 xl:grid-cols-2">
                <div id="ticket-discussion" className="min-w-0 scroll-mt-20">
                  <TicketChat
                    ticketId={ticket.id}
                    currentUserId={auth.user?.id}
                    isAgent={isAgent}
                    notifyBy={ticket.notify_by ?? 'None'}
                    contactEmail={ticket.contact_email ?? null}
                    contactPhone={ticket.contact_phone ?? null}
                    requesterEmail={ticket.user?.email ?? null}
                    requesterPhone={ticket.user?.phone ?? null}
                    mentionCandidates={agents}
                  />
                </div>
                <Card
                  id="ticket-suivi-tech"
                  className="w-full max-w-full scroll-mt-20 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-muted/20 shadow-sm"
                >
                  <CardHeader className="pb-4 bg-muted/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <History className="h-4 w-4" />
                        Suivi techniciens
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setIsTimelinePanelOpen(true)}>
                          Historique complet
                        </Button>
                        <Dialog
                          open={isAddEventModalOpen}
                          onOpenChange={(open) => {
                            setIsAddEventModalOpen(open);
                            if (open) { applyPrefillTemplate(manualEventForm.event_type); }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Plus className="h-4 w-4 mr-1" />
                              Ajouter
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[calc(100vw-1rem)] max-w-xl sm:max-w-xl">
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
                                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                                      <Sparkles className="h-3.5 w-3.5" />Pre-rempli actif
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
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {manualEventOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <span className="inline-flex items-center gap-1.5">
                                          {option.enabled ? <Sparkles className="h-3.5 w-3.5 text-primary" /> : null}
                                          <span>{option.label}</span>
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="ms-summary">Resume</Label>
                                <Input id="ms-summary" value={manualEventForm.summary} onChange={(e) => setManualEventForm({ ...manualEventForm, summary: e.target.value })} placeholder="Ex: Diagnostic realise, alimentation HS identifiee" maxLength={500} required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="ms-details">Details</Label>
                                <Textarea id="ms-details" value={manualEventForm.details} onChange={(e) => setManualEventForm({ ...manualEventForm, details: e.target.value })} placeholder="Infos techniques, pieces changees, actions realisees..." rows={4} maxLength={3000} />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="ms-happened-at">Date et heure (optionnel)</Label>
                                <Input id="ms-happened-at" type="datetime-local" value={manualEventForm.happened_at} onChange={(e) => setManualEventForm({ ...manualEventForm, happened_at: e.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>Prerequis (optionnel)</Label>
                                  <Button type="button" variant="ghost" size="sm" onClick={addManualPrerequisite}><Plus className="h-3.5 w-3.5 mr-1" />Ajouter prerequis</Button>
                                </div>
                                {manualPrerequisites.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Aucun prerequis ajoute.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {manualPrerequisites.map((prereq, index) => (
                                      <div key={`msp-${index}`} className="flex items-center gap-2">
                                        <Input value={prereq.name} onChange={(e) => updateManualPrerequisite(index, { name: e.target.value })} placeholder="Ex: Fournisseur renseigne" maxLength={160} />
                                        <Button type="button" variant={prereq.met ? 'default' : 'outline'} size="sm" onClick={() => updateManualPrerequisite(index, { met: !prereq.met })}>{prereq.met ? 'OK' : 'A verifier'}</Button>
                                        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeManualPrerequisite(index)}><X className="h-3.5 w-3.5" /></Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>Actions a realiser (optionnel)</Label>
                                  <Button type="button" variant="ghost" size="sm" onClick={addManualAction}><Plus className="h-3.5 w-3.5 mr-1" />Ajouter action</Button>
                                </div>
                                {predefinedTaskLists.length > 0 && (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Listes predefinies</Label>
                                    <Select onValueChange={applyPredefinedTaskList}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Charger une liste de taches predefinie" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {predefinedTaskLists.map((option) => (
                                          <SelectItem key={`task-list-${option.key}`} value={option.key}>
                                            {option.label} ({option.tasks.length})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                {manualActions.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Aucune action ajoutee.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {manualActions.map((action, index) => (
                                      <div key={`msa-${index}`} className="flex items-center gap-2">
                                        <Input value={action.label} onChange={(e) => updateManualAction(index, { label: e.target.value })} placeholder="Ex: Remplacer le connecteur de charge" maxLength={160} />
                                        <div className="flex items-center gap-1 rounded-md border px-2 py-1">
                                          <Checkbox checked={action.done} onCheckedChange={(value) => updateManualAction(index, { done: Boolean(value) })} id={`manual-action-done-${index}`} />
                                          <Label htmlFor={`manual-action-done-${index}`} className="text-xs">Fait</Label>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeManualAction(index)}><X className="h-3.5 w-3.5" /></Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsAddEventModalOpen(false)} disabled={isAddingTimelineEvent}>Annuler</Button>
                                <Button type="submit" disabled={isAddingTimelineEvent}>
                                  {isAddingTimelineEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  {isAddingTimelineEvent ? 'Ajout...' : 'Ajouter'}
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      <Badge className="bg-primary text-primary-foreground">Suivi prioritaire</Badge>
                      <Badge variant="outline">Dernier mouvement: {formatElapsedFromNow(operationalInsights.latestActivityAt)}</Badge>
                      <Badge variant="outline">Actions tech: {operationalInsights.technicianActionsCount}</Badge>
                      <Badge variant="outline">{operationalInsights.isAssigned ? 'Technicien assigne' : 'Non assigne'}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Apercu immediat des 8 dernieres actions technicien. Ouvrez l'historique pour la vue complete.</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {pendingTimelineTodos.length > 0 && (
                      <div className="mb-3 rounded-xl border border-border/70 bg-background/80 p-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">A faire</p>
                            <p className="text-[11px] text-muted-foreground">Actions technicien non terminees, remontees en premier.</p>
                          </div>
                          <Badge variant="secondary">{pendingTimelineTodos.length} en attente</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {pendingTimelineTodos.map(({ event, action, originalIndex }: any) => (
                            <div
                              key={`pending-todo-${event.id}-${originalIndex}`}
                              className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2"
                            >
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium leading-snug text-foreground">{action.label}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {event.summary} • {event.technician?.name ?? 'Technicien'} • {formatDateTime(event.happened_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 shrink-0"
                                  onClick={() => handleToggleTimelineAction(event.id, originalIndex, true)}
                                >
                                  Fait
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {latestTimelineEvents.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Aucune action technicien enregistrée pour le moment.</div>
                    ) : (
                      <div className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-3">
                        {latestTimelineEvents.map((event: any) => renderTimelineEventItem(event, false))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <TicketChat
                ticketId={ticket.id}
                currentUserId={auth.user?.id}
                isAgent={isAgent}
                notifyBy={ticket.notify_by ?? 'None'}
                contactEmail={ticket.contact_email ?? null}
                contactPhone={ticket.contact_phone ?? null}
                requesterEmail={ticket.user?.email ?? null}
                requesterPhone={ticket.user?.phone ?? null}
                mentionCandidates={agents}
              />
            )}
          </div>

          {isAgent && (
            <Dialog open={isTimelinePanelOpen} onOpenChange={setIsTimelinePanelOpen}>
              <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-hidden sm:max-w-5xl">
                <DialogHeader>
                  <DialogTitle>Historique complet du suivi technicien</DialogTitle>
                  <DialogDescription>
                    Recherchez, filtrez, retirez ou restaurez les événements de suivi pour ce ticket.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-3">
                    <Input value={timelineSearch} onChange={(e) => setTimelineSearch(e.target.value)} placeholder="Rechercher dans le suivi..." />
                    <Select value={timelineTypeFilter} onValueChange={setTimelineTypeFilter}>
                      <SelectTrigger><SelectValue placeholder="Type d'evenement" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les types</SelectItem>
                        {Object.keys(eventTypeLabels).map((eventType) => (
                          <SelectItem key={eventType} value={eventType}>{eventTypeLabels[eventType]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={timelineTechnicianFilter} onValueChange={setTimelineTechnicianFilter}>
                      <SelectTrigger><SelectValue placeholder="Technicien" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les techniciens</SelectItem>
                        {timelineTechnicians.map((technician) => (
                          <SelectItem key={technician.id} value={technician.id}>{technician.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Afficher les événements retirés</Label>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setShowRemovedEvents((value) => !value)}>
                      {showRemovedEvents ? 'Masquer les retirés' : 'Voir les retirés'}
                    </Button>
                  </div>
                  {filteredTimelineEvents.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Aucune action technicien trouvée.</div>
                  ) : (
                    <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-1 sm:pr-2">
                      {filteredTimelineEvents.map((event: any) => renderTimelineEventItem(event, true))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Ticket Details */}
          <div className="order-1 min-w-0 flex flex-col gap-3 xl:order-1">


            <Card className="order-2 min-w-0 w-full max-w-full overflow-hidden xl:order-1">
              <CardHeader className="px-3 pb-2 pt-3 sm:px-6 sm:pb-3 sm:pt-6">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Ticket className="h-4 w-4" />
                    Détails du ticket
                  </CardTitle>
                  {isAgent && !isEditing && (
                    <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
                      Modifier
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-2.5 px-3 pb-3 pt-0 sm:space-y-3 sm:px-6 sm:pb-6">
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
                            <SelectItem key={agent.id} value={agent.id.toString()}>
                              <span className="inline-flex flex-col items-start gap-0.5">
                                <span>{agent.name}</span>
                                {agent.specialities?.length ? (
                                  <span className="text-xs text-muted-foreground">{agent.specialities.join(' · ')}</span>
                                ) : null}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="device">Appareil lié</Label>
                      <Select value={formData.device_id ? formData.device_id.toString() : '0'} onValueChange={(value) => setFormData({ ...formData, device_id: value === '0' ? '' : value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un appareil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Aucun</SelectItem>
                          {userDevices?.map((device: any) => (
                            <SelectItem key={device.id} value={device.id.toString()}>{device.display_name}</SelectItem>
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

                    <div className="grid gap-4 sm:grid-cols-2">
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

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="is_resolved"
                          checked={formData.is_resolved}
                          onChange={(e) => setFormData({ ...formData, is_resolved: e.target.checked })}
                          className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor="is_resolved" className="cursor-pointer">Ticket résolu</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="is_locked"
                          checked={formData.is_locked}
                          onChange={(e) => setFormData({ ...formData, is_locked: e.target.checked })}
                          className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor="is_locked" className="cursor-pointer">Ticket verrouillé</Label>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="submit" disabled={isSavingTicket}>
                        {isSavingTicket
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Save className="mr-2 h-4 w-4" />}
                        {isSavingTicket ? 'Enregistrement...' : 'Enregistrer'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSavingTicket}>
                        Annuler
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="rounded-md border border-[#2a3ff5]/30 bg-[#2a3ff5]/5 p-2.5 sm:p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#2a3ff5]">
                        Description du ticket
                      </p>
                      <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground sm:text-base">
                        {ticket.message || 'Aucune description fournie.'}
                      </p>
                    </div>

                    <div className="grid gap-1.5 text-[12px] sm:grid-cols-2 sm:gap-2 sm:text-sm">
                      <div className="min-w-0 break-words">
                        <span className="text-muted-foreground">Référence:</span>{' '}
                        <strong>#{ticket.id}</strong>
                      </div>
                      <div className="min-w-0 break-words">
                        <span className="text-muted-foreground">Numéro de facture:</span>{' '}
                        <strong>{ticket.invoice_id || '-'}</strong>
                      </div>
                      <div className="min-w-0 break-words">
                        <span className="text-muted-foreground">Créé le:</span>{' '}
                        <strong>{formatDateTime(ticket.created_at)}</strong>
                      </div>
                      <div className="min-w-0 break-words">
                        <span className="text-muted-foreground">Demandeur:</span>{' '}
                        {requesterHref ? (
                          <Link href={requesterHref} className="break-all font-semibold link-readable">
                            {ticket.user?.name}
                          </Link>
                        ) : (
                          <strong>-</strong>
                        )}
                      </div>
                      <div className="min-w-0 break-words">
                        <span className="text-muted-foreground">Agent assigné:</span>{' '}
                        {assigneeHref ? (
                          <Link href={assigneeHref} className="break-all font-semibold link-readable">
                            {ticket.assignee?.name}
                          </Link>
                        ) : (
                          <strong>Non assigné</strong>
                        )}
                      </div>
                      <div className="min-w-0 break-words">
                        <span className="text-muted-foreground">Appareil:</span>{' '}
                        {deviceHref ? (
                          <Link href={deviceHref} className="break-all font-semibold link-readable">
                            {ticket.device?.display_name}
                          </Link>
                        ) : (
                          <strong>Aucun appareil lié</strong>
                        )}
                      </div>
                      <div className="min-w-0 break-words">
                        <span className="text-muted-foreground">MDP appareil:</span>{' '}
                        <strong>
                          {ticket.no_device_password
                            ? 'Aucun mot de passe fourni'
                            : ticket.device_password
                              ? (showTicketPassword ? ticket.device_password : '••••••••••')
                              : '-'}
                        </strong>
                        {!ticket.no_device_password && ticket.device_password && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-1 h-6 px-2"
                            onClick={() => setShowTicketPassword((current) => !current)}
                          >
                            {showTicketPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                        )}
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
                          className="-ml-2 text-xs font-semibold sm:text-sm"
                        >
                          {showMoreInfo ? '− Masquer les informations' : '+ Montrer plus'}
                        </Button>

                        {showMoreInfo && (
                          <div className="space-y-3 mt-3">
                            {ticket.contact_email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Contact:</span>
                                <a href={`mailto:${ticket.contact_email}`} className="link-readable">
                                  {ticket.contact_email}
                                </a>
                              </div>
                            )}

                            {ticket.contact_phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Téléphone:</span>
                                <a href={`tel:${ticket.contact_phone}`} className="link-readable">
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
                                  <Badge variant="default" className="bg-primary">Résolu</Badge>
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

            {ticket.device && (
              <Card id="ticket-appareil" className="order-3 w-full max-w-full scroll-mt-24 overflow-hidden xl:order-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-4 w-4" />
                      Suivi appareil
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{ticket.device.display_name}</Badge>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/devices/${ticket.device.id}`}>Fiche appareil</Link>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="rounded-md border border-border/70 bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mot de passe appareil stocke</p>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <strong>
                        {ticket.device.no_access_password
                          ? 'Aucun mot de passe fourni'
                          : ticket.device.access_password
                            ? (showDevicePassword ? ticket.device.access_password : '••••••••••')
                            : '-'}
                      </strong>
                      {!ticket.device.no_access_password && ticket.device.access_password && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => setShowDevicePassword((current) => !current)}
                        >
                          {showDevicePassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isAgent && (
                    <form onSubmit={handleCreateDeviceEvent} className="space-y-3 rounded-md border p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Type d'intervention</Label>
                          <Select value={deviceEventForm.event_type} onValueChange={(value) => setDeviceEventForm({ ...deviceEventForm, event_type: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="diagnostic">Diagnostic</SelectItem>
                              <SelectItem value="battery_replaced">Batterie remplacée</SelectItem>
                              <SelectItem value="screen_replaced">Ecran remplacé</SelectItem>
                              <SelectItem value="storage_upgraded">Stockage amélioré</SelectItem>
                              <SelectItem value="note">Note technique</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input type="datetime-local" value={deviceEventForm.happened_at} onChange={(e) => setDeviceEventForm({ ...deviceEventForm, happened_at: e.target.value })} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Résumé</Label>
                        <Input
                          value={deviceEventForm.summary}
                          onChange={(e) => setDeviceEventForm({ ...deviceEventForm, summary: e.target.value })}
                          placeholder="Ex: Batterie remplacée"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Détails</Label>
                        <Textarea
                          value={deviceEventForm.details}
                          onChange={(e) => setDeviceEventForm({ ...deviceEventForm, details: e.target.value })}
                          rows={3}
                          placeholder="Pièce utilisée, tests, observations..."
                        />
                      </div>

                      <Button type="submit" size="sm" disabled={isAddingDeviceEvent}>
                        {isAddingDeviceEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isAddingDeviceEvent ? 'Ajout...' : 'Ajouter au suivi appareil'}
                      </Button>
                    </form>
                  )}

                  {deviceEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune intervention enregistrée sur cet appareil.</p>
                  ) : (
                    <div className="space-y-2">
                      {deviceEvents.map((event: any) => (
                        <div key={event.id} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">{event.summary}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{event.event_type}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDateTime(event.happened_at)}</span>
                            </div>
                          </div>
                          {event.details?.note && (
                            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{event.details.note}</p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {event.ticket_id ? `Ticket #${event.ticket_id}` : 'Hors ticket'}
                            {event.technician?.name ? ` - ${event.technician.name}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Commandes Section - Only for agents */}
            {isAgent && (
              <Card id="commandes-liees" className="order-1 min-w-0 w-full max-w-full scroll-mt-24 overflow-hidden xl:order-2">
                <CardHeader className="bg-muted/10 px-3 pb-2 pt-3 sm:px-6 sm:pb-3 sm:pt-6">
                  <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <ShoppingCart className="h-4 w-4" />
                      Commandes liées
                    </CardTitle>
                    <Link href={`/commandes/create?ticket_id=${ticket.id}`}>
                      <Button size="sm" variant="outline" className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm">
                        <Plus className="h-3 w-3 mr-1" />
                        Nouvelle
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="min-w-0 px-3 pb-3 pt-0 sm:px-6 sm:pb-6">
                  {commandes && commandes.length > 0 ? (
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {commandes.map((commande: any) => (
                        <div
                          key={commande.id}
                          className="flex flex-col gap-1.5 rounded border p-1.5 text-xs transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:p-2 sm:text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-1.5 sm:gap-2">
                              <Link
                                href={`/commandes/${commande.id}`}
                                className="truncate break-all font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                              >
                                {commande.nom}
                              </Link>
                              <Badge className={
                                commande.statut === 'traité' ? 'status-badge-traite text-xs' :
                                commande.statut === 'réceptionner' ? 'status-badge-reception text-xs' :
                                commande.statut === 'commandé' ? 'status-badge-commande text-xs' :
                                commande.statut === 'panier' ? 'status-badge-panier text-xs' :
                                'status-badge-new text-xs'
                              }>
                                {commande.statut === 'new' ? 'Nouveau' :
                                 commande.statut === 'panier' ? 'Panier' :
                                 commande.statut === 'commandé' ? 'Commandé' :
                                 commande.statut === 'réceptionner' ? 'Réceptionné' :
                                 'Traité'}
                              </Badge>
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground sm:text-xs">
                              <Link href={`/commandes/${commande.id}`} className="break-all font-mono link-readable">
                                {commande.command_number}
                              </Link>
                              {' • '}
                              <span className="break-words">{commande.fournisseur}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 self-end sm:ml-2 sm:self-auto">
                            <Link href={`/commandes/${commande.id}`}>
                              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[11px] sm:h-7 sm:px-2 sm:text-xs">
                                Voir
                              </Button>
                            </Link>
                            <Link href={`/commandes/${commande.id}/edit`}>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 sm:h-7 sm:w-7">
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




          </div>
        </div>

        {/* User and Assignee Information - Side by side */}
        <div className="mt-4 grid gap-3 md:mt-6 md:grid-cols-2 md:[&>*]:h-full">
          {/* User Information */}
          <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Demandeur
                  </CardTitle>
                  {requesterHref && (
                    <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                      <Link href={requesterHref}>Ouvrir la fiche</Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {ticket.user ? (
                  <>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {requesterHref ? (
                        <Link href={requesterHref} className="font-medium link-readable">
                          {ticket.user.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{ticket.user.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${ticket.user.email}`} className="link-readable">
                        {ticket.user.email}
                      </a>
                    </div>
                    {ticket.user.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${ticket.user.phone}`} className="link-readable">
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
                  </>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Demandeur introuvable.
                  </div>
                )}
                {isAgent && ticket.user && (
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
                          <Button size="sm" onClick={handleSaveNote} disabled={isSavingInternalNote}>
                            {isSavingInternalNote
                              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              : <Check className="h-4 w-4 mr-1" />}
                            {isSavingInternalNote ? 'Sauvegarde...' : 'Sauvegarder'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSavingInternalNote}
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

          {/* Assignee Information */}
          <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Agent assigné
                  </CardTitle>
                  {assigneeHref && (
                    <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                      <Link href={assigneeHref}>Ouvrir la fiche</Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {ticket.assignee ? (
                  <>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {assigneeHref ? (
                        <Link href={assigneeHref} className="font-medium link-readable">
                          {ticket.assignee.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{ticket.assignee.name}</span>
                      )}
                    </div>
                    {ticket.assignee.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${ticket.assignee.phone}`} className="link-readable">
                          {ticket.assignee.phone}
                        </a>
                      </div>
                    )}
                    {isAgent && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${ticket.assignee.email}`} className="link-readable">
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
                  </>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Aucun agent assigné pour le moment.
                  </div>
                )}
              </CardContent>
            </Card>
        </div>

        {isDeviceActionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeDeviceActionModal}>
            <div className="w-full max-w-2xl rounded-lg border bg-background shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="text-base font-semibold">Appareil du ticket #{ticket.id}</h3>
                <Button type="button" variant="ghost" size="sm" onClick={closeDeviceActionModal}>
                  Fermer
                </Button>
              </div>

              <div className="space-y-4 p-4">
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Lier un appareil existant</p>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={deviceIdToAttach}
                    onChange={(e) => setDeviceIdToAttach(e.target.value)}
                  >
                    <option value="">-- Aucun appareil --</option>
                    {userDevices?.map((device: any) => (
                      <option key={device.id} value={device.id}>{device.display_name}</option>
                    ))}
                  </select>
                  <Button type="button" size="sm" onClick={handleAttachDeviceFromActions} disabled={isAttachingDevice}>
                    {isAttachingDevice ? 'En cours...' : 'Enregistrer'}
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Créer puis lier un appareil</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Type</Label>
                      <select
                        className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newDeviceForm.device_type}
                        onChange={(e) => setNewDeviceForm({ ...newDeviceForm, device_type: e.target.value })}
                      >
                        <option value="computer">Ordinateur</option>
                        <option value="phone">Téléphone</option>
                        <option value="tablet">Tablette</option>
                        <option value="other">Autre</option>
                      </select>
                    </div>
                    <div>
                      <Label>Marque</Label>
                      <Input value={newDeviceForm.brand} onChange={(e) => setNewDeviceForm({ ...newDeviceForm, brand: e.target.value })} />
                    </div>
                    <div>
                      <Label>Modèle *</Label>
                      <Input value={newDeviceForm.model} onChange={(e) => setNewDeviceForm({ ...newDeviceForm, model: e.target.value })} />
                    </div>
                    <div>
                      <Label>Numéro de série</Label>
                      <Input value={newDeviceForm.serial_number} onChange={(e) => setNewDeviceForm({ ...newDeviceForm, serial_number: e.target.value })} />
                    </div>
                    <div>
                      <Label>Numero de suivi</Label>
                      <Input value={newDeviceForm.asset_tag} onChange={(e) => setNewDeviceForm({ ...newDeviceForm, asset_tag: e.target.value })} />
                    </div>
                    <div>
                      <Label>Date d'achat</Label>
                      <Input type="date" value={newDeviceForm.purchase_date} onChange={(e) => setNewDeviceForm({ ...newDeviceForm, purchase_date: e.target.value })} />
                    </div>
                    <div>
                      <Label>Fin de garantie</Label>
                      <Input type="date" value={newDeviceForm.warranty_end_date} onChange={(e) => setNewDeviceForm({ ...newDeviceForm, warranty_end_date: e.target.value })} />
                    </div>
                  </div>
                  <Button type="button" size="sm" onClick={handleCreateDeviceFromActions} disabled={isCreatingDevice || !newDeviceForm.model.trim()}>
                    {isCreatingDevice ? 'Creation...' : 'Creer et lier'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <MobileNativeNav fabHref="/tickets/create" fabLabel="Nouveau ticket" />
    </AppLayout>
  );
}

