import React, { useState } from 'react';
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
import { User, Mail, Phone, FolderOpen, UserCheck, MapPin, Save, Edit, Check, X, Plus, ShoppingCart } from 'lucide-react';
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
    btn: 'border border-[#2a3ff5] text-[#141d3a] bg-white hover:bg-[#f3f4f6]',
    btnActive: 'bg-[#2a3ff5] text-white border border-[#2a3ff5] shadow-sm',
  },
  in_progress: {
    badge: 'bg-[#63d7ca] text-[#141d3a]',
    btn: 'border border-[#63d7ca] text-[#141d3a] bg-white hover:bg-[#e8f4f2]',
    btnActive: 'bg-[#63d7ca] text-[#141d3a] border border-[#63d7ca] shadow-sm',
  },
  pending: {
    badge: 'bg-[#b3b6bf] text-[#141d3a]',
    btn: 'border border-[#b3b6bf] text-[#141d3a] bg-white hover:bg-[#f3f4f6]',
    btnActive: 'bg-[#b3b6bf] text-[#141d3a] border border-[#b3b6bf] shadow-sm',
  },
  resolved: {
    badge: 'bg-[#141d3a] text-white',
    btn: 'border border-[#141d3a] text-[#141d3a] bg-white hover:bg-[#e5e7eb]',
    btnActive: 'bg-[#141d3a] text-white border border-[#141d3a] shadow-sm',
  },
  closed: {
    badge: 'bg-[#f3f4f6] text-[#141d3a] border border-[#b3b6bf]',
    btn: 'border border-[#b3b6bf] text-[#141d3a] bg-white hover:bg-[#f3f4f6]',
    btnActive: 'bg-[#f3f4f6] text-[#141d3a] border border-[#b3b6bf] shadow-sm',
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
    btn: 'border border-[#b3b6bf] text-[#141d3a] bg-white hover:bg-[#f3f4f6]',
    btnActive: 'bg-[#b3b6bf] text-[#141d3a] border border-[#b3b6bf] shadow-sm',
  },
  medium: {
    badge: 'bg-[#63d7ca] text-[#141d3a]',
    btn: 'border border-[#63d7ca] text-[#141d3a] bg-white hover:bg-[#e8f4f2]',
    btnActive: 'bg-[#63d7ca] text-[#141d3a] border border-[#63d7ca] shadow-sm',
  },
  high: {
    badge: 'bg-[#2a3ff5] text-white',
    btn: 'border border-[#2a3ff5] text-[#141d3a] bg-white hover:bg-[#e5e7eb]',
    btnActive: 'bg-[#2a3ff5] text-white border border-[#2a3ff5] shadow-sm',
  },
};

export default function Show({ ticket, categories, agents, commandes }: any) {
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

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Tickets', href: '/tickets' },
    { title: ticket.title ?? 'Ticket', href: `/tickets/${ticket.id}` },
  ];

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
    router.patch(`/tickets/${ticket.id}/status`, { status: newStatus }, {
      preserveScroll: true,
      onSuccess: () => {
        setFormData({ ...formData, status: newStatus });
      },
    });
  };

  const handlePriorityChange = (newPriority: string) => {
    router.patch(`/tickets/${ticket.id}/priority`, { priority: newPriority }, {
      preserveScroll: true,
      onSuccess: () => {
        setFormData({ ...formData, priority: newPriority });
      },
    });
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={ticket.title ?? 'Ticket'} />
      <div className="py-4 w-full">
        <div className="mb-4">
          <Link href="/tickets">
            <Button variant="outline" size="sm">
              ← Retour
            </Button>
          </Link>
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
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Statut actuel</div>
                  <Badge className={statutUI[formData.status]?.badge}>
                    {statutLabels[formData.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statutLabels).map(([value, label]) => {
                    const isCurrent = formData.status === value;

                    return (
                      <Button
                        key={value}
                        variant={isCurrent ? 'default' : 'outline'}
                        onClick={() => handleStatusChange(value)}
                        disabled={isCurrent}
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
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Priorité actuelle</div>
                  <Badge className={priorityUI[formData.priority]?.badge}>
                    {priorityLabels[formData.priority]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(priorityLabels).map(([value, label]) => {
                    const isCurrent = formData.priority === value;

                    return (
                      <Button
                        key={value}
                        variant={isCurrent ? 'default' : 'outline'}
                        onClick={() => handlePriorityChange(value)}
                        disabled={isCurrent}
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="status">Statut</Label>
                        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Ouvert</SelectItem>
                            <SelectItem value="in_progress">En cours</SelectItem>
                            <SelectItem value="pending">En attente</SelectItem>
                            <SelectItem value="resolved">Résolu</SelectItem>
                            <SelectItem value="closed">Fermé</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority">Priorité</Label>
                        <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Basse</SelectItem>
                            <SelectItem value="medium">Moyenne</SelectItem>
                            <SelectItem value="high">Haute</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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

                    <div className="flex flex-wrap items-center gap-4">
                      <div>Créé le: <strong>{ticket.created_at ?? '-'}</strong></div>
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
