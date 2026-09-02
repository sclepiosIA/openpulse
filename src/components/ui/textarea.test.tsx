import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React, { createRef } from "react"
import { renderHook } from "@testing-library/react"
import { Textarea } from "./textarea"

const { mockCn } = vi.hoisted(() => {
  return {
    mockCn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(" ")),
  }
})

vi.mock("@/lib/utils", () => ({
  cn: (...args: string[]) => mockCn(...args),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe("Textarea component", () => {
  it("renders with default classes and provided className", () => {
    render(<Textarea data-testid="textarea" className="custom-class" />)

    const textarea = screen.getByTestId("textarea")
    expect(textarea.tagName).toBe("TEXTAREA")
    expect(mockCn).toHaveBeenCalled()
    expect(textarea.className).toContain("custom-class")
    expect(textarea.className).toContain("min-h-[80px]")
  })

  it("passes other props to the textarea element", () => {
    render(
      <Textarea
        data-testid="textarea"
        defaultValue="initial value"
        placeholder="type here"
        disabled
      />
    )

    const textarea = screen.getByTestId("textarea") as HTMLTextAreaElement
    expect(textarea.value).toBe("initial value")
    expect(textarea.placeholder).toBe("type here")
    expect(textarea.disabled).toBe(true)
  })

  it("supports controlled value and onChange", () => {
    function Controlled() {
      const [value, setValue] = React.useState("start")
      return (
        <Textarea
          data-testid="textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )
    }

    render(<Controlled />)
    const textarea = screen.getByTestId("textarea") as HTMLTextAreaElement

    expect(textarea.value).toBe("start")

    fireEvent.change(textarea, { target: { value: "next value" } })
    expect(textarea.value).toBe("next value")
  })

  it("forwards ref to the underlying textarea element", () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Textarea ref={ref} />)

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it("has displayName set to Textarea", async () => {
    const module = await import("./textarea")
    expect(module.Textarea.displayName).toBe("Textarea")
  })
})

describe("Textarea with react-query hook wrapper", () => {
  it("renders inside QueryClientProvider without errors", () => {
    const wrapper = createWrapper()
    const { result } = renderHook(
      () => {
        return React.useState(0)
      },
      { wrapper }
    )
    expect(result.current[0]).toBe(0)

    render(
      <wrapper>
        <Textarea data-testid="textarea-in-wrapper" />
      </wrapper>
    )

    const textarea = screen.getByTestId("textarea-in-wrapper")
    expect(textarea.tagName).toBe("TEXTAREA")
  })
})