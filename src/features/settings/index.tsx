import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { orgQuery } from '../../shared/utils/db'
import { useAuth } from '../auth/useAuth'
import Layout from '../../shared/components/Layout'
import Modal from '../../shared/components/Modal'

const UNITS = [
  { value: 'litres',       label: 'Litres',        group: 'Metric' },
  { value: 'cubic_metres', label: 'Cubic metres',  group: 'Metric' },
  { value: 'tonnes',       label: 'Tonnes',        group: 'Metric' },
  { value: 'gallons',      label: 'Gallons',       group: 'Imperial' },
  { value: 'cubic_yards',  label: 'Cubic yards',   group: 'Imperial' },
  { value: 'tons',         label: 'Tons',          group: 'Imperial' },
  { value: 'loads',        label: 'Loads',         group: 'Other' },
  { value: 'hours',        label: 'Hours',         group: 'Other' },
] as const

type Unit = typeof UNITS[number]['value']

interface HaulType {
  id: string
  name: string
  unit: Unit
}

interface Draft {
  id?: string
  name: string
  unit: Unit
}

export default function SettingsPage() {
  const { org } = useAuth()
  const [haulTypes, setHaulTypes] = useState<HaulType[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    if (org) load()
  }, [org])

  async function load() {
    setLoading(true)
    const { data } = await orgQuery('haul_types', org!.id, 'id, name, unit').order('name')
    setHaulTypes((data as HaulType[]) ?? [])
    setLoading(false)
  }

  function openAdd() {
    setDraft({ name: '', unit: 'litres' })
    setFormError(null)
  }

  function openEdit(ht: HaulType) {
    setDraft({ id: ht.id, name: ht.name, unit: ht.unit })
    setFormError(null)
  }

  async function save() {
    if (!draft || !org) return
    if (!draft.name.trim()) { setFormError('Name is required'); return }
    setSaving(true)
    setFormError(null)

    const payload = { name: draft.name.trim(), unit: draft.unit }

    const { error } = draft.id
      ? await supabase.from('haul_types').update(payload).eq('id', draft.id).eq('org_id', org.id)
      : await supabase.from('haul_types').insert({ org_id: org.id, ...payload })

    if (error) { setFormError(error.message); setSaving(false); return }
    setSaving(false)
    setDraft(null)
    load()
  }

  async function remove(id: string) {
    if (!org) return
    const { error } = await supabase.from('haul_types').delete().eq('id', id).eq('org_id', org.id)
    if (error) {
      alert(error.message)
      return
    }
    setConfirmDelete(null)
    load()
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Haul types</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Configure the haul types and units of measure your org uses.
              </p>
            </div>
            <button
              onClick={openAdd}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 shrink-0"
            >
              Add haul type
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : haulTypes.length === 0 ? (
            <p className="text-sm text-gray-500">
              No haul types yet. Add one to get started — for example, Water Delivery in gallons.
            </p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-700">Unit</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {haulTypes.map(ht => (
                    <tr key={ht.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{ht.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {UNITS.find(u => u.value === ht.unit)?.label ?? ht.unit}
                      </td>
                      <td className="px-4 py-3 text-right space-x-3">
                        {confirmDelete === ht.id ? (
                          <>
                            <span className="text-gray-600">Delete?</span>
                            <button
                              onClick={() => remove(ht.id)}
                              className="text-red-600 font-medium hover:underline"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-gray-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(ht)}
                              className="text-blue-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setConfirmDelete(ht.id)}
                              className="text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {draft !== null && (
        <Modal
          title={draft.id ? 'Edit haul type' : 'Add haul type'}
          onClose={() => setDraft(null)}
        >
          <div className="space-y-4">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {formError}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft(d => d && { ...d, name: e.target.value })}
                autoFocus
                placeholder="e.g. Water Delivery"
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit of measure
              </label>
              <select
                value={draft.unit}
                onChange={e => setDraft(d => d && { ...d, unit: e.target.value as Unit })}
                className="block w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(['Metric', 'Imperial', 'Other'] as const).map(group => (
                  <optgroup key={group} label={group}>
                    {UNITS.filter(u => u.group === group).map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </optgroup>
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
