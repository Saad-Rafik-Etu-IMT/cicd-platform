import { Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import './Charts.css'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export function StatusChart({ pipelines }) {
  const stats = {
    success: pipelines.filter(p => p.status === 'success').length,
    failed: pipelines.filter(p => p.status === 'failed').length,
    running: pipelines.filter(p => p.status === 'running').length,
    pending: pipelines.filter(p => p.status === 'pending').length
  }

  const data = {
    labels: ['Réussis', 'Échoués', 'En cours', 'En attente'],
    datasets: [{
      data: [stats.success, stats.failed, stats.running, stats.pending],
      backgroundColor: [
        '#10b981',
        '#ef4444',
        '#0066FF',
        '#d1d5db'
      ],
      borderColor: '#ffffff',
      borderWidth: 2
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#6b7280',
          padding: 15,
          font: { size: 11 }
        }
      }
    }
  }

  return (
    <div className="chart-container">
      <h3>Statut des Pipelines</h3>
      <div className="chart-wrapper">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  )
}

export function TrendChart({ pipelines }) {
  // Group pipelines by day (last 7 days)
  const last7Days = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    last7Days.push(date.toISOString().split('T')[0])
  }

  const successByDay = last7Days.map(day => 
    pipelines.filter(p => 
      p.status === 'success' && 
      p.created_at?.startsWith(day)
    ).length
  )

  const failedByDay = last7Days.map(day => 
    pipelines.filter(p => 
      p.status === 'failed' && 
      p.created_at?.startsWith(day)
    ).length
  )

  const labels = last7Days.map(day => {
    const d = new Date(day)
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
  })

  const data = {
    labels,
    datasets: [
      {
        label: 'Réussis',
        data: successByDay,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Échoués',
        data: failedByDay,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        fill: true,
        tension: 0.4
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#6b7280',
          padding: 15
        }
      }
    },
    scales: {
      x: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#6b7280' }
      },
      y: {
        beginAtZero: true,
        grid: { color: '#e5e7eb' },
        ticks: { 
          color: '#6b7280',
          stepSize: 1
        }
      }
    }
  }

  return (
    <div className="chart-container">
      <h3>Tendance (7 jours)</h3>
      <div className="chart-wrapper">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}

export function DurationChart({ pipelines }) {
  // Get last 10 successful pipelines with duration
  const recentPipelines = pipelines
    .filter(p => p.status === 'success' && p.started_at && p.completed_at)
    .slice(0, 10)
    .reverse()

  const durations = recentPipelines.map(p => {
    const start = new Date(p.started_at)
    const end = new Date(p.completed_at)
    return Math.round((end - start) / 1000) // seconds
  })

  const labels = recentPipelines.map(p => `#${p.id}`)

  const avgDuration = durations.length > 0 
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0

  const data = {
    labels,
    datasets: [{
      label: 'Durée (secondes)',
      data: durations,
      borderColor: '#0066FF',
      backgroundColor: 'rgba(0, 102, 255, 0.08)',
      fill: true,
      tension: 0.3
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: `Moyenne: ${avgDuration}s`,
        color: '#6b7280',
        font: { size: 12 }
      }
    },
    scales: {
      x: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#6b7280' }
      },
      y: {
        beginAtZero: true,
        grid: { color: '#e5e7eb' },
        ticks: { color: '#6b7280' }
      }
    }
  }

  return (
    <div className="chart-container">
      <h3>Durée d'exécution</h3>
      <div className="chart-wrapper">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
