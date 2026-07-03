import React, { useMemo, useState } from 'react'
import { Head, router } from '@inertiajs/react'
import AppLayout from '@/layouts/app-layout'
import Heading from '@/components/heading'
import MobileNativeNav from '@/components/mobile-native-nav'
import { type BreadcrumbItem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { formatDateTimeFr } from '@/lib/datetime'

type TicketRow = {
  id: number
  title: string | null
  status: string | null
  priority: string | null
  created_at: string | null
  requester: string | null
  assignee_id: number | null
  assignee_name: string | null
}

type AgentRow = {
  id: number
  name: string
  email: string | null
  is_admin: boolean
  active_tickets_count: number
}

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard admin', href: '/admin/dashboard' },
  { title: 'Distribution tickets', href: '/tickets/bulk-distribution' },
]

export default function BulkAssign({ tickets, agents }: { tickets: TicketRow[]; agents: AgentRow[] }) {
  const [query, setQuery] = useState('')
  const [selectedTicketIds, setSelectedTicketIds] = useState<number[]>([])
  const [singleAgentId, setSingleAgentId] = useState('')
  const [roundRobinAgentIds, setRoundRobinAgentIds] = useState<number[]>([])
  const [manualAssignments, setManualAssignments] = useState<Record<number, string>>({})
  const [pendingMode, setPendingMode] = useState<'single' | 'round_robin' | 'manual' | null>(null)

  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tickets
    return tickets.filter((ticket) => {
      return (
        ticket.id.toString().includes(q) ||
        (ticket.title || '').toLowerCase().includes(q) ||
        (ticket.requester || '').toLowerCase().includes(q) ||
        (ticket.assignee_name || '').toLowerCase().includes(q)
      )
    })
  }, [query, tickets])

  const toggleTicket = (ticketId: number) => {
    setSelectedTicketIds((current) =>
      current.includes(ticketId) ? current.filter((id) => id !== ticketId) : [...current, ticketId],
    )
  }

  const assignSingle = () => {
    if (!singleAgentId || selectedTicketIds.length === 0) return
    if (pendingMode !== null) return

    setPendingMode('single')
    router.post('/tickets/bulk-distribution', {
      mode: 'single',
      ticket_ids: selectedTicketIds,
      single_agent_id: Number(singleAgentId),
    }, {
      onFinish: () => setPendingMode(null),
    })
  }

  const assignRoundRobin = () => {
    if (roundRobinAgentIds.length === 0 || selectedTicketIds.length === 0) return
    if (pendingMode !== null) return

    setPendingMode('round_robin')
    router.post('/tickets/bulk-distribution', {
      mode: 'round_robin',
      ticket_ids: selectedTicketIds,
      agent_ids: roundRobinAgentIds,
    }, {
      onFinish: () => setPendingMode(null),
    })
  }

  const assignManual = () => {
    const payload = Object.entries(manualAssignments)
      .filter(([, assigneeId]) => assigneeId)
      .map(([ticketId, assigneeId]) => ({
        ticket_id: Number(ticketId),
        assignee_id: Number(assigneeId),
      }))

    if (payload.length === 0) return
    if (pendingMode !== null) return

    setPendingMode('manual')

    router.post('/tickets/bulk-distribution', {
      mode: 'manual',
      manual_assignments: payload,
    }, {
      onFinish: () => setPendingMode(null),
    })
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Distribution massive des tickets" />
      <div className="space-y-4 py-2 sm:py-4">
        <Heading title="Distribution massive" description="Attribuez plusieurs tickets en un seul flux admin" />

        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Attribution simple</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Tous les tickets selectionnes seront attribues au meme agent.</p>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={singleAgentId}
                onChange={(e) => setSingleAgentId(e.target.value)}
              >
                <option value="">Choisir un agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name} ({agent.active_tickets_count})</option>
                ))}
              </select>
              <Button onClick={assignSingle} disabled={!singleAgentId || selectedTicketIds.length === 0 || pendingMode !== null}>
                {pendingMode === 'single' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Attribuer {selectedTicketIds.length} ticket(s)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Repartition equilibree</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Round-robin sur les agents coches ci-dessous.</p>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                {agents.map((agent) => (
                  <label key={agent.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={roundRobinAgentIds.includes(agent.id)}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setRoundRobinAgentIds((current) =>
                          checked ? [...current, agent.id] : current.filter((id) => id !== agent.id),
                        )
                      }}
                    />
                    {agent.name} ({agent.active_tickets_count})
                  </label>
                ))}
              </div>
              <Button onClick={assignRoundRobin} disabled={roundRobinAgentIds.length === 0 || selectedTicketIds.length === 0 || pendingMode !== null}>
                {pendingMode === 'round_robin' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Repartir {selectedTicketIds.length} ticket(s)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Charge actuelle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{agent.name}</span>
                  <Badge variant="outline">{agent.active_tickets_count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tickets a distribuer ({filteredTickets.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Recherche: #ticket, titre, client, assignee..." />

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedTicketIds(filteredTickets.map((ticket) => ticket.id))}>Tout selectionner (filtre)</Button>
              <Button type="button" variant="outline" onClick={() => setSelectedTicketIds([])}>Vider</Button>
              <Button type="button" onClick={assignManual} disabled={pendingMode !== null}>
                {pendingMode === 'manual' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Appliquer manuel
              </Button>
            </div>

            <div className="max-h-[540px] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Sel.</th>
                    <th className="px-3 py-2 text-left">Ticket</th>
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="px-3 py-2 text-left">Statut/Priorite</th>
                    <th className="px-3 py-2 text-left">Assigne actuel</th>
                    <th className="px-3 py-2 text-left">Attribution manuelle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-t">
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={selectedTicketIds.includes(ticket.id)}
                          onChange={() => toggleTicket(ticket.id)}
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium">#{ticket.id} - {ticket.title || 'Sans titre'}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTimeFr(ticket.created_at)}</p>
                      </td>
                      <td className="px-3 py-2 align-top">{ticket.requester || '-'}</td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex gap-2">
                          <Badge variant="outline">{ticket.status || '-'}</Badge>
                          <Badge variant="outline">{ticket.priority || '-'}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">{ticket.assignee_name || 'Non assigne'}</td>
                      <td className="px-3 py-2 align-top">
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={manualAssignments[ticket.id] || ''}
                          onChange={(e) => setManualAssignments((current) => ({ ...current, [ticket.id]: e.target.value }))}
                        >
                          <option value="">--</option>
                          {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNativeNav showFab={false} />
    </AppLayout>
  )
}
