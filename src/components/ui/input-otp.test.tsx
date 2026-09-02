// @vitest-environment jsdom
import * as React from "react"
import { render, screen } from "@testing-library/react"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const { stableCn, otpContextValue, otpInputSpy, dotSpy } = vi.hoisted(() => ({
  stableCn: vi.fn((...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" ")
  ),
  otpContextValue: {
    slots: [
      { char: "1", hasFakeCaret: false, isActive: false },
      { char: "2", hasFakeCaret: true, isActive: true },
      { char: "", hasFakeCaret: false, isActive: false },
    ],
  },
  otpInputSpy: vi.fn(),
  dotSpy: vi.fn(),
}))

vi.mock("@/lib/utils", () => ({
  cn: stableCn,
}))

vi.mock("lucide-react", () => ({
  Dot: (props: React.ComponentProps<"svg">) => {
    dotSpy(props)
    return <svg data-testid="dot-icon" {...props} />
  },
}))

vi.mock("input-otp", async () => {
  const ReactModule = await import("react")

  const OTPInputContext = ReactModule.createContext(otpContextValue)

  const OTPInput = ReactModule.forwardRef<
    HTMLInputElement,
    React.ComponentPropsWithoutRef<"input"> & { containerClassName?: string }
  >(({ containerClassName, className, ...props }, ref) => {
    otpInputSpy({ containerClassName, className, props })
    const inputProps = { ...props }
    return (
      <div data-testid="otp-container" className={containerClassName}>
        <input ref={ref} data-testid="otp-input" className={className} {...inputProps} />
      </div>
    )
  })
  OTPInput.displayName = "MockOTPInput"

  return {
    OTPInput,
    OTPInputContext,
  }
})

import { OTPInputContext } from "input-otp"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "./input-otp"

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

describe("input-otp", () => {
  it("renders InputOTP and forwards merged classes, props and ref to OTPInput", () => {
    const ref = React.createRef<HTMLInputElement>()

    render(
      <InputOTP
        ref={ref}
        className="custom-input"
        containerClassName="custom-container"
        value="12"
        disabled
        aria-label="OTP field"
      />
    )

    const input = screen.getByTestId("otp-input")
    const container = screen.getByTestId("otp-container")

    expect(input).toHaveValue("12")
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute("aria-label", "OTP field")
    expect(container.className).toContain("flex items-center gap-2 has-[:disabled]:opacity-50")
    expect(container.className).toContain("custom-container")
    expect(input.className).toContain("disabled:cursor-not-allowed")
    expect(input.className).toContain("custom-input")
    expect(ref.current).toBe(input)
    expect(otpInputSpy).toHaveBeenCalledTimes(1)
    expect(otpInputSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        containerClassName: "flex items-center gap-2 has-[:disabled]:opacity-50 custom-container",
        className: "disabled:cursor-not-allowed custom-input",
        props: expect.objectContaining({
          value: "12",
          disabled: true,
          "aria-label": "OTP field",
        }),
      })
    )
  })

  it("renders InputOTPGroup as a div with merged classes and children", () => {
    render(
      <InputOTPGroup data-testid="group" className="extra-group">
        <span>slot group</span>
      </InputOTPGroup>
    )

    const group = screen.getByTestId("group")
    expect(group.tagName).toBe("DIV")
    expect(group.className).toContain("flex items-center")
    expect(group.className).toContain("extra-group")
    expect(screen.getByText("slot group")).toBeInTheDocument()
  })

  it("renders InputOTPSlot with char, active styles and fake caret from context", () => {
    render(
      <OTPInputContext.Provider value={otpContextValue}>
        <InputOTPSlot index={1} data-testid="slot" className="custom-slot" />
      </OTPInputContext.Provider>
    )

    const slot = screen.getByTestId("slot")
    expect(slot).toHaveTextContent("2")
    expect(slot.className).toContain("relative flex h-10 w-10 items-center justify-center")
    expect(slot.className).toContain("z-10 ring-2 ring-ring ring-offset-background")
    expect(slot.className).toContain("custom-slot")

    const caret = slot.querySelector(".animate-caret-blink")
    expect(caret).not.toBeNull()
    expect(caret?.className).toContain("bg-foreground")
  })

  it("renders InputOTPSlot without active ring or caret when slot state is inactive", () => {
    render(
      <OTPInputContext.Provider value={otpContextValue}>
        <InputOTPSlot index={0} data-testid="slot-no-caret" />
      </OTPInputContext.Provider>
    )

    const slot = screen.getByTestId("slot-no-caret")
    expect(slot).toHaveTextContent("1")
    expect(slot.className).not.toContain("z-10 ring-2 ring-ring ring-offset-background")
    expect(slot.querySelector(".animate-caret-blink")).toBeNull()
  })

  it("renders InputOTPSeparator with separator role and Dot icon", () => {
    render(<InputOTPSeparator data-testid="separator" />)

    const separator = screen.getByTestId("separator")
    expect(separator).toHaveAttribute("role", "separator")
    expect(screen.getByTestId("dot-icon")).toBeInTheDocument()
    expect(dotSpy).toHaveBeenCalledTimes(1)
  })

  it("supports renderHook with QueryClientProvider wrapper and exposes stable component exports", () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () => ({
        isLoading: false,
        isError: false,
        exportsOk: [
          typeof InputOTP,
          typeof InputOTPGroup,
          typeof InputOTPSlot,
          typeof InputOTPSeparator,
        ].every((kind) => kind === "object" || kind === "function"),
      }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.exportsOk).toBe(true)
  })
})