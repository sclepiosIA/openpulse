import { describe, it, expect } from 'vitest'
import { classifyError, isUnauthorizedError } from '../errorClassifier'

describe('errorClassifier', () => {
  it('returns generic for null', () => {
    expect(classifyError(null)).toBe('generic')
  })
  it('detects unauthorized via 403 status', () => {
    expect(classifyError({ status: 403 })).toBe('unauthorized')
  })
  it('detects unauthorized via PGRST301 code', () => {
    expect(classifyError({ code: 'PGRST301' })).toBe('unauthorized')
  })
  it('detects unauthorized via RLS message', () => {
    expect(classifyError(new Error('permission denied'))).toBe('unauthorized')
  })
  it('detects notfound via 404', () => {
    expect(classifyError({ status: 404 })).toBe('notfound')
  })
  it('detects notfound via PGRST116 message', () => {
    expect(classifyError(new Error('pgrst116'))).toBe('notfound')
  })
  it('detects network errors', () => {
    expect(classifyError(new Error('Failed to fetch'))).toBe('network')
    expect(classifyError(new Error('timeout'))).toBe('network')
  })
  it('returns generic by default', () => {
    expect(classifyError(new Error('something broke'))).toBe('generic')
  })
  it('isUnauthorizedError helper', () => {
    expect(isUnauthorizedError({ status: 401 })).toBe(true)
    expect(isUnauthorizedError(new Error('oops'))).toBe(false)
  })
})
