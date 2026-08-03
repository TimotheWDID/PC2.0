import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import AppLayout from '@/layouts/app-layout'
import Heading from '@/components/heading'
import { type BreadcrumbItem } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTimeFr } from '@/lib/datetime'

type Ticket = {
  id: number
  title: string
  description: string | null
  category: 'bug' | 'improvement'
  category_label: string
  created_at: string | null
  processed_at: string | null
  processed_by: {
    id: number
    name: string
    email: string | null
  } | null
  requester: {
    id: number
    name: string
    email: string | null
  } | null
}

export default function ShowInternalTicket({ ticket, canProcess }: { ticket: Ticket; canProcess: boolean }) {
  const [processing, setProcessing] = useState(false)
  const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? ''

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Tickets internes', href: '/internal-tickets' },
    { title: ticket.title, href: `/internal-tickets/${ticket.id}` },
  ]

  const handleProcess = () => {
    // Use method spoofing for better compatibility on hosts that restrict PATCH requests.
    setProcessing(true)
    router.post(`/internal-tickets/${ticket.id}/process`, {
      _method: 'patch',
      ...(csrfToken ? { _token: csrfToken } : {}),
    }, {
      onFinish: () => setProcessing(false),
    })
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={ticket.title} />
      <div className="py-4 w-full">
        <Heading title={ticket.title} description="Détail d'un ticket interne." />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <CardTitle>{ticket.title}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={ticket.category === 'bug' ? 'destructive' : 'secondary'}>{ticket.category_label}</Badge>
                {ticket.processed_at ? <Badge variant="outline">Traite</Badge> : null}
              </div>
            </div>
            <div className="flex gap-2">
              {canProcess && !ticket.processed_at ? (
                <Button type="button" onClick={handleProcess} disabled={processing}>Marquer comme traite</Button>
              ) : null}
              <Button asChild variant="secondary">
                <Link href="/internal-tickets">Retour à la liste</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-foreground">Demandeur</div>
              <div className="text-sm text-muted-foreground">{ticket.requester?.name || 'Inconnu'}</div>
              {ticket.requester?.email ? <div className="text-sm text-muted-foreground">{ticket.requester.email}</div> : null}
            </div>
            {ticket.processed_at ? (
              <div>
                <div className="text-sm font-medium text-foreground">Traitement</div>
                <div className="text-sm text-muted-foreground">Traite le {formatDateTimeFr(ticket.processed_at)}</div>
                {ticket.processed_by ? <div className="text-sm text-muted-foreground">Par {ticket.processed_by.name}</div> : null}
              </div>
            ) : null}
            <div>
              <div className="text-sm font-medium text-foreground">Créé le</div>
              <div className="text-sm text-muted-foreground">{formatDateTimeFr(ticket.created_at)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">Description</div>
              <div className="mt-2 whitespace-pre-wrap rounded-md border border-border/70 bg-muted/20 p-4 text-sm text-foreground">
                {ticket.description || 'Aucune description fournie.'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
