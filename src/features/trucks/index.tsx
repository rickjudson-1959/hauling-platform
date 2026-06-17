import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { orgQuery } from '../../shared/utils/db'
import { useAuth } from '../auth/useAuth'
import Layout from '../../shared/components/Layout'
import Modal from '../../shared/components/Modal'

const STATUSES = [
  { value: 'available',       label: 'Available',       className: 'bg-green-100 text-green-800' },
  { value: 'in_use',          label: 'In use',           className: 'bg-blue-100 text-blue-800' },
  { value: 'maintenance',     label: 'Maintenance',      className: 'bg-yellow-100 text-yellow-800' },
  { value: 'out_of_service',  label: 'Out of service',   className: 'bg-red-100 text-red-800' },
] as const

type TruckStatus = typeof STATUSES[number]['value']

interface HaulType { id: string; name: string }

interface Truck {
  id: string
  label: string
  haul_type_id: string | null
  capacity: number | null
  status: TruckStatus
  haul_types: { name: string } | null
}

interface Draft {
  id?: string
  label: string
  haul_type_id: string
  capacity: string
  status: TruckStatus
}

const BLANK: Draft = { label: '', haul_type_id: '', capacity: '', status: 'available' }

export default function TrucksPage() {
  const { org } = useAuth()
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [haulTypes, setHaulTypes] = useState<HaulType[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (org) load()
  }, [org])

  async function load() {
    setLoading(true)
    const [{ data: truckData }, { data: htData }] = await Promise.all([
      orgQuery('trucks', org!.id, 'id, label, haul_type_id, capacity, status, haul_types(name)')
        .order('label'),
      orgQuery('haul_types', org!.id, 'id, name').order('name'),
    ])
    setTrucks((truckData as Truck[]) ?? [])
    setHaulTypes((htData as HaulType[]) ?? [])
    setLoading(false)
  }

  function openAdd() {
    setDraft({ ...BLANK })
    setFormError(null)
  }

  function openEdit(t: Truck) {
    setDraft({
      id: t.id,
      label: t.label,
      haul_type_id: t.haul_type_id ?? '',
      capacity: t.capacity !== null ? String(t.capacity) : '',
      status: t.status,
    })
    setFormError(null)
  }

  async function save() {
    if (!draft || !org) return
    if (!draft.label.trim()) { setFormError('Label is required'); return }
    setSaving(true)
    setFormError(null)

    const payload = {
      label: draft.label.trim(),
      haul_type_id: draft.haul_type_id || null,
      capacity: draft.capacity !== '' ? Number(draft.capacity) : null,
      status: draft.status,
    }

    const { error } = draft.id
      ? await supabase.from('trucks').update(payload).eq('id', draft.id).eq('org_id', org.id)
      : await supabase.from('trucks').insert({ org_id: org.id, ...payload })

    if (error) { setFormError(error.message); setSaving(false); return }
    setSaving(false)
    setDraft(null)
    load()
  }

  function statusMeta(s: TruckStatus) {
    return STATUSES.find(x => x.value === s) ?? STATUSES[0]
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Trucks</h1>
          <button
            onClick={openAdd}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700"
          >
            Add truck
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : trucks.length === 0 ? (
          <p className="text-sm text-gray-500">No trucks yet. Add one to get started.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Label</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Haul type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Capacity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trucks.map(t => {
                  const st = statusMeta(t.status)
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{t.label}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {t.haul_types?.name ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {t.capacity !== null ? t.capacity : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${st.className}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openEdit(t)}
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

      {draft !== null && (
        <Modal
          title={draft.id ? 'Edit truck' : 'Add truck'}
          onClose={() => setDraft(null)}
        >
          <div className="space-y-4">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {formError}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                type="text"
                value={draft.label}
                onChange={e => setDraft(d => d && { ...d, label: e.target.value })}
                autoFocus
                placeholder="e.g. Truck 01"
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Haul type <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={draft.haul_type_id}
                onChange={e => setDraft(d => d && { ...d, haul_type_id: e.target.value })}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— none —</option>
                {haulTypes.map(ht => (
                  <option key={ht.id} value={ht.id}>{ht.name}</option>
                ))}
              </select>
              {haulTypes.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Add haul types in Settings first.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacity <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                value={draft.capacity}
                onChange={e => setDraft(d => d && { ...d, capacity: e.target.value })}
                min={0}
                placeholder="e.g. 4000"
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={draft.status}
                onChange={e => setDraft(d => d && { ...d, status: e.target.value as TruckStatus })}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
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
