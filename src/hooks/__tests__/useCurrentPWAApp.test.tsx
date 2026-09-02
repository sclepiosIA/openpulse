import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'
import { useCurrentPWAApp } from '../system/useCurrentPWAApp'

const wrapperFor = (path: string) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  )
  return Wrapper
}

describe('useCurrentPWAApp', () => {
  it('detects /m/mail as mail app', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), { wrapper: wrapperFor('/m/mail') })
    expect(result.current).toBe('mail')
  })

  it('detects /m/pulse as pulse app', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), { wrapper: wrapperFor('/m/pulse') })
    expect(result.current).toBe('pulse')
  })

  it('detects /m/todos as todos app', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), { wrapper: wrapperFor('/m/todos') })
    expect(result.current).toBe('todos')
  })

  it('detects /m/calendrier as calendar app', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), {
      wrapper: wrapperFor('/m/calendrier'),
    })
    expect(result.current).toBe('calendar')
  })

  it('detects /m/jarvis as jarvis app', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), { wrapper: wrapperFor('/m/jarvis') })
    expect(result.current).toBe('jarvis')
  })

  it('detects /emails as mail app (desktop variant)', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), { wrapper: wrapperFor('/emails') })
    expect(result.current).toBe('mail')
  })

  it('returns main for /auth path', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), { wrapper: wrapperFor('/auth') })
    expect(result.current).toBe('main')
  })

  it('returns main for unknown authenticated paths', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), { wrapper: wrapperFor('/dashboard') })
    expect(result.current).toBe('main')
  })

  it('returns main for root', () => {
    const { result } = renderHook(() => useCurrentPWAApp(), { wrapper: wrapperFor('/') })
    expect(result.current).toBe('main')
  })
})
