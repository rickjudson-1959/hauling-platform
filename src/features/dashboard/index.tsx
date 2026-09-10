import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HAUL_SERVICES } from '../../shared/brand/services'
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

function isGettingStarted(m: DashboardMetrics): boolean {
  return m.trucksTotal === 0 && m.jobsThisWeek === 0 && m.revenue === 0
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
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            At-a-glance numbers for {org?.name ?? 'this org'}. Dates use your local timezone.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <p className="rounded-card border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        ) : metrics ? (
          <>
            {isGettingStarted(metrics) && <GettingStarted />}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

            <section className="overflow-hidden rounded-card border border-gray-100 bg-white shadow-card">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-900">Driver completions</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Completed + invoiced jobs, all-time
                </p>
              </div>
              {metrics.driverCompletions.length === 0 ? (
                <div className="space-y-3 px-5 py-8">
                  <p className="text-sm text-gray-500">
                    No drivers yet. Completions will show here after jobs are assigned and finished.
                  </p>
                  <Link
                    to="/settings"
                    className="inline-flex text-sm font-medium text-brand hover:underline"
                  >
                    Invite a driver
                  </Link>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium text-gray-700">Driver</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-700">Completions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {metrics.driverCompletions.map(row => (
                      <tr key={row.driverId ?? 'unassigned'} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-gray-800">{row.label}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900">
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

function GettingStarted() {
  return (
    <section className="overflow-hidden rounded-card border border-gray-100 bg-white shadow-card">
      <div className="flex flex-col gap-4 p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">
            Nothing on the board yet
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Local hauling for any truck type. Add a truck and a job to start the day. The tiles below stay at zero until this organisation has data.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {HAUL_SERVICES.map(service => (
            <figure key={service.id} className="overflow-hidden rounded-xl border border-gray-100 bg-canvas">
              <img
                src={service.src}
                alt=""
                className="h-28 w-full object-cover"
              />
              <figcaption className="px-3 py-2 text-sm font-medium text-gray-800">
                {service.label}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/trucks"
            className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Add a truck
          </Link>
          <Link
            to="/jobs"
            className="inline-flex min-h-10 items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Add a job
          </Link>
          <Link
            to="/settings"
            className="inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-sm font-medium text-brand hover:underline"
          >
            Invite a driver
          </Link>
        </div>
      </div>
    </section>
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
    <div className="rounded-card border border-gray-100 bg-white p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-400">{hint}</p>
    </div>
  )
}
