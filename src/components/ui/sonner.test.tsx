/* @vitest-environment jsdom */

import React from "react"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { themeState, sonnerPropsSpy, toastMock } = vi.hoisted(() => ({
  themeState: { theme: "dark" as "light" | "dark" | "system" },
  sonnerPropsSpy: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock("@/hooks/shared/useTheme", () => ({
  useTheme: () => themeState,
}))

vi.mock("sonner", () => ({
  Toaster: (
    props: React.ComponentProps<"div"> & {
      theme?: string
      toastOptions?: {
        classNames?: {
          toast?: string
          description?: string
          actionButton?: string
          cancelButton?: string
        }
      }
    },
  ) => {
    sonnerPropsSpy(props)
    return (
      <div
        data-testid="sonner"
        data-theme={props.theme}
        data-classname={props.className}
        data-expand={String(Boolean(props.expand))}
        data-visible-toasts={String(props.visibleToasts ?? "")}
      >
        mocked-sonner
      </div>
    )
  },
  toast: toastMock,
}))

import { Toaster, toast } from "./sonner"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("sonner.tsx", () => {
  afterEach(() => {
    cleanup()
    sonnerPropsSpy.mockClear()
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    toastMock.message.mockClear()
    toastMock.dismiss.mockClear()
    themeState.theme = "dark"
  })

  it("rend le composant Sonner avec le thème provenant de useTheme et les classes attendues", () => {
    themeState.theme = "dark"

    render(<Toaster richColors position="top-right" />, { wrapper: createWrapper() })

    const sonner = screen.getByTestId("sonner")
    expect(sonner).toHaveAttribute("data-theme", "dark")
    expect(sonner).toHaveAttribute("data-classname", "toaster group")

    expect(sonnerPropsSpy).toHaveBeenCalledTimes(1)
    const props = sonnerPropsSpy.mock.calls[0][0] as {
      theme: string
      className: string
      position: string
      richColors: boolean
      toastOptions: {
        classNames: {
          toast: string
          description: string
          actionButton: string
          cancelButton: string
        }
      }
    }

    expect(props.theme).toBe("dark")
    expect(props.position).toBe("top-right")
    expect(props.richColors).toBe(true)
    expect(props.className).toBe("toaster group")
    expect(props.toastOptions.classNames.toast).toContain("group-[.toaster]:bg-background")
    expect(props.toastOptions.classNames.toast).toContain("group-[.toaster]:text-foreground")
    expect(props.toastOptions.classNames.toast).toContain("group-[.toaster]:border-border")
    expect(props.toastOptions.classNames.toast).toContain("group-[.toaster]:shadow-lg")
    expect(props.toastOptions.classNames.description).toBe("group-[.toast]:text-muted-foreground")
    expect(props.toastOptions.classNames.actionButton).toContain(
      "group-[.toast]:bg-primary",
    )
    expect(props.toastOptions.classNames.actionButton).toContain(
      "group-[.toast]:text-primary-foreground",
    )
    expect(props.toastOptions.classNames.cancelButton).toContain(
      "group-[.toast]:bg-muted",
    )
    expect(props.toastOptions.classNames.cancelButton).toContain(
      "group-[.toast]:text-muted-foreground",
    )
  })

  it("propage les props supplémentaires vers Sonner et réagit au changement de thème", () => {
    themeState.theme = "light"

    const { rerender } = render(<Toaster expand visibleToasts={5} />, {
      wrapper: createWrapper(),
    })

    expect(sonnerPropsSpy).toHaveBeenCalledTimes(1)

    let props = sonnerPropsSpy.mock.calls.at(-1)?.[0] as {
      theme: string
      expand: boolean
      visibleToasts: number
    }

    expect(props.theme).toBe("light")
    expect(props.expand).toBe(true)
    expect(props.visibleToasts).toBe(5)

    themeState.theme = "system"
    rerender(<Toaster expand visibleToasts={5} />)

    expect(sonnerPropsSpy).toHaveBeenCalledTimes(2)

    props = sonnerPropsSpy.mock.calls.at(-1)?.[0] as {
      theme: string
      expand: boolean
      visibleToasts: number
    }

    expect(props.theme).toBe("system")
    expect(props.expand).toBe(true)
    expect(props.visibleToasts).toBe(5)

    const sonner = screen.getByTestId("sonner")
    expect(sonner).toHaveAttribute("data-theme", "system")
    expect(sonner).toHaveAttribute("data-expand", "true")
    expect(sonner).toHaveAttribute("data-visible-toasts", "5")
  })

  it("ré-exporte l'objet toast du module sonner", () => {
    toast.success("ok")
    toast.error("ko")
    toast.dismiss()

    expect(toast).toBe(toastMock)
    expect(toastMock.success).toHaveBeenCalledWith("ok")
    expect(toastMock.error).toHaveBeenCalledWith("ko")
    expect(toastMock.dismiss).toHaveBeenCalledTimes(1)
  })
})