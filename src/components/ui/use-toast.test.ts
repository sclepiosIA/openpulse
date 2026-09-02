/* @vitest-environment jsdom */

import React from 'react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { STABLE_TOAST_API, successMock, errorMock, dismissMock, toastMock, messageMock } = vi.hoisted(() => {
  const successMock = vi.fn()
  const errorMock = vi.fn()
  const dismissMock = vi.fn()
  const toastMock = vi.fn()
  const messageMock = vi.fn()

  return {
    STABLE_TOAST_API: {
      toast: toastMock,
      dismiss: dismissMock,
      success: successMock,
      error: errorMock,
      message: messageMock,
    },
    successMock,
    errorMock,
    dismissMock,
    toastMock,
    messageMock,
  }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: vi.fn(() => STABLE_TOAST_API),
  toast: toastMock,
}))

import { useToast, toast } from './use-toast'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('use-toast', () => {
  it('re-exporte le hook useToast et retourne l’API toast stable attendue', () => {
    const { result } = renderHook(() => useToast(), { wrapper: createWrapper() })

    expect(result.current).toBe(STABLE_TOAST_API)
    expect(result.current.success).toBe(successMock)
    expect(result.current.error).toBe(errorMock)
    expect(result.current.dismiss).toBe(dismissMock)
    expect(result.current.toast).toBe(toastMock)
    expect(result.current.message).toBe(messageMock)
  })

  it('re-exporte la fonction toast nommée et elle correspond à celle de l’API du hook', () => {
    const { result } = renderHook(() => useToast(), { wrapper: createWrapper() })

    expect(toast).toBe(toastMock)
    expect(result.current.toast).toBe(toast)
  })

  it('permet d’appeler success, error, message et dismiss avec les vraies valeurs passées', () => {
    const { result } = renderHook(() => useToast(), { wrapper: createWrapper() })

    result.current.success('Succès')
    result.current.error('Erreur')
    result.current.message('Info')
    result.current.dismiss()

    expect(successMock).toHaveBeenCalledTimes(1)
    expect(successMock).toHaveBeenCalledWith('Succès')
    expect(errorMock).toHaveBeenCalledTimes(1)
    expect(errorMock).toHaveBeenCalledWith('Erreur')
    expect(messageMock).toHaveBeenCalledTimes(1)
    expect(messageMock).toHaveBeenCalledWith('Info')
    expect(dismissMock).toHaveBeenCalledTimes(1)
  })

  it('permet d’appeler directement le toast exporté avec une charge utile métier', () => {
    const payload = {
      title: 'Sauvegarde',
      description: 'Changements enregistrés',
      variant: 'default',
    }

    toast(payload)

    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(toastMock).toHaveBeenCalledWith(payload)
  })
})