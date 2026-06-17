import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../auth/useAuth'
import Layout from '../../shared/components/Layout'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent:  'bg-blue-100 text-blue-700',
  paid:  'bg-green-100 text-green-700',
  void:  'bg-red-100 text-red-500',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void',
}

interface Invoice {
  id: string
  invoice_number: string
  status: string
  subtotal: number
  total: number
  notes: string | null
  sent_at: string | null
  paid_at: string | null
  created_at: string
  customers: { name: string } | null
}

interface LineItem {
  id: string
  description: string
  quantity: number | null
  unit: string | null
  amount: number
}

interface AuditEntry {
  id: string
  old_status: string | null
  new_status: string | null
  note: string | null
  created_at: string
}

function fmt(n: number) { return '$' + n.toFixed(2) }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString() }
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const { org } = useAuth()
  const navigate = useNavigate()

  const [invoice,    setInvoice]    = useState<Invoice | null>(null)
  const [lineItems,  setLineItems]  = useState<LineItem[]>([])
  const [auditLog,   setAuditLog]   = useState<AuditEntry[]>([])
  const [loading,    setLoading]    = useState(true)
  const [acting,     setActing]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => { if (org && id) load() }, [org, id])

  async function load() {
    setLoading(true)
    const [{ data: inv }, { data: items }, { data: audit }] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, status, subtotal, total, notes, sent_at, paid_at, created_at, customers(name)')
        .eq('id', id!)
        .eq('org_id', org!.id)
        .single(),
      supabase
        .from('invoice_line_items')
        .select('id, description, quantity, unit, amount')
        .eq('invoice_id', id!)
        .order('id'),
      supabase
        .from('invoice_audit_log')
        .select('id, old_status, new_status, note, created_at')
        .eq('invoice_id', id!)
        .order('created_at'),
    ])
    setInvoice(inv as Invoice)
    setLineItems((items as LineItem[]) ?? [])
    setAuditLog((audit as AuditEntry[]) ?? [])
    setLoading(false)
  }

  async function transition(newStatus: string) {
    setActing(true)
    setError(null)
    const { error: err } = await supabase.rpc('update_invoice_status', {
      p_invoice_id: id,
      p_new_status: newStatus,
    })
    setActing(false)
    if (err) { setError(err.message); return }
    load()
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-sm text-gray-500">Loading…</div>
      </Layout>
    )
  }

  if (!invoice) {
    return (
      <Layout>
        <div className="p-6 text-sm text-gray-500">Invoice not found.</div>
      </Layout>
    )
  }

  const { status } = invoice

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button
              onClick={() => navigate('/invoicing')}
              className="text-sm text-blue-600 hover:underline mb-2 block"
            >
              ← Invoices
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {invoice.customers?.name} · Created {fmtDate(invoice.created_at)}
            </p>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_BADGE[status] ?? STATUS_BADGE.draft}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Action buttons */}
        {status !== 'void' && (
          <div className="flex flex-wrap gap-2">
            {status === 'draft' && (
              <button
                onClick={() => transition('sent')}
                disabled={acting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Mark Sent
              </button>
            )}
            {status === 'sent' && (
              <button
                onClick={() => transition('paid')}
                disabled={acting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Mark Paid
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm('Void this invoice? The included jobs will return to completed status.')) {
                  transition('void')
                }
              }}
              disabled={acting}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Void
            </button>
          </div>
        )}

        {/* Metadata cards */}
        {(invoice.sent_at || invoice.paid_at || invoice.notes) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {invoice.sent_at && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sent</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{fmtDate(invoice.sent_at)}</p>
              </div>
            )}
            {invoice.paid_at && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Paid</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{fmtDate(invoice.paid_at)}</p>
              </div>
            )}
            {invoice.notes && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 col-span-full">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</p>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Line items */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Qty</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineItems.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.quantity != null
                      ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                  Total
                </td>
                <td className="px-4 py-3 text-right text-base font-bold text-gray-900">
                  {fmt(invoice.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Audit log / History */}
        {auditLog.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">History</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {auditLog.map(entry => (
                <li key={entry.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <span className="text-sm text-gray-700">
                    {entry.note ? (
                      entry.note
                    ) : (
                      <>
                        <span className="capitalize font-medium">{entry.old_status ?? 'new'}</span>
                        {' → '}
                        <span className="capitalize font-medium">{entry.new_status}</span>
                      </>
                    )}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{fmtDateTime(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  )
}
