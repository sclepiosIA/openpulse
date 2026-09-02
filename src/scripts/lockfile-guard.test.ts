import { describe, expect, it } from 'vitest'

import { findForbiddenLockfiles } from '../../scripts/lockfile-guard.mjs'

describe('findForbiddenLockfiles', () => {
  it('allows the historical root bun.lock while keeping npm as package manager', () => {
    expect(findForbiddenLockfiles(['bun.lock'])).toEqual([])
  })

  it('still blocks active non-npm lockfiles', () => {
    expect(findForbiddenLockfiles(['bun.lockb', 'pnpm-lock.yaml', 'yarn.lock'])).toEqual([
      'bun.lockb',
      'pnpm-lock.yaml',
      'yarn.lock',
    ])
  })
})
