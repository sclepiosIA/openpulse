import { describe, it, expect } from 'vitest'
import {
  isImmersiveHeaderPath,
  isMobileStandalonePath,
  shouldHideMobileHeader,
  shouldHideDesktopHeader,
} from '../routeConfig'

describe('routeConfig', () => {
  it.each([
    '/', '/dashboard', '/emails', '/people', '/etablissements', '/calendrier',
    '/parametres', '/forecasting', '/activite', '/churn', '/live-chat',
  ])('isImmersiveHeaderPath true for %s', (p) => {
    expect(isImmersiveHeaderPath(p)).toBe(true)
  })

  it('matches subpaths under immersive routes', () => {
    expect(isImmersiveHeaderPath('/etablissements/123')).toBe(true)
    expect(isImmersiveHeaderPath('/emails/inbox/abc')).toBe(true)
  })

  it('returns false for unknown route', () => {
    expect(isImmersiveHeaderPath('/foo')).toBe(false)
    expect(isImmersiveHeaderPath('/random/path')).toBe(false)
  })

  it('isMobileStandalonePath identifies /m/ routes', () => {
    expect(isMobileStandalonePath('/m/mail')).toBe(true)
    expect(isMobileStandalonePath('/m/install')).toBe(true)
    expect(isMobileStandalonePath('/m/jarvis/chat')).toBe(true)
    expect(isMobileStandalonePath('/m/unknown')).toBe(false)
  })

  it('shouldHideMobileHeader true on immersive OR mobile standalone', () => {
    expect(shouldHideMobileHeader('/dashboard')).toBe(true)
    expect(shouldHideMobileHeader('/m/pulse')).toBe(true)
    expect(shouldHideMobileHeader('/random')).toBe(false)
  })

  it('shouldHideDesktopHeader only for immersive paths', () => {
    expect(shouldHideDesktopHeader('/dashboard')).toBe(true)
    expect(shouldHideDesktopHeader('/m/pulse')).toBe(false)
  })

  it('does not match partial prefix like /peoples', () => {
    expect(isImmersiveHeaderPath('/peoples')).toBe(false)
  })
})
