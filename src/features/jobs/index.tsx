import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { orgQuery } from '../../shared/utils/db'
import { useAuth } from '../auth/useAuth'
import Layout from '../../shared/components/Layout'
import Modal from '../../shared/components/Modal'

const STATUSES = [
  { value: 'scheduled', label: 'Scheduled', cls: 'bg-gray-100 text-gray-700' },
  { value: 'assigned',  label: 'Assigned',  cls: 'bg-blue-100 text-blue-700' },
  { value: 'en_route',  label: 'En route',  cls: 'bg-yellow-100 text-yellow-800' },
  { value: 'on_site',   label: 'On site',   cls: 'bg-orange-100 text-orange-700' },
  { value: 'completed', label: 'Completed', cls: 'bg-green-100 text-green-700' },
  { value: 'invoiced',  label: 'Invoiced',  cls: 'bg-purple-100 text-purple-700' },
  { value: 'cancelled', label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
] as const

type JobStatus = typeof STATUSES[number]['value']

interface HaulType { id: string; name: string; unit: string }
interface Customer  { id: string; name: string }
interface Truck     { id: string; label: string; status: string }
interface Driver    { membership_id: string; email: string }

interface Job {
  id: string
  scheduled_for: string | null
  site_address: string | null
  status: JobStatus
  quantity: number | null
  price: number | null
  notes: string | null
  customer_id: string | null
  haul_type_id: string | null
  truck_id: string | null
  driver_id: string | null
  customers: { name: string } | null
  haul_types: { name: string; unit: string } | null
  trucks: { label: string } | null
}

interface Draft {
  id?: string
  customer_id: string
  haul_type_id: string
  site_address: string
  scheduled_for: string
  quantity: string
  price: string
  truck_id: string
  driver_id: string
  status: string
  notes: string
}

const BLANK: Draft = {
  customer_id: '', haul_type_id: '', site_address: '',
  scheduled_for: '', quantity: '', price: '',
  truck_id: '', driver_id: '', status: 'scheduled', notes: '',
}

const JOB_COLS = [
  'id', 'scheduled_for', 'site_address', 'status',
  'quantity', 'price', 'notes',
  'customer_id', 'haul_type_id', 'truck_id', 'driver_id',
  'customers(name)', 'haul_types(name,unit)', 'trucks(label)',
].join(', ')

function statusMeta(s: string) {
  return STATUSES.find(x => x.value === s) ?? STATUSES[0]
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function truckLabel(t: Truck): string {
  return t.status === 'available' ? t.label : `${t.label} · ${t.status.replace('_', ' ')}`
}

export default function JobsPage() {
  const { org } = useAuth()

  const [jobs,      setJobs]      = useState<Job[]>([])
  const [haulTypes, setHaulTypes] = useState<HaulType[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [trucks,    setTrucks]    = useState<Truck[]>([])
  const [drivers,   setDrivers]   = useState<Driver[]>([])
  const [loading,   setLoading]   = useState(true)

  const [statusFilter,   setStatusFilter]   = useState('')
  const [haulTypeFilter, setHaulTypeFilter] = useState('')

  const [draft,     setDraft]     = useState<Draft | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => { if (org) loadAll() }, [org])

  async function loadAll() {
    setLoading(true)
    const [
      { data: jobData },
      { data: htData },
      { data: custData },
      { data: truckData },
      { data: driverData },
    ] = await Promise.all([
      orgQuery('jobs', org!.id, JOB_COLS).order('scheduled_for', { ascending: false }),
      orgQuery('haul_types', org!.id, 'id, name, unit').order('name'),
      orgQuery('customers', org!.id, 'id, name').order('name'),
      orgQuery('trucks', org!.id, 'id, label, status').order('label'),
      supabase.rpc('org_drivers'),
    ])
    setJobs((jobData as Job[]) ?? [])
    setHaulTypes((htData as HaulType[]) ?? [])
    setCustomers((custData as Customer[]) ?? [])
    setTrucks((truckData as Truck[]) ?? [])
    setDrivers((driverData as Driver[]) ?? [])
    setLoading(false)
  }

  async function reloadJobs() {
    const { data } = await orgQuery('jobs', org!.id, JOB_COLS)
      .order('scheduled_for', { ascending: false })
    setJobs((data as Job[]) ?? [])
  }

  const driverMap = useMemo(
    () => Object.fromEntries(drivers.map(d => [d.membership_id, d.email])),
    [drivers],
  )

  const filtered = useMemo(() => jobs.filter(j => {
    if (statusFilter   && j.status        !== statusFilter)   return false
    if (haulTypeFilter && j.haul_type_id  !== haulTypeFilter) return false
    return true
  }), [jobs, statusFilter, haulTypeFilter])

  function openAdd() {
    setDraft({ ...BLANK })
    setFormError(null)
  }

  function openEdit(j: Job) {
    setDraft({
      id: j.id,
      customer_id:   j.customer_id  ?? '',
      haul_type_id:  j.haul_type_id ?? '',
      site_address:  j.site_address  ?? '',
      scheduled_for: toDatetimeLocal(j.scheduled_for),
      quantity:      j.quantity !== null ? String(j.quantity) : '',
      price:         j.price    !== null ? String(j.price)    : '',
      truck_id:      j.truck_id  ?? '',
      driver_id:     j.driver_id ?? '',
      status:        j.status,
      notes:         j.notes ?? '',
    })
    setFormError(null)
  }

  async function save() {
    if (!draft || !org) return
    setSaving(true)
    setFormError(null)

    const payload = {
      customer_id:   draft.customer_id  || null,
      haul_type_id:  draft.haul_type_id || null,
      site_address:  draft.site_address.trim() || null,
      scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : null,
      quantity:      draft.quantity !== '' ? Number(draft.quantity) : null,
      price:         draft.price    !== '' ? Number(draft.price)    : null,
      truck_id:      draft.truck_id  || null,
      driver_id:     draft.driver_id || null,
      status:        draft.status,
      notes:         draft.notes.trim() || null,
    }

    const { error } = draft.id
      ? await supabase.from('jobs').update(payload).eq('id', draft.id).eq('org_id', org.id)
      : await supabase.from('jobs').insert({ org_id: org.id, ...payload })

    if (error) { setFormError(error.message); setSaving(false); return }
    setSaving(false)
    setDraft(null)
    reloadJobs()
  }

  function set(field: keyof Draft, value: string) {
    setDraft(d => d ? { ...d, [field]: value } : d)
  }

  return (
    <Layout>
      <div className="space-y-6">

        {/* Header + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={haulTypeFilter}
              onChange={e => setHaulTypeFilter(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All haul types</option>
              {haulTypes.map(ht => (
                <option key={ht.id} value={ht.id}>{ht.name}</option>
              ))}
            </select>
            <button
              onClick={openAdd}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
            >
              Add job
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">
            {jobs.length === 0 ? 'No jobs yet. Add one to get started.' : 'No jobs match the current filters.'}
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Scheduled</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Haul type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Truck</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Driver</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(j => {
                  const st = statusMeta(j.status)
                  return (
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {formatDate(j.scheduled_for)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {j.customers?.name ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {j.haul_types?.name ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {j.trucks?.label ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {j.driver_id && driverMap[j.driver_id]
                          ? driverMap[j.driver_id]
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(j)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {draft !== null && (
        <Modal
          title={draft.id ? 'Edit job' : 'Add job'}
          onClose={() => setDraft(null)}
        >
          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {formError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <select
                  value={draft.customer_id}
                  onChange={e => set('customer_id', e.target.value)}
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— none —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Haul type</label>
                <select
                  value={draft.haul_type_id}
                  onChange={e => set('haul_type_id', e.target.value)}
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— none —</option>
                  {haulTypes.map(ht => (
                    <option key={ht.id} value={ht.id}>{ht.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site address</label>
              <input
                type="text"
                value={draft.site_address}
                onChange={e => set('site_address', e.target.value)}
                autoFocus
                placeholder="123 Main St"
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scheduled date &amp; time
              </label>
              <input
                type="datetime-local"
                value={draft.scheduled_for}
                onChange={e => set('scheduled_for', e.target.value)}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  value={draft.quantity}
                  onChange={e => set('quantity', e.target.value)}
                  min={0}
                  step="any"
                  placeholder="0"
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  value={draft.price}
                  onChange={e => set('price', e.target.value)}
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Truck</label>
                <select
                  value={draft.truck_id}
                  onChange={e => set('truck_id', e.target.value)}
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— none —</option>
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>{truckLabel(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
                <select
                  value={draft.driver_id}
                  onChange={e => set('driver_id', e.target.value)}
                  className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— none —</option>
                  {drivers.map(d => (
                    <option key={d.membership_id} value={d.membership_id}>{d.email}</option>
                  ))}
                </select>
                {drivers.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No drivers in this org yet.</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={draft.status}
                onChange={e => set('status', e.target.value)}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={draft.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder="Any notes for this job"
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDraft(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  )
}
