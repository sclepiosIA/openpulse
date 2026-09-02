/// <reference types="vitest" />
/**
 * @vitest-environment jsdom
 */

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, act, waitFor } from "@testing-library/react"

import { useToast, toast, reducer } from "./use-toast"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  const Wrapper = ({ children }: React.PropsWithChildren) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { Wrapper, queryClient }
}

describe("use-toast.ts", () => {
  it("reducer: ADD_TOAST respecte TOAST_LIMIT=1 (garde le dernier toast ajouté)", () => {
    const state1 = reducer(
      { toasts: [] },
      {
        type: "ADD_TOAST",
        toast: {
          id: "t1",
          open: true,
          onOpenChange: () => undefined,
          title: "A",
        },
      }
    )

    const state2 = reducer(state1, {
      type: "ADD_TOAST",
      toast: {
        id: "t2",
        open: true,
        onOpenChange: () => undefined,
        title: "B",
      },
    })

    expect(state2.toasts).toHaveLength(1)
    expect(state2.toasts[0].id).toBe("t2")
    expect(state2.toasts[0].title).toBe("B")
  })

  it("useToast: état initial (toasts=[]) puis ajout via toast() et dismiss(id) ferme le toast", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper })

    expect(result.current.toasts).toEqual([])

    let created: { id: string; dismiss: () => void; update: (p: unknown) => void } | undefined

    await act(async () => {
      created = result.current.toast({ title: "Hello", description: "World" })
    })

    await waitFor(() => {
      expect(result.current.toasts).toHaveLength(1)
    })

    const t0 = result.current.toasts[0]
    expect(t0.id).toBe(created?.id)
    expect(t0.open).toBe(true)
    expect(t0.title).toBe("Hello")
    expect(t0.description).toBe("World")
    expect(typeof t0.onOpenChange).toBe("function")

    await act(async () => {
      result.current.dismiss(created?.id)
    })

    await waitFor(() => {
      expect(result.current.toasts[0].open).toBe(false)
    })
  })

  it("toast(): update() modifie le toast existant + onOpenChange(false) déclenche dismiss (open=false)", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper })

    let handle: { id: string; dismiss: () => void; update: (p: unknown) => void } | undefined

    await act(async () => {
      handle = toast({ title: "Initial", description: "D0" })
    })

    await waitFor(() => {
      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe("Initial")
      expect(result.current.toasts[0].description).toBe("D0")
    })

    await act(async () => {
      handle?.update({ title: "Updated", description: "D1" })
    })

    await waitFor(() => {
      expect(result.current.toasts[0].title).toBe("Updated")
      expect(result.current.toasts[0].description).toBe("D1")
      expect(result.current.toasts[0].id).toBe(handle?.id)
    })

    await act(async () => {
      const cb = result.current.toasts[0].onOpenChange
      cb(false)
    })

    await waitFor(() => {
      expect(result.current.toasts[0].open).toBe(false)
    })
  })

  it("DISMISS_TOAST sans toastId ferme tous les toasts existants (branche toastId undefined)", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useToast(), { wrapper: Wrapper })

    await act(async () => {
      toast({ title: "One" })
    })
    await act(async () => {
      toast({ title: "Two" })
    })

    await waitFor(() => {
      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0].title).toBe("Two")
      expect(result.current.toasts[0].open).toBe(true)
    })

    await act(async () => {
      result.current.dismiss()
    })

    await waitFor(() => {
      expect(result.current.toasts[0].open).toBe(false)
    })
  })

  it("reducer: REMOVE_TOAST sans toastId vide la liste", () => {
    const next = reducer(
      {
        toasts: [{ id: "a", open: true, onOpenChange: () => undefined, title: "A" }],
      },
      { type: "REMOVE_TOAST" }
    )
    expect(next.toasts).toEqual([])
  })

  it("reducer: REMOVE_TOAST avec toastId retire uniquement l'id ciblé", () => {
    const next = reducer(
      {
        toasts: [
          { id: "a", open: true, onOpenChange: () => undefined, title: "A" },
          { id: "b", open: true, onOpenChange: () => undefined, title: "B" },
        ],
      },
      { type: "REMOVE_TOAST", toastId: "a" }
    )
    expect(next.toasts).toHaveLength(1)
    expect(next.toasts[0].id).toBe("b")
  })
})