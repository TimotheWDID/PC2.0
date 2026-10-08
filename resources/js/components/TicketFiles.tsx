import React from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateTimeFr } from '@/lib/datetime';
import { Download, Eye, EyeOff, FileText, Loader2, Lock, MessageSquare, Paperclip, Send, Trash2, Upload, Users } from 'lucide-react';

type Visibility = 'internal' | 'external';

type TicketFileItem = {
  id: number;
  source: 'ticket' | 'chat';
  name: string;
  mime_type: string | null;
  size: number;
  visibility: Visibility;
  created_at: string | null;
  uploaded_by: string | null;
  last_sent_at: string | null;
  last_sent_to: string | null;
  download_path: string;
};

type TicketFilesProps = {
  ticketId: number;
  isAgent: boolean;
  magicToken?: string | null;
  className?: string;
};

type Filter = 'all' | Visibility;

// Must stay aligned with TicketFileController::MAX_KB / MAX_COUNT.
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILE_COUNT = 10;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const fileKey = (file: TicketFileItem) => `${file.source}-${file.id}`;

const errorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
    return firstError ?? data?.message ?? fallback;
  }
  return fallback;
};

export default function TicketFiles({ ticketId, isAgent, magicToken = null, className }: TicketFilesProps) {
  const [files, setFiles] = React.useState<TicketFileItem[]>([]);
  const [customerEmail, setCustomerEmail] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadVisibility, setUploadVisibility] = React.useState<Visibility>('internal');
  const [filter, setFilter] = React.useState<Filter>('all');
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [busyFileId, setBusyFileId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false);
  const [sendEmail, setSendEmail] = React.useState('');
  const [sendMessage, setSendMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const withMagicToken = React.useCallback(
    (path: string): string => {
      if (!magicToken) return path;
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}token=${encodeURIComponent(magicToken)}`;
    },
    [magicToken],
  );

  const loadFiles = React.useCallback(async () => {
    try {
      const response = await axios.get(withMagicToken(`/tickets/${ticketId}/files`));
      setFiles(response.data.files ?? []);
      setCustomerEmail(response.data.customer_email ?? null);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Impossible de charger les fichiers.'));
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, withMagicToken]);

  React.useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const replaceFiles = (updated: TicketFileItem[]) => {
    setFiles((current) =>
      current.map((file) => updated.find((candidate) => fileKey(candidate) === fileKey(file)) ?? file),
    );
  };

  const uploadFiles = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (picked.length === 0) return;

    setError(null);
    setNotice(null);

    if (picked.length > MAX_FILE_COUNT) {
      setError(`${MAX_FILE_COUNT} fichiers maximum par envoi.`);
      return;
    }

    const tooBig = picked.find((file) => file.size > MAX_FILE_SIZE);
    if (tooBig) {
      setError(`${tooBig.name} depasse 20 Mo.`);
      return;
    }

    const formData = new FormData();
    picked.forEach((file) => formData.append('files[]', file));
    formData.append('visibility', uploadVisibility);

    setIsUploading(true);
    try {
      const response = await axios.post(`/tickets/${ticketId}/files`, formData);
      setFiles((current) => [...(response.data.files ?? []), ...current]);
      setNotice(
        uploadVisibility === 'external'
          ? 'Fichier(s) ajoute(s), visibles par le client.'
          : 'Fichier(s) ajoute(s) en interne.',
      );
    } catch (uploadError) {
      setError(errorMessage(uploadError, "L'envoi du fichier a echoue."));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleVisibility = async (file: TicketFileItem) => {
    const next: Visibility = file.visibility === 'internal' ? 'external' : 'internal';
    setBusyFileId(file.id);
    setError(null);
    try {
      const response = await axios.patch(`/tickets/${ticketId}/files/${file.id}`, { visibility: next });
      replaceFiles([response.data.file]);
    } catch (toggleError) {
      setError(errorMessage(toggleError, 'Impossible de modifier la visibilite.'));
    } finally {
      setBusyFileId(null);
    }
  };

  const deleteFile = async (file: TicketFileItem) => {
    if (!window.confirm(`Supprimer definitivement ${file.name} ?`)) return;
    setBusyFileId(file.id);
    setError(null);
    try {
      await axios.delete(`/tickets/${ticketId}/files/${file.id}`);
      setFiles((current) => current.filter((candidate) => fileKey(candidate) !== fileKey(file)));
      setSelectedIds((current) => current.filter((id) => id !== file.id));
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Impossible de supprimer le fichier.'));
    } finally {
      setBusyFileId(null);
    }
  };

  const openSendDialog = (ids: number[]) => {
    setSelectedIds(ids);
    setSendEmail(customerEmail ?? '');
    setSendMessage('');
    setError(null);
    setNotice(null);
    setSendDialogOpen(true);
  };

  const sendFiles = async () => {
    setIsSending(true);
    setError(null);
    try {
      const response = await axios.post(`/tickets/${ticketId}/files/send`, {
        file_ids: selectedIds,
        email: sendEmail.trim(),
        message: sendMessage.trim() || null,
      });
      replaceFiles(response.data.files ?? []);
      setNotice(
        response.data.attached
          ? `Email envoye a ${sendEmail.trim()} avec les fichiers en piece jointe.`
          : `Email envoye a ${sendEmail.trim()} avec un lien de telechargement (fichiers trop volumineux pour etre joints).`,
      );
      setSelectedIds([]);
      setSendDialogOpen(false);
    } catch (sendError) {
      setError(errorMessage(sendError, "L'email n'a pas pu etre envoye."));
    } finally {
      setIsSending(false);
    }
  };

  const visibleFiles = files.filter((file) => filter === 'all' || file.visibility === filter);
  const ticketFiles = files.filter((file) => file.source === 'ticket');
  const selectedFiles = ticketFiles.filter((file) => selectedIds.includes(file.id));
  const selectedHaveInternal = selectedFiles.some((file) => file.visibility === 'internal');
  const counts = {
    all: files.length,
    internal: files.filter((file) => file.visibility === 'internal').length,
    external: files.filter((file) => file.visibility === 'external').length,
  };

  // Customers only see the card when something was shared with them.
  if (!isAgent && !isLoading && files.length === 0) {
    return null;
  }

  return (
    <Card
      id="ticket-fichiers"
      className={`w-full max-w-full scroll-mt-24 overflow-hidden ${isDragging ? 'ring-2 ring-primary' : ''} ${className ?? ''}`}
      onDragOver={
        isAgent
          ? (event) => {
              event.preventDefault();
              setIsDragging(true);
            }
          : undefined
      }
      onDragLeave={isAgent ? () => setIsDragging(false) : undefined}
      onDrop={
        isAgent
          ? (event) => {
              event.preventDefault();
              setIsDragging(false);
              uploadFiles(event.dataTransfer.files);
            }
          : undefined
      }
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" />
            {isAgent ? 'Fichiers' : 'Documents'}
            {files.length > 0 && <Badge variant="outline">{files.length}</Badge>}
          </CardTitle>
          {isAgent && selectedIds.length > 0 && (
            <Button type="button" size="sm" onClick={() => openSendDialog(selectedIds)}>
              <Send className="mr-1 h-3.5 w-3.5" />
              Envoyer au client ({selectedIds.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isAgent && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2">
            <div className="flex overflow-hidden rounded-md border text-xs">
              <button
                type="button"
                className={`flex items-center gap-1 px-2 py-1 ${uploadVisibility === 'internal' ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
                onClick={() => setUploadVisibility('internal')}
              >
                <Lock className="h-3 w-3" />
                Interne
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 border-l px-2 py-1 ${uploadVisibility === 'external' ? 'bg-sky-100 font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200' : 'text-muted-foreground'}`}
                onClick={() => setUploadVisibility('external')}
              >
                <Users className="h-3 w-3" />
                Visible client
              </button>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
              {isUploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
              Ajouter des fichiers
            </Button>
            <span className="text-[11px] text-muted-foreground">ou glissez-les ici (20 Mo max par fichier)</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => event.target.files && uploadFiles(event.target.files)}
            />
          </div>
        )}

        {isAgent && files.length > 0 && (
          <div className="flex flex-wrap gap-1 text-xs">
            {(
              [
                ['all', 'Tous'],
                ['internal', 'Internes'],
                ['external', 'Client'],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-full border px-2 py-0.5 ${filter === value ? 'border-primary bg-primary/10 font-semibold' : 'text-muted-foreground'}`}
                onClick={() => setFilter(value)}
              >
                {label} ({counts[value]})
              </button>
            ))}
          </div>
        )}

        {error && <p className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        {notice && <p className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
          </p>
        ) : visibleFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isAgent ? 'Aucun fichier sur ce ticket. Ajoutez un fichier interne (visible des techniciens) ou visible par le client.' : 'Aucun document.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {visibleFiles.map((file) => {
              const isTicketFile = file.source === 'ticket';
              const isBusy = isTicketFile && busyFileId === file.id;

              return (
                <li key={fileKey(file)} className="flex items-start gap-2 rounded-md border p-2">
                  {isAgent && (
                    <Checkbox
                      className="mt-1"
                      disabled={!isTicketFile}
                      checked={isTicketFile && selectedIds.includes(file.id)}
                      onCheckedChange={(checked) =>
                        setSelectedIds((current) =>
                          checked ? [...current, file.id] : current.filter((id) => id !== file.id),
                        )
                      }
                      aria-label={`Selectionner ${file.name}`}
                    />
                  )}
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <a href={withMagicToken(file.download_path)} className="block truncate text-sm font-medium hover:underline" title={file.name}>
                      {file.name}
                    </a>
                    <p className="text-[11px] text-muted-foreground">
                      {formatFileSize(file.size)}
                      {file.created_at ? ` · ${formatDateTimeFr(file.created_at, { timeZone: 'Europe/Paris' })}` : ''}
                      {isAgent && file.uploaded_by ? ` · ${file.uploaded_by}` : ''}
                    </p>
                    {isAgent && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {file.visibility === 'internal' ? (
                          <Badge variant="outline" className="text-[10px]">
                            <Lock className="mr-1 h-3 w-3" /> Interne
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-sky-400 text-[10px] text-sky-700 dark:text-sky-300">
                            <Users className="mr-1 h-3 w-3" /> Visible client
                          </Badge>
                        )}
                        {!isTicketFile && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            <MessageSquare className="mr-1 h-3 w-3" /> Discussion
                          </Badge>
                        )}
                        {file.last_sent_at && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            Envoye le {formatDateTimeFr(file.last_sent_at, { timeZone: 'Europe/Paris' })}
                            {file.last_sent_to ? ` a ${file.last_sent_to}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isAgent && isTicketFile && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          title="Envoyer au client"
                          disabled={isBusy}
                          onClick={() => openSendDialog([file.id])}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          title={file.visibility === 'internal' ? 'Rendre visible au client' : 'Repasser en interne'}
                          disabled={isBusy}
                          onClick={() => toggleVisibility(file)}
                        >
                          {file.visibility === 'internal' ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    )}
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2" title="Telecharger">
                      <a href={withMagicToken(file.download_path)}>
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    {isAgent && isTicketFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground"
                        title="Supprimer"
                        disabled={isBusy}
                        onClick={() => deleteFile(file)}
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {isAgent && (
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Envoyer au client</DialogTitle>
              <DialogDescription>
                Les fichiers sont envoyes par email (en piece jointe jusqu'a 10 Mo au total, sinon via un lien) et restent disponibles sur la page du ticket du client.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <ul className="space-y-1 text-sm">
                {selectedFiles.map((file) => (
                  <li key={file.id} className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</span>
                  </li>
                ))}
              </ul>
              {selectedHaveInternal && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  Certains fichiers sont internes : ils deviendront visibles par le client apres l'envoi.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="ticket-files-email">Email du client</Label>
                <Input
                  id="ticket-files-email"
                  type="email"
                  value={sendEmail}
                  onChange={(event) => setSendEmail(event.target.value)}
                  placeholder="client@exemple.fr"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ticket-files-message">Message (facultatif)</Label>
                <Textarea
                  id="ticket-files-message"
                  rows={4}
                  value={sendMessage}
                  onChange={(event) => setSendMessage(event.target.value)}
                  placeholder="Bonjour, vous trouverez ci-joint..."
                  maxLength={5000}
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSendDialogOpen(false)} disabled={isSending}>
                Annuler
              </Button>
              <Button type="button" onClick={sendFiles} disabled={isSending || selectedFiles.length === 0 || sendEmail.trim() === ''}>
                {isSending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                Envoyer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
