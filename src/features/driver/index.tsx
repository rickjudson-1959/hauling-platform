import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-600',
  assigned:  'bg-blue-100 text-blue-700',
  en_route:  'bg-yellow-100 text-yellow-800',
  on_site:   'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  invoiced:  'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', assigned: 'Assigned', en_route: 'En route',
  on_site: 'On site', completed: 'Completed', invoiced: 'Invoiced', cancelled: 'Cancelled',
}

interface Job {
  id: string
  scheduled_for: string | null
  site_address: string | null
  status: string
  quantity: number | null
  customers: { name: string } | null
  haul_types: { name: string; unit: string } | null
  trucks: { label: string } | null
}

const JOB_COLS = 'id, scheduled_for, site_address, status, quantity, customers(name), haul_types(name,unit), trucks(label)'

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r }

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default function DriverJobList() {
  const { org, signOut } = useAuth()
  const navigate = useNavigate()
  const [jobs,    setJobs]    = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (org) load() }, [org])

  async function load() {
    setLoading(true)
    const today = new Date()
    const { data: memId } = await supabase.rpc('my_membership_id')
    if (!memId) { setLoading(false); return }

    const { data } = await supabase
      .from('jobs')
      .select(JOB_COLS)
      .eq('driver_id', memId)
      .eq('org_id', org!.id)
      .gte('scheduled_for', startOfDay(today).toISOString())
      .lte('scheduled_for', endOfDay(today).toISOString())
      .order('scheduled_for')

    setJobs((data as Job[]) ?? [])
    setLoading(false)
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{org?.name}</p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">My Jobs</h1>
            <p className="text-sm text-gray-500 mt-0.5">{today}</p>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 active:text-gray-800 px-2 py-1 -mr-2 -mt-1"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Job list */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {loading ? (
          <p className="text-sm text-gray-500 text-center pt-10">Loading…</p>
        ) : jobs.length === 0 ? (
          <div className="text-center pt-16 space-y-2">
            <p className="text-4xl">🚛</p>
            <p className="text-base font-medium text-gray-700">No jobs today</p>
            <p className="text-sm text-gray-400">Check back later or contact your dispatcher.</p>
          </div>
        ) : (
          jobs.map(j => {
            const st = STATUS_BADGE[j.status] ?? STATUS_BADGE.assigned
            const done = j.status === 'completed' || j.status === 'invoiced' || j.status === 'cancelled'
            return (
              <button
                key={j.id}
                onClick={() => navigate(`/driver/${j.id}`)}
                className={`w-full text-left bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 transition-colors ${done ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 leading-snug">
                      {j.customers?.name ?? <span className="text-gray-400 font-normal">No customer</span>}
                    </p>
                    {j.site_address && (
                      <p className="text-sm text-gray-600 mt-0.5 truncate">{j.site_address}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span>{formatTime(j.scheduled_for)}</span>
                      {j.haul_types && (
                        <span>·&nbsp;{j.haul_types.name}{j.quantity !== null ? ` · ${j.quantity} ${j.haul_types.unit}` : ''}</span>
                      )}
                    </div>
                    {j.trucks && (
                      <p className="text-sm text-gray-400 mt-1">{j.trucks.label}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st}`}>
                      {STATUS_LABEL[j.status] ?? j.status}
                    </span>
                    {!done && (
                      <span className="text-gray-300 text-lg">›</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
