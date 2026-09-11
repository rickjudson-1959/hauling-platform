import { describe, expect, it } from 'vitest'
import {
  canShowCollectSection,
  chargeBreakdown,
  clientPublishableKey,
  formatCad,
  isChargeableCents,
  shouldFulfillOnsitePayment,
} from './payment'

describe('chargeBreakdown', () => {
  it('returns null when price is missing or zero', () => {
    expect(chargeBreakdown(null, null)).toBeNull()
    expect(chargeBreakdown(0, 5)).toBeNull()
    expect(chargeBreakdown('', null)).toBeNull()
  })

  it('uses only a supplied tax_amount and does not invent tax', () => {
    const noTax = chargeBreakdown(100, null)
    expect(noTax).toEqual({
      priceDollars: 100,
      taxDollars: 0,
      totalDollars: 100,
      amountCents: 10000,
      showTax: false,
    })

    const withTax = chargeBreakdown('80.10', '8.01')
    expect(withTax?.showTax).toBe(true)
    expect(withTax?.amountCents).toBe(8811)
  })
})

describe('formatCad', () => {
  it('formats Canadian dollars', () => {
    expect(formatCad(12.5)).toMatch(/12\.50/)
  })
})

describe('canShowCollectSection', () => {
  it('shows collect on on-site and completed jobs', () => {
    expect(canShowCollectSection('on_site', 'unpaid')).toBe(true)
    expect(canShowCollectSection('completed', 'unpaid')).toBe(true)
    expect(canShowCollectSection('invoiced', 'unpaid')).toBe(true)
  })

  it('always shows the section when already paid', () => {
    expect(canShowCollectSection('invoiced', 'paid')).toBe(true)
    expect(canShowCollectSection('on_site', 'paid')).toBe(true)
  })

  it('hides cancelled jobs and hides early statuses that are unpaid', () => {
    expect(canShowCollectSection('cancelled', 'unpaid')).toBe(false)
    expect(canShowCollectSection('cancelled', 'paid')).toBe(false)
    expect(canShowCollectSection('assigned', 'unpaid')).toBe(false)
    expect(canShowCollectSection('en_route', 'unpaid')).toBe(false)
  })
})

describe('shouldFulfillOnsitePayment', () => {
  it('fulfills and emails only the first success', () => {
    expect(shouldFulfillOnsitePayment({
      alreadyProcessedEvent: false,
      jobAlreadyPaid: false,
    })).toEqual({ fulfill: true, sendEmail: true })
  })

  it('does not double-mark paid or double-email', () => {
    expect(shouldFulfillOnsitePayment({
      alreadyProcessedEvent: true,
      jobAlreadyPaid: false,
    })).toEqual({ fulfill: false, sendEmail: false })
    expect(shouldFulfillOnsitePayment({
      alreadyProcessedEvent: false,
      jobAlreadyPaid: true,
    })).toEqual({ fulfill: false, sendEmail: false })
  })
})

describe('clientPublishableKey', () => {
  it('prefers the Vite test publishable key and rejects live keys', () => {
    expect(clientPublishableKey('pk_test_vite', 'pk_test_server')).toBe('pk_test_vite')
    expect(clientPublishableKey('pk_live_nope', 'pk_test_server')).toBe('pk_test_server')
    expect(clientPublishableKey(undefined, undefined)).toBeNull()
  })
})

describe('isChargeableCents', () => {
  it('rejects amounts below Stripe CAD minimum', () => {
    expect(isChargeableCents(49)).toBe(false)
    expect(isChargeableCents(50)).toBe(true)
  })
})
