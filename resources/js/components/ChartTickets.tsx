import React from 'react'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function ChartTickets({ stats }: { stats?: { open?: number; closed?: number; total?: number } }) {
  const s = {
    open: stats?.open ?? 0,
    closed: stats?.closed ?? 0,
    total: stats?.total ?? 0,
  }

  const data = {
    labels: ['Open', 'Closed'],
    datasets: [
      {
        data: [s.open, s.closed],
        backgroundColor: ['#ef4444', '#10b981'],
        hoverBackgroundColor: ['#dc2626', '#059669'],
      },
    ],
  }

  return (
    <div className="max-w-xs mx-auto">
      <Doughnut data={data} />
    </div>
  )
}
