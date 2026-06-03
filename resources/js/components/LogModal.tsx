import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { History } from 'lucide-react';
import { formatDateTimeFr } from '@/lib/datetime';

interface LogModalProps {
  subjectType: string;
  subjectId: number;
  buttonVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  buttonText?: string;
}

export default function LogModal({
  subjectType,
  subjectId,
  buttonVariant = 'ghost',
  buttonSize = 'icon',
  buttonText = '',
}: LogModalProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      // TODO: Implémenter l'appel API pour récupérer les logs
      // const response = await axios.get(`/api/logs/${subjectType}/${subjectId}`);
      // setLogs(response.data);
      setLogs([]);
    } catch (error) {
      console.error('Erreur lors du chargement des logs', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      loadLogs();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} title="Historique">
          {buttonText || <History className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique des modifications</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="border-b pb-4 last:border-b-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium">{log.description}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTimeFr(log.created_at, { timeZone: 'Europe/Paris' })}
                  </div>
                </div>
                {log.properties && (
                  <div className="text-sm text-muted-foreground">
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(log.properties, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Aucun historique disponible
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
