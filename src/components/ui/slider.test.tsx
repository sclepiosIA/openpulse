// @vitest-environment jsdom

import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Slider } from "./slider"

const { ROOT_DISPLAY_NAME, cnMock } = vi.hoisted(() => ({
  ROOT_DISPLAY_NAME: "RadixSliderRoot",
  cnMock: vi.fn((...classes: Array<string | undefined>) => classes.filter(Boolean).join(" ")),
}))

vi.mock("@/lib/utils", () => ({
  cn: cnMock,
}))

vi.mock("@radix-ui/react-slider", async () => {
  const ReactModule = await import("react")

  const Root = ReactModule.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & {
      value?: number[]
      defaultValue?: number[]
      min?: number
      max?: number
      step?: number
      disabled?: boolean
      onValueChange?: (value: number[]) => void
    }
  >(({ children, className, value, defaultValue, min, max, step, disabled, onValueChange, ...props }, ref) => {
    const currentValue = value ?? defaultValue ?? []
    return (
      <span
        ref={ref}
        data-testid="slider-root"
        data-value={JSON.stringify(currentValue)}
        data-min={min}
        data-max={max}
        data-step={step}
        data-disabled={disabled ? "true" : "false"}
        className={className}
        onClick={() => onValueChange?.([42])}
        {...props}
      >
        {children}
      </span>
    )
  })
  Root.displayName = ROOT_DISPLAY_NAME

  const Track = ({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="slider-track" className={className} {...props}>
      {children}
    </span>
  )

  const Range = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="slider-range" className={className} {...props} />
  )

  const Thumb = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid="slider-thumb" className={className} {...props} />
  )

  return {
    Root,
    Track,
    Range,
    Thumb,
  }
})

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

describe("Slider", () => {
  it("rend la structure avec les classes métier attendues et fusionne className", () => {
    const ref = React.createRef<HTMLSpanElement>()
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <Slider ref={ref} className="custom-class" defaultValue={[25]} min={0} max={100} step={5} />
      </Wrapper>
    )

    const root = screen.getByTestId("slider-root")
    const track = screen.getByTestId("slider-track")
    const range = screen.getByTestId("slider-range")
    const thumb = screen.getByTestId("slider-thumb")

    expect(cnMock).toHaveBeenCalledWith(
      "relative flex w-full touch-none select-none items-center",
      "custom-class"
    )
    expect(root).toHaveClass("relative", "flex", "w-full", "touch-none", "select-none", "items-center", "custom-class")
    expect(root).toHaveAttribute("data-value", "[25]")
    expect(root).toHaveAttribute("data-min", "0")
    expect(root).toHaveAttribute("data-max", "100")
    expect(root).toHaveAttribute("data-step", "5")
    expect(track).toHaveClass("relative", "h-2", "w-full", "grow", "overflow-hidden", "rounded-full", "bg-secondary")
    expect(range).toHaveClass("absolute", "h-full", "bg-primary")
    expect(thumb).toHaveClass(
      "block",
      "h-5",
      "w-5",
      "rounded-full",
      "border-2",
      "border-primary",
      "bg-background",
      "ring-offset-background",
      "transition-colors",
      "focus-visible:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "focus-visible:ring-offset-2",
      "disabled:pointer-events-none",
      "disabled:opacity-50"
    )
    expect(ref.current).toBe(root)
  })

  it("propage les props fonctionnelles au composant racine", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const Wrapper = createWrapper()

    render(
      <Wrapper>
        <Slider
          aria-label="Volume"
          value={[10]}
          min={0}
          max={50}
          step={10}
          disabled
          onValueChange={onValueChange}
        />
      </Wrapper>
    )

    const root = screen.getByLabelText("Volume")

    expect(root).toHaveAttribute("data-value", "[10]")
    expect(root).toHaveAttribute("data-min", "0")
    expect(root).toHaveAttribute("data-max", "50")
    expect(root).toHaveAttribute("data-step", "10")
    expect(root).toHaveAttribute("data-disabled", "true")

    await user.click(root)

    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith([42])
  })

  it("expose le displayName de Radix Root", () => {
    expect(Slider.displayName).toBe(ROOT_DISPLAY_NAME)
  })
})