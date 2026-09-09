import { describe, expect, it } from 'vitest'
import {
  computeDashboardMetrics,
  isInLocalRange,
  startOfLocalDay,
  startOfLocalWeekMonday,
  startOfNextLocalDay,
  startOfNextLocalWeek,
  toNumber,
  type DashboardInvoice,
  type DashboardJob,
  type DriverRow,
} from './metrics'

function iso(local: string): string {
  return new Date(local).toISOString()
}

function job(partial: Partial<DashboardJob>): DashboardJob {
  return {
    scheduled_for: null,
    completed_at: null,
    status: 'scheduled',
    price: null,
    quantity: null,
    truck_id: null,
    driver_id: null,
    haul_types: null,
    ...partial,
  }
}

describe('toNumber', () => {
  it('coerces numeric strings and ignores junk', () => {
    expect(toNumber(250)).toBe(250)
    expect(toNumber('250.50')).toBe(250.5)
    expect(toNumber(null)).toBe(0)
    expect(toNumber('')).toBe(0)
    expect(toNumber('nope')).toBe(0)
  })
})

describe('local date windows', () => {
  it('uses a Monday-start local week', () => {
    const wednesday = new Date(2026, 8, 9, 15, 30) // Wed Sep 9 2026
    const weekStart = startOfLocalWeekMonday(wednesday)
    expect(weekStart).toEqual(new Date(2026, 8, 7))
    expect(startOfNextLocalWeek(wednesday)).toEqual(new Date(2026, 8, 14))
    expect(startOfLocalDay(wednesday)).toEqual(new Date(2026, 8, 9))
    expect(startOfNextLocalDay(wednesday)).toEqual(new Date(2026, 8, 10))
  })

  it('treats Sunday as the end of the current Monday week', () => {
    const sunday = new Date(2026, 8, 13, 8)
    expect(startOfLocalWeekMonday(sunday)).toEqual(new Date(2026, 8, 7))
  })

  it('includes the start instant and excludes the end', () => {
    const start = new Date(2026, 8, 9)
    const end = new Date(2026, 8, 10)
    expect(isInLocalRange(iso('2026-09-09T00:00:00'), start, end)).toBe(true)
    expect(isInLocalRange(iso('2026-09-09T23:59:59'), start, end)).toBe(true)
    expect(isInLocalRange(iso('2026-09-10T00:00:00'), start, end)).toBe(false)
    expect(isInLocalRange(null, start, end)).toBe(false)
  })
})

describe('computeDashboardMetrics', () => {
  const now = new Date(2026, 8, 9, 10) // Wed Sep 9 2026

  const drivers: DriverRow[] = [
    { membership_id: 'drv-a', email: 'ann@example.com' },
    { membership_id: 'drv-b', email: 'bob@example.com' },
  ]

  it('returns zeros for an empty org', () => {
    const m = computeDashboardMetrics([], [], [], [], now)
    expect(m).toEqual({
      jobsToday: 0,
      jobsThisWeek: 0,
      revenue: 0,
      trucksUsedThisWeek: 0,
      trucksTotal: 0,
      hoursThisWeek: 0,
      openInvoiceTotal: 0,
      driverCompletions: [],
    })
  })

  it('counts today and this week from scheduled_for and skips cancelled', () => {
    const jobs = [
      job({ scheduled_for: iso('2026-09-09T09:00:00'), status: 'assigned', truck_id: 't1' }),
      job({ scheduled_for: iso('2026-09-09T14:00:00'), status: 'cancelled', truck_id: 't1' }),
      job({ scheduled_for: iso('2026-09-08T09:00:00'), status: 'completed', truck_id: 't2' }),
      job({ scheduled_for: iso('2026-09-01T09:00:00'), status: 'scheduled', truck_id: 't1' }),
      job({ scheduled_for: null, status: 'scheduled' }),
    ]
    const m = computeDashboardMetrics(jobs, [], [{ id: 't1' }, { id: 't2' }], [], now)
    expect(m.jobsToday).toBe(1)
    expect(m.jobsThisWeek).toBe(2)
    expect(m.trucksUsedThisWeek).toBe(2)
    expect(m.trucksTotal).toBe(2)
  })

  it('sums sent+paid revenue and draft+sent open invoices', () => {
    const invoices: DashboardInvoice[] = [
      { status: 'draft', total: 10 },
      { status: 'sent', total: '250' },
      { status: 'paid', total: 40 },
      { status: 'void', total: 999 },
    ]
    const m = computeDashboardMetrics([], invoices, [], [], now)
    expect(m.revenue).toBe(290)
    expect(m.openInvoiceTotal).toBe(260)
  })

  it('sums hour-unit quantities this week and ignores other units', () => {
    const jobs = [
      job({
        scheduled_for: iso('2026-09-09T09:00:00'),
        quantity: '3.5',
        haul_types: { unit: 'hours' },
        truck_id: 't1',
      }),
      job({
        scheduled_for: iso('2026-09-09T11:00:00'),
        quantity: 3000,
        haul_types: { unit: 'litres' },
        truck_id: 't1',
      }),
    ]
    const m = computeDashboardMetrics(jobs, [], [{ id: 't1' }], [], now)
    expect(m.hoursThisWeek).toBe(3.5)
  })

  it('counts completed and invoiced jobs per driver, including zeros and unassigned', () => {
    const jobs = [
      job({ status: 'completed', driver_id: 'drv-a' }),
      job({ status: 'invoiced', driver_id: 'drv-a' }),
      job({ status: 'completed', driver_id: null }),
      job({ status: 'scheduled', driver_id: 'drv-a' }),
      job({ status: 'completed', driver_id: 'gone' }),
    ]
    const m = computeDashboardMetrics(jobs, [], [], drivers, now)
    expect(m.driverCompletions).toEqual([
      { driverId: 'drv-a', label: 'ann@example.com', count: 2 },
      { driverId: null, label: 'Unassigned', count: 1 },
      { driverId: 'gone', label: 'Unknown driver', count: 1 },
      { driverId: 'drv-b', label: 'bob@example.com', count: 0 },
    ])
  })

  it('matches the live June org snapshot when viewed in September', () => {
    const jobs = [
      job({
        scheduled_for: '2026-06-17T22:00:00+00',
        completed_at: '2026-06-17T21:25:46.858+00',
        status: 'invoiced',
        price: 250,
        quantity: 3000,
        truck_id: 'truck-1',
        driver_id: 'drv-a',
        haul_types: { unit: 'litres' },
      }),
    ]
    const invoices: DashboardInvoice[] = [{ status: 'sent', total: 250 }]
    const m = computeDashboardMetrics(
      jobs,
      invoices,
      [{ id: 'truck-1' }, { id: 'truck-2' }],
      drivers,
      now,
    )
    expect(m.jobsToday).toBe(0)
    expect(m.jobsThisWeek).toBe(0)
    expect(m.revenue).toBe(250)
    expect(m.openInvoiceTotal).toBe(250)
    expect(m.trucksUsedThisWeek).toBe(0)
    expect(m.trucksTotal).toBe(2)
    expect(m.hoursThisWeek).toBe(0)
    expect(m.driverCompletions.find(d => d.driverId === 'drv-a')?.count).toBe(1)
  })
})
