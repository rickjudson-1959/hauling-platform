import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabase'
import { orgQuery } from '../../shared/utils/db'
import { useAuth } from '../auth/useAuth'
import Layout from '../../shared/components/Layout'
import {
  computeDashboardMetrics,
  type DashboardInvoice,
  type DashboardJob,
  type DashboardMetrics,
  type DashboardTruck,
  type DriverRow,
} from './metrics'

const JOB_COLS =
  'id, scheduled_for, completed_at, status, price, quantity, truck_id, driver_id, haul_types(unit)'

function money(n: number): string {
  return '$' + n.toFixed(2)
}

function formatHours(n: number): string {
  if (n === 0) return '0 hours'
  const rounded = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return `${rounded} hour${n === 1 ? '' : 's'}`
}

export default function DashboardPage() {
  const { org } = useAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!org) return
    let cancelled = false

    void (async () => {
      const [jobsRes, trucksRes, invoicesRes, driversRes] = await Promise.all([
        orgQuery('jobs', org.id, JOB_COLS),
        orgQuery('trucks', org.id, 'id, label'),
        orgQuery('invoices', org.id, 'id, status, total'),
        supabase.rpc('org_drivers'),
      ])
      if (cancelled) return

      const messages = [jobsRes.error, trucksRes.error, invoicesRes.error, driversRes.error]
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map(e => e.message)

      if (messages.length > 0) {
        setError(messages.join(' · '))
        setMetrics(null)
      } else {
        setError(null)
        setMetrics(computeDashboardMetrics(
          (jobsRes.data as DashboardJob[] | null) ?? [],
          (invoicesRes.data as DashboardInvoice[] | null) ?? [],
          (trucksRes.data as DashboardTruck[] | null) ?? [],
          (driversRes.data as DriverRow[] | null) ?? [],
          new Date(),
        ))
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [org])

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            At-a-glance numbers for {org?.name ?? 'this org'}. Dates use your local timezone.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </p>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <StatCard
                label="Jobs today"
                value={String(metrics.jobsToday)}
                hint="Scheduled for today, excluding cancelled"
              />
              <StatCard
                label="Jobs this week"
                value={String(metrics.jobsThisWeek)}
                hint="Mon–Sun local, excluding cancelled"
              />
              <StatCard
                label="Revenue"
                value={money(metrics.revenue)}
                hint="All-time sent + paid invoices"
              />
              <StatCard
                label="Open invoices"
                value={money(metrics.openInvoiceTotal)}
                hint="Draft + sent totals (unpaid)"
              />
              <StatCard
                label="Asset utilization"
                value={
                  metrics.trucksTotal === 0
                    ? '0 / 0'
                    : `${metrics.trucksUsedThisWeek} / ${metrics.trucksTotal}`
                }
                hint={`Trucks with jobs this week · ${formatHours(metrics.hoursThisWeek)} this week`}
              />
            </div>

            <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Driver completions</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Completed + invoiced jobs, all-time
                </p>
              </div>
              {metrics.driverCompletions.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-500">
                  No drivers yet. Completions will show here after jobs are assigned and finished.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Driver</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-700">Completions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.driverCompletions.map(row => (
                      <tr key={row.driverId ?? 'unassigned'} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-800">{row.label}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {row.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  )
}
