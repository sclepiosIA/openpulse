/* @vitest-environment jsdom */

import { queryDefaults } from './queryDefaults'

describe('queryDefaults', () => {
  it('exports exactly the expected domains', () => {
    const domains = Object.keys(queryDefaults).sort()
    expect(domains).toEqual(['crm', 'email', 'rh', 'tasks', 'tresorerie'])
  })

  it('exposes the expected values for email defaults', () => {
    expect(queryDefaults.email).toEqual({
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    })
  })

  it('exposes the expected values for crm defaults', () => {
    expect(queryDefaults.crm).toEqual({
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 2,
    })
  })

  it('exposes the expected values for rh defaults', () => {
    expect(queryDefaults.rh).toEqual({
      staleTime: 10 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    })
  })

  it('exposes the expected values for tresorerie defaults', () => {
    expect(queryDefaults.tresorerie).toEqual({
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    })
  })

  it('exposes the expected values for tasks defaults', () => {
    expect(queryDefaults.tasks).toEqual({
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    })
  })

  it('keeps a uniform structure across all domains', () => {
    const entries = Object.entries(queryDefaults)

    expect(entries).toHaveLength(5)

    for (const [, config] of entries) {
      expect(Object.keys(config).sort()).toEqual([
        'gcTime',
        'refetchOnReconnect',
        'refetchOnWindowFocus',
        'retry',
        'staleTime',
      ])
      expect(typeof config.staleTime).toBe('number')
      expect(typeof config.gcTime).toBe('number')
      expect(typeof config.refetchOnWindowFocus).toBe('boolean')
      expect(typeof config.refetchOnReconnect).toBe('boolean')
      expect(typeof config.retry).toBe('number')
      expect(config.refetchOnWindowFocus).toBe(false)
      expect(config.refetchOnReconnect).toBe(false)
    }
  })

  it('uses positive cache timings and retry counts in expected bounds', () => {
    for (const config of Object.values(queryDefaults)) {
      expect(config.staleTime).toBeGreaterThan(0)
      expect(config.gcTime).toBeGreaterThan(0)
      expect(config.gcTime).toBeGreaterThanOrEqual(config.staleTime)
      expect(config.retry).toBeGreaterThanOrEqual(1)
      expect(config.retry).toBeLessThanOrEqual(2)
    }
  })

  it('applies domain freshness policies consistently', () => {
    expect(queryDefaults.tasks.staleTime).toBeLessThan(queryDefaults.email.staleTime)
    expect(queryDefaults.email.staleTime).toBeLessThan(queryDefaults.crm.staleTime)
    expect(queryDefaults.crm.staleTime).toBeLessThan(queryDefaults.rh.staleTime)

    expect(queryDefaults.email.gcTime).toBe(queryDefaults.tasks.gcTime)
    expect(queryDefaults.crm.gcTime).toBe(queryDefaults.rh.gcTime)
    expect(queryDefaults.rh.gcTime).toBe(queryDefaults.tresorerie.gcTime)
  })

  it('assigns the highest retry only to crm', () => {
    const retries = Object.entries(queryDefaults).map(([domain, config]) => ({
      domain,
      retry: config.retry,
    }))

    expect(retries.filter((entry) => entry.retry === 2)).toEqual([{ domain: 'crm', retry: 2 }])
    expect(
      retries
        .filter((entry) => entry.retry === 1)
        .map((entry) => entry.domain)
        .sort()
    ).toEqual(['email', 'rh', 'tasks', 'tresorerie'])
  })

  it('contains no duplicate staleTime/gcTime policy pair for all domains', () => {
    const signatures = Object.values(queryDefaults).map(
      (config) => `${config.staleTime}-${config.gcTime}-${config.retry}`
    )
    expect(new Set(signatures).size).toBe(5)
  })
})
