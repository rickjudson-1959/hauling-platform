import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', assigned: 'Assigned', en_route: 'En route',
  on_site: 'On site', completed: 'Completed', invoiced: 'Invoiced', cancelled: 'Cancelled',
}
const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-600', assigned:  'bg-blue-100 text-blue-700',
  en_route:  'bg-yellow-100 text-yellow-800', on_site: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',  invoiced: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-600',
}
// Buttons shown per current status (only forward transitions)
const NEXT_STATUSES: Record<string, Array<{ value: string; label: string; cls: string }>> = {
  scheduled: [
    { value: 'en_route', label: 'En route',  cls: 'bg-yellow-500 active:bg-yellow-600 text-white' },
    { value: 'on_site',  label: 'On site',   cls: 'bg-orange-500 active:bg-orange-600 text-white' },
    { value: 'completed',label: 'Completed', cls: 'bg-green-600 active:bg-green-700 text-white' },
  ],
  assigned: [
    { value: 'en_route', label: 'En route',  cls: 'bg-yellow-500 active:bg-yellow-600 text-white' },
    { value: 'on_site',  label: 'On site',   cls: 'bg-orange-500 active:bg-orange-600 text-white' },
    { value: 'completed',label: 'Completed', cls: 'bg-green-600 active:bg-green-700 text-white' },
  ],
  en_route: [
    { value: 'on_site',  label: 'On site',   cls: 'bg-orange-500 active:bg-orange-600 text-white' },
    { value: 'completed',label: 'Completed', cls: 'bg-green-600 active:bg-green-700 text-white' },
  ],
  on_site: [
    { value: 'completed',label: 'Completed', cls: 'bg-green-600 active:bg-green-700 text-white' },
  ],
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Job {
  id: string
  scheduled_for: string | null
  site_address: string | null
  status: string
  quantity: number | null
  notes: string | null
  photo_url: string | null
  signature_url: string | null
  org_id: string
  customers: { name: string } | null
  haul_types: { name: string; unit: string } | null
  trucks: { label: string } | null
}

const JOB_COLS = [
  'id', 'scheduled_for', 'site_address', 'status', 'quantity', 'notes',
  'photo_url', 'signature_url', 'org_id',
  'customers(name)', 'haul_types(name,unit)', 'trucks(label)',
].join(', ')

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

// ── Signature pad ──────────────────────────────────────────────────────────────

function SignaturePad({ onChange }: { onChange: (blob: Blob) => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const drawing    = useRef(false)
  const hasStrokes = useRef(false)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#111827'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }, [])

  function getPoint(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e.nativeEvent) {
      const t = e.nativeEvent.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return {
      x: ((e as React.MouseEvent).nativeEvent.clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).nativeEvent.clientY - rect.top)  * scaleY,
    }
  }

  function onStart(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const pt  = getPoint(e)
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
    drawing.current    = true
    hasStrokes.current = true
  }

  function onMove(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pt  = getPoint(e)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
  }

  function onEnd(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    if (!drawing.current) return
    drawing.current = false
    canvasRef.current!.toBlob(b => { if (b) onChange(b) }, 'image/png')
  }

  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    hasStrokes.current = false
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        style={{ touchAction: 'none' }}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg bg-white"
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      />
      <button
        type="button"
        onClick={clear}
        className="text-sm text-gray-500 underline"
      >
        Clear signature
      </button>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function JobDetail() {
  const { id }    = useParams<{ id: string }>()
  const { org }   = useAuth()
  const navigate  = useNavigate()

  const [job,          setJob]          = useState<Job | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [notFound,     setNotFound]     = useState(false)

  // Editable fields
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [qty,           setQty]           = useState('')
  const [notes,         setNotes]         = useState('')
  const [photoFile,     setPhotoFile]     = useState<File | null>(null)
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null)
  const [sigBlob,       setSigBlob]       = useState<Blob | null>(null)

  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (org && id) load() }, [org, id])

  // Clean up object URL on unmount or new photo
  useEffect(() => {
    return () => { if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview) }
  }, [photoPreview])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select(JOB_COLS)
      .eq('id', id!)
      .single()

    if (!data) { setNotFound(true); setLoading(false); return }
    const j = data as Job
    setJob(j)
    setQty(j.quantity !== null ? String(j.quantity) : '')
    setNotes(j.notes ?? '')
    setLoading(false)
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function save() {
    if (!job || !org) return
    setSaving(true)
    setSaveError(null)

    let photoUrl    = job.photo_url
    let signatureUrl = job.signature_url

    // Upload new photo
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop() || 'jpg'
      const path = `${org.id}/${job.id}/photo.${ext}`
      const { error: upErr } = await supabase.storage
        .from('job-media').upload(path, photoFile, { upsert: true })
      if (upErr) { setSaveError(`Photo upload failed: ${upErr.message}`); setSaving(false); return }
      photoUrl = supabase.storage.from('job-media').getPublicUrl(path).data.publicUrl
    }

    // Upload new signature
    if (sigBlob) {
      const path = `${org.id}/${job.id}/signature.png`
      const { error: upErr } = await supabase.storage
        .from('job-media').upload(path, sigBlob, { upsert: true, contentType: 'image/png' })
      if (upErr) { setSaveError(`Signature upload failed: ${upErr.message}`); setSaving(false); return }
      signatureUrl = supabase.storage.from('job-media').getPublicUrl(path).data.publicUrl
    }

    const newStatus = pendingStatus ?? job.status
    const patch: Record<string, unknown> = {
      quantity:      qty !== '' ? Number(qty) : null,
      notes:         notes.trim() || null,
      photo_url:     photoUrl,
      signature_url: signatureUrl,
      status:        newStatus,
    }
    if (newStatus === 'completed' && job.status !== 'completed') {
      patch.completed_at = new Date().toISOString()
    }

    const { error: updateErr } = await supabase
      .from('jobs').update(patch).eq('id', job.id)

    if (updateErr) { setSaveError(updateErr.message); setSaving(false); return }
    navigate('/driver')
  }

  const nextStatuses = job ? (NEXT_STATUSES[job.status] ?? []) : []
  const displayPhoto = photoPreview ?? job?.photo_url ?? null
  const isReadOnly   = job && !NEXT_STATUSES[job.status] && job.status !== 'scheduled' && job.status !== 'assigned'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    )
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <p className="text-base text-gray-700">Job not found.</p>
        <button onClick={() => navigate('/driver')} className="text-blue-600 underline text-sm">
          Back to my jobs
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-32">

      {/* Sticky header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button
          onClick={() => navigate('/driver')}
          className="text-2xl text-gray-600 active:text-gray-900 -ml-1 pr-2"
          aria-label="Back"
        >
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 truncate">
            {job.customers?.name ?? 'No customer'}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {pendingStatus ? STATUS_LABEL[pendingStatus] : STATUS_LABEL[job.status]}
        </span>
      </header>

      <div className="flex-1 px-4 py-4 space-y-4">

        {/* Job info */}
        <Section title="Job details">
          <div className="space-y-1.5">
            {job.site_address && (
              <div>
                <p className="text-xs text-gray-400">Site</p>
                <p className="text-base text-gray-900">{job.site_address}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400">Scheduled</p>
              <p className="text-base text-gray-900">{formatDateTime(job.scheduled_for)}</p>
            </div>
            {job.haul_types && (
              <div>
                <p className="text-xs text-gray-400">Haul type</p>
                <p className="text-base text-gray-900">{job.haul_types.name}</p>
              </div>
            )}
            {job.trucks && (
              <div>
                <p className="text-xs text-gray-400">Truck</p>
                <p className="text-base text-gray-900">{job.trucks.label}</p>
              </div>
            )}
          </div>
        </Section>

        {/* Status buttons */}
        {nextStatuses.length > 0 && (
          <Section title="Update status">
            <div className="space-y-2.5">
              {nextStatuses.map(s => {
                const isSelected = (pendingStatus ?? job.status) === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setPendingStatus(s.value)}
                    className={`w-full py-4 rounded-xl text-base font-semibold transition-all ${
                      isSelected
                        ? `${s.cls} ring-4 ring-offset-1 ring-current/30`
                        : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* Quantity */}
        <Section title="Quantity">
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={qty}
              onChange={e => setQty(e.target.value)}
              min={0}
              step="any"
              placeholder="0"
              readOnly={!!isReadOnly}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
            {job.haul_types && (
              <span className="text-base text-gray-500 shrink-0">{job.haul_types.unit}</span>
            )}
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Add any notes about this job…"
            readOnly={!!isReadOnly}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </Section>

        {/* Photo */}
        <Section title="Photo">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
            className="hidden"
          />
          {displayPhoto ? (
            <div className="space-y-3">
              <img
                src={displayPhoto}
                alt="Job photo"
                className="w-full rounded-lg object-cover max-h-64"
              />
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full py-3.5 border-2 border-gray-300 rounded-xl text-base font-medium text-gray-700 active:bg-gray-50"
                >
                  Retake photo
                </button>
              )}
            </div>
          ) : (
            !isReadOnly && (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-base font-medium text-gray-500 active:bg-gray-50 flex items-center justify-center gap-2"
              >
                <span className="text-2xl">📷</span>
                Take photo
              </button>
            )
          )}
        </Section>

        {/* Signature */}
        <Section title="Signature">
          {job.signature_url && !sigBlob ? (
            <div className="space-y-3">
              <img
                src={job.signature_url}
                alt="Signature"
                className="w-full border border-gray-200 rounded-lg bg-white object-contain max-h-32"
              />
              {!isReadOnly && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Draw a new signature to replace:</p>
                  <SignaturePad onChange={setSigBlob} />
                </div>
              )}
            </div>
          ) : (
            !isReadOnly && (
              <div className="space-y-1">
                <p className="text-sm text-gray-500">Draw signature in the box below:</p>
                <SignaturePad onChange={setSigBlob} />
                {sigBlob && (
                  <p className="text-xs text-green-600 font-medium">✓ Signature captured</p>
                )}
              </div>
            )
          )}
          {isReadOnly && !job.signature_url && (
            <p className="text-sm text-gray-400">No signature on file.</p>
          )}
        </Section>

        {/* Error */}
        {saveError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {saveError}
          </p>
        )}
      </div>

      {/* Sticky save bar */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 safe-area-inset-bottom">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full py-4 bg-blue-600 active:bg-blue-700 text-white text-base font-semibold rounded-xl disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : pendingStatus && pendingStatus !== job.status ? `Save & mark ${STATUS_LABEL[pendingStatus]}` : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}
