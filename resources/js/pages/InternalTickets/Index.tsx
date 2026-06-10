import { Head, Link } from '@inertiajs/react'
import AppLayout from '@/layouts/app-layout'
import Heading from '@/components/heading'
import { type BreadcrumbItem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type InternalTicket = {
  id: number
  title: string
  description: string | null
  category: 'bug' | 'improvement'
  category_label: string
  created_at: string | null
  processed_at: string | null
  processed_by: string | null
  requester: {
    id: number
    name: string
    email: string | null
  } | null
}

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Tickets internes', href: '/internal-tickets' },
]

export default function InternalTicketsIndex({ tickets, isAgent, showProcessed }: { tickets: InternalTicket[]; isAgent: boolean; showProcessed: boolean }) {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Tickets internes" />
      <div className="py-4 w-full">
        <Heading
          title="Tickets internes"
          description={isAgent ? 'Suivi interne des bugs et propositions d\'amelioration.' : 'Vos signalements internes de bugs et d\'ameliorations.'}
        />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{showProcessed ? 'Tickets internes traites' : 'Tickets internes a traiter'}</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              {isAgent ? (
                <Button asChild variant="outline">
                  <Link href={showProcessed ? '/internal-tickets' : '/internal-tickets?show_processed=1'}>
                    {showProcessed ? 'Masquer les traites' : 'Afficher les traites'}
                  </Link>
                </Button>
              ) : null}
              <Button asChild>
                <Link href="/internal-tickets/create">Nouveau ticket interne</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tickets.length === 0 ? (
              <div className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
                {showProcessed ? 'Aucun ticket interne traite.' : 'Aucun ticket interne a traiter pour le moment.'}
              </div>
            ) : (
              tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/internal-tickets/${ticket.id}`}
                  className="block rounded-xl border border-border/70 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{ticket.title}</span>
                        <Badge variant={ticket.category === 'bug' ? 'destructive' : 'secondary'}>
                          {ticket.category_label}
                        </Badge>
                        {ticket.processed_at ? <Badge variant="outline">Traite</Badge> : null}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {ticket.description || 'Aucune description fournie.'}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground sm:text-right">
                      <div>{ticket.requester?.name || 'Demandeur inconnu'}</div>
                      <div>{ticket.created_at || '-'}</div>
                      {ticket.processed_at ? <div>Traite par {ticket.processed_by || 'agent'}</div> : null}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
