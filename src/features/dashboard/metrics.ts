/** Statuses that still count as work on the board (everything except cancelled). */
export const COUNTED_JOB_STATUSES = new Set([
  'scheduled',
  'assigned',
  'en_route',
  'on_site',
  'completed',
  'invoiced',
])

/** Jobs a driver has finished (invoiced still counts as a completion). */
export const COMPLETED_JOB_STATUSES = new Set(['completed', 'invoiced'])

/** Billed revenue: sent (owed) plus paid (collected). Draft and void are excluded. */
export const REVENUE_INVOICE_STATUSES = new Set(['sent', 'paid'])

/** Ticket 8 open/unpaid statuses. Paid and void are excluded. */
export const OPEN_INVOICE_STATUSES = new Set(['draft', 'sent'])

export interface DashboardJob {
  scheduled_for: string | null
  completed_at: string | null
  status: string
  price: number | string | null
  quantity: number | string | null
  truck_id: string | null
  driver_id: string | null
  haul_types: { unit: string } | null
}

export interface DashboardInvoice {
  status: string
  total: number | string | null
}

export interface DashboardTruck {
  id: string
}

export interface DriverRow {
  membership_id: string
  email: string
}

export interface DriverCompletion {
  driverId: string | null
  label: string
  count: number
}

export interface DashboardMetrics {
  jobsToday: number
  jobsThisWeek: number
  revenue: number
  trucksUsedThisWeek: number
  trucksTotal: number
  hoursThisWeek: number
  openInvoiceTotal: number
  driverCompletions: DriverCompletion[]
}

export function toNumber(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function startOfNextLocalDay(now: Date): Date {
  const start = startOfLocalDay(now)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
}

/** Local week starts Monday 00:00 and ends Sunday 23:59:59 (half-open [Mon, next Mon)). */
export function startOfLocalWeekMonday(now: Date): Date {
  const start = startOfLocalDay(now)
  const day = start.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() - daysFromMonday)
}

export function startOfNextLocalWeek(now: Date): Date {
  const start = startOfLocalWeekMonday(now)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
}

export function isInLocalRange(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= start.getTime() && t < end.getTime()
}

function isCountedJob(job: DashboardJob): boolean {
  return COUNTED_JOB_STATUSES.has(job.status)
}

function weekJobs(jobs: DashboardJob[], now: Date): DashboardJob[] {
  const start = startOfLocalWeekMonday(now)
  const end = startOfNextLocalWeek(now)
  return jobs.filter(j => isCountedJob(j) && isInLocalRange(j.scheduled_for, start, end))
}

export function computeDashboardMetrics(
  jobs: DashboardJob[],
  invoices: DashboardInvoice[],
  trucks: DashboardTruck[],
  drivers: DriverRow[],
  now: Date,
): DashboardMetrics {
  const todayStart = startOfLocalDay(now)
  const todayEnd = startOfNextLocalDay(now)
  const thisWeek = weekJobs(jobs, now)

  const jobsToday = jobs.filter(
    j => isCountedJob(j) && isInLocalRange(j.scheduled_for, todayStart, todayEnd),
  ).length

  const revenue = invoices
    .filter(inv => REVENUE_INVOICE_STATUSES.has(inv.status))
    .reduce((sum, inv) => sum + toNumber(inv.total), 0)

  const openInvoiceTotal = invoices
    .filter(inv => OPEN_INVOICE_STATUSES.has(inv.status))
    .reduce((sum, inv) => sum + toNumber(inv.total), 0)

  const usedTruckIds = new Set(
    thisWeek.map(j => j.truck_id).filter((id): id is string => Boolean(id)),
  )

  const hoursThisWeek = thisWeek
    .filter(j => j.haul_types?.unit === 'hours')
    .reduce((sum, j) => sum + toNumber(j.quantity), 0)

  const counts = new Map<string | null, number>()
  for (const job of jobs) {
    if (!COMPLETED_JOB_STATUSES.has(job.status)) continue
    const key = job.driver_id
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const driverCompletions: DriverCompletion[] = drivers.map(d => ({
    driverId: d.membership_id,
    label: d.email,
    count: counts.get(d.membership_id) ?? 0,
  }))

  for (const [driverId, count] of counts) {
    if (driverId && !drivers.some(d => d.membership_id === driverId)) {
      driverCompletions.push({
        driverId,
        label: 'Unknown driver',
        count,
      })
    }
  }

  const unassigned = counts.get(null) ?? 0
  if (unassigned > 0) {
    driverCompletions.push({ driverId: null, label: 'Unassigned', count: unassigned })
  }

  driverCompletions.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label)
  })

  return {
    jobsToday,
    jobsThisWeek: thisWeek.length,
    revenue,
    trucksUsedThisWeek: usedTruckIds.size,
    trucksTotal: trucks.length,
    hoursThisWeek,
    openInvoiceTotal,
    driverCompletions,
  }
}
