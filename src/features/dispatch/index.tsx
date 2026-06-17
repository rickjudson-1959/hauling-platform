import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { orgQuery } from '../../shared/utils/db'
import { useAuth } from '../auth/useAuth'
import Layout from '../../shared/components/Layout'

// ── Status styling ─────────────────────────────────────────────────────────────

const STATUS_CARD: Record<string, { bg: string; badge: string; label: string }> = {
  scheduled: { bg: 'bg-white border-blue-300',    badge: 'bg-blue-100 text-blue-700',    label: 'Scheduled' },
  assigned:  { bg: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-700', label: 'Assigned'  },
  en_route:  { bg: 'bg-orange-50 border-orange-300', badge: 'bg-orange-100 text-orange-700', label: 'En route'  },
  on_site:   { bg: 'bg-green-50 border-green-300',  badge: 'bg-green-100 text-green-700',  label: 'On site'   },
  completed: { bg: 'bg-gray-50 border-gray-300',   badge: 'bg-gray-200 text-gray-600',    label: 'Completed' },
  invoiced:  { bg: 'bg-purple-50 border-purple-300', badge: 'bg-purple-100 text-purple-700', label: 'Invoiced'  },
  cancelled: { bg: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-600',      label: 'Cancelled' },
}

const TRUCK_STATUS_CLS: Record<string, string> = {
  available:      'bg-green-100 text-green-700',
  in_use:         'bg-blue-100 text-blue-700',
  maintenance:    'bg-yellow-100 text-yellow-700',
  out_of_service: 'bg-red-100 text-red-700',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface HaulType { id: string; name: string; unit: string }
interface Truck    { id: string; label: string; status: string }

interface Job {
  id: string
  scheduled_for: string | null
  site_address: string | null
  status: string
  quantity: number | null
  customer_id: string | null
  haul_type_id: string | null
  truck_id: string | null
  customers: { name: string } | null
  haul_types: { name: string; unit: string } | null
}

const JOB_COLS = [
  'id', 'scheduled_for', 'site_address', 'status',
  'quantity', 'customer_id', 'haul_type_id', 'truck_id',
  'customers(name)', 'haul_types(name,unit)',
].join(', ')

// ── Date helpers ───────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r
}
function endOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r
}
function mondayOf(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day))
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function formatShortDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DispatchBoard() {
  const { org } = useAuth()

  const [view,   setView]   = useState<'day' | 'week'>('day')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))

  const [jobs,      setJobs]      = useState<Job[]>([])
  const [trucks,    setTrucks]    = useState<Truck[]>([])
  const [haulTypes, setHaulTypes] = useState<HaulType[]>([])
  const [htFilter,  setHtFilter]  = useState('')
  const [loading,   setLoading]   = useState(true)

  const [dragging,   setDragging]   = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // Range derived from anchor + view
  const rangeStart = useMemo(
    () => view === 'day' ? startOfDay(anchor) : mondayOf(anchor),
    [anchor, view],
  )
  const rangeEnd = useMemo(
    () => view === 'day' ? endOfDay(anchor) : endOfDay(addDays(mondayOf(anchor), 6)),
    [anchor, view],
  )

  // Avoid double-fetch on initial mount
  const mounted = useRef(false)

  useEffect(() => {
    if (!org) return
    loadAll()
  }, [org?.id])

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (!org) return
    loadJobs(rangeStart, rangeEnd)
  }, [rangeStart.getTime(), rangeEnd.getTime()])

  async function loadAll() {
    setLoading(true)
    const [{ data: truckData }, { data: htData }] = await Promise.all([
      orgQuery('trucks', org!.id, 'id, label, status').order('label'),
      orgQuery('haul_types', org!.id, 'id, name, unit').order('name'),
    ])
    setTrucks((truckData as Truck[]) ?? [])
    setHaulTypes((htData as HaulType[]) ?? [])
    await loadJobs(rangeStart, rangeEnd)
    setLoading(false)
  }

  async function loadJobs(start: Date, end: Date) {
    const { data } = await orgQuery('jobs', org!.id, JOB_COLS)
      .gte('scheduled_for', start.toISOString())
      .lte('scheduled_for', end.toISOString())
      .order('scheduled_for')
    setJobs((data as Job[]) ?? [])
  }

  // Filter + group
  const visible = useMemo(
    () => htFilter ? jobs.filter(j => j.haul_type_id === htFilter) : jobs,
    [jobs, htFilter],
  )

  const byTruck = useMemo(() => {
    const map: Record<string, Job[]> = { unassigned: [] }
    for (const t of trucks) map[t.id] = []
    for (const j of visible) {
      const key = j.truck_id && map[j.truck_id] !== undefined ? j.truck_id : 'unassigned'
      map[key].push(j)
    }
    return map
  }, [visible, trucks])

  // Drop handler — optimistic update, revert on error
  async function handleDrop(targetKey: string) {
    if (!dragging || !org) return
    const job = jobs.find(j => j.id === dragging)
    if (!job) return
    const newTruckId = targetKey === 'unassigned' ? null : targetKey
    if (job.truck_id === newTruckId) return

    const patch: Record<string, unknown> = { truck_id: newTruckId }
    if (newTruckId && job.status === 'scheduled') patch.status = 'assigned'
    if (!newTruckId && job.status === 'assigned') patch.status = 'scheduled'

    setJobs(prev => prev.map(j => j.id === dragging ? { ...j, ...patch } : j))

    const { error } = await supabase
      .from('jobs').update(patch).eq('id', dragging).eq('org_id', org.id)
    if (error) loadJobs(rangeStart, rangeEnd) // revert
  }

  // Navigation
  const step = view === 'day' ? 1 : 7
  const goToday = () => setAnchor(startOfDay(new Date()))
  const goPrev  = () => setAnchor(d => addDays(d, -step))
  const goNext  = () => setAnchor(d => addDays(d, step))

  const dateLabel = view === 'day'
    ? anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : (() => {
        const s = mondayOf(anchor)
        const e = addDays(s, 6)
        return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      })()

  const columns = [
    { id: 'unassigned', label: 'Unassigned', truckStatus: null as string | null },
    ...trucks.map(t => ({ id: t.id, label: t.label, truckStatus: t.status })),
  ]

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dispatch</h1>

        {/* Day / Week toggle */}
        <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
          {(['day', 'week'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 capitalize border-l first:border-l-0 border-gray-300 transition-colors ${
                view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button onClick={goPrev}  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-lg">‹</button>
          <button onClick={goToday} className="px-3 py-1 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50">
            {view === 'day' ? 'Today' : 'This week'}
          </button>
          <button onClick={goNext}  className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 text-lg">›</button>
        </div>

        <span className="text-sm font-medium text-gray-700">{dateLabel}</span>

        {/* Haul type filter */}
        <div className="ml-auto">
          <select
            value={htFilter}
            onChange={e => setHtFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All haul types</option>
            {haulTypes.map(ht => (
              <option key={ht.id} value={ht.id}>{ht.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Board ── */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3" style={{ minWidth: `${columns.length * 220}px` }}>
            {columns.map(col => {
              const colJobs = byTruck[col.id] ?? []
              const isTarget = dropTarget === col.id
              return (
                <div
                  key={col.id}
                  className={`flex flex-col rounded-lg border-2 transition-colors duration-100 ${
                    isTarget ? 'border-blue-400 bg-blue-50/60' : 'border-transparent bg-gray-100'
                  }`}
                  style={{ width: 212, minWidth: 212 }}
                  onDragOver={e => { e.preventDefault(); if (dropTarget !== col.id) setDropTarget(col.id) }}
                  onDrop={() => { setDropTarget(null); handleDrop(col.id) }}
                >
                  {/* Column header */}
                  <div className="px-3 py-2.5 bg-white rounded-t-lg border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2 justify-between">
                      <span className="text-sm font-semibold text-gray-800 truncate">{col.label}</span>
                      {col.truckStatus && (
                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${TRUCK_STATUS_CLS[col.truckStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                          {col.truckStatus.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {colJobs.length} job{colJobs.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-2 flex-1 min-h-[140px]">
                    {colJobs.map(j => (
                      <JobCard
                        key={j.id}
                        job={j}
                        showDate={view === 'week'}
                        isDragging={dragging === j.id}
                        onDragStart={() => setDragging(j.id)}
                        onDragEnd={() => { setDragging(null); setDropTarget(null) }}
                      />
                    ))}
                    {colJobs.length === 0 && (
                      <p className="text-xs text-gray-400 text-center pt-6 select-none">
                        {isTarget ? 'Release to assign' : 'No jobs'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {trucks.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Add trucks in the Trucks page to see truck columns here.
              </p>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}

// ── Job card ───────────────────────────────────────────────────────────────────

function JobCard({
  job, showDate, isDragging, onDragStart, onDragEnd,
}: {
  job: Job
  showDate: boolean
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const st = STATUS_CARD[job.status] ?? STATUS_CARD.scheduled
  const cancelled = job.status === 'cancelled'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded border px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-opacity ${st.bg} ${isDragging ? 'opacity-30' : 'opacity-100'} ${cancelled ? 'opacity-50' : ''}`}
    >
      {showDate && (
        <p className="text-xs text-gray-400 mb-1">{formatShortDate(job.scheduled_for)}</p>
      )}

      <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
        {job.customers?.name ?? <span className="text-gray-400 font-normal italic">No customer</span>}
      </p>

      {job.site_address && (
        <p className="text-xs text-gray-500 truncate mt-0.5">{job.site_address}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-xs text-gray-500">{formatTime(job.scheduled_for)}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${st.badge}`}>{st.label}</span>
      </div>

      {job.haul_types && (
        <p className="text-xs text-gray-400 mt-1 truncate">
          {job.haul_types.name}
          {job.quantity !== null ? ` · ${job.quantity} ${job.haul_types.unit}` : ''}
        </p>
      )}
    </div>
  )
}
