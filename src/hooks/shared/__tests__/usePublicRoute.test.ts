import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { usePublicRoute } from '../usePublicRoute'

const wrapper = (initialEntries: string[]) =>
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(MemoryRouter, { initialEntries }, children)

describe('usePublicRoute', () => {
  it('returns true for /utilisateurs', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/utilisateurs']) })
    expect(result.current).toBe(true)
  })
  it('returns true for /m/myapp/install', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/m/myapp/install']) })
    expect(result.current).toBe(true)
  })
  it('returns true for /m/install', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/m/install']) })
    expect(result.current).toBe(true)
  })
  it('returns true for /rdv/some-id', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/rdv/abc-123']) })
    expect(result.current).toBe(true)
  })
  it('returns true for /f/slug', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/f/my-form']) })
    expect(result.current).toBe(true)
  })
  it('returns true for /dpo-exemple', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/dpo-exemple']) })
    expect(result.current).toBe(true)
  })
  it('returns false for /dashboard', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/dashboard']) })
    expect(result.current).toBe(false)
  })
  it('returns false for /etablissements', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/etablissements']) })
    expect(result.current).toBe(false)
  })
  it('returns false for /m/myapp (without install)', () => {
    const { result } = renderHook(() => usePublicRoute(), { wrapper: wrapper(['/m/myapp']) })
    expect(result.current).toBe(false)
  })
})
