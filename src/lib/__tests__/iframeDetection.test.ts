import { describe, it, expect, beforeEach } from 'vitest'
import { isApercuTiers, isThirdPartyIframe } from '../iframeDetection'

// Module caches results, so we can only test current state once per import.
describe('iframeDetection', () => {
  beforeEach(() => {
    // jsdom default origin is http://localhost:3000 -> not la plateforme initiale
  })

  it('isApercuTiers returns boolean', () => {
    expect(typeof isApercuTiers()).toBe('boolean')
  })

  it('isThirdPartyIframe returns boolean', () => {
    expect(typeof isThirdPartyIframe()).toBe('boolean')
  })

  it('returns cached value on subsequent calls', () => {
    const a = isApercuTiers()
    const b = isApercuTiers()
    expect(a).toBe(b)
  })
})
