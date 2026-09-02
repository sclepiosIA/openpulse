import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const {
  mockUseEmblaCarousel,
  emblaApiMock,
  mockCnClassName,
  mockButton,
  emblaApiWithPrevEnabled,
} = vi.hoisted(() => {
  const emblaApiMockInner = {
    canScrollPrev: vi.fn().mockReturnValue(false),
    canScrollNext: vi.fn().mockReturnValue(true),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }

  const emblaApiWithPrevEnabledInner = {
    canScrollPrev: vi.fn().mockReturnValue(true),
    canScrollNext: vi.fn().mockReturnValue(true),
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }

  let currentApi = emblaApiMockInner

  const mockUseEmblaCarouselInner = vi.fn(() => {
    const refCallback = vi.fn()
    return [refCallback, currentApi]
  })

  const mockCnInner = vi.fn((...classes: string[]) =>
    classes.filter(Boolean).join(" ")
  )

  const MockButtonInner: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
    children,
    className,
    ...props
  }) => (
    <button data-testid="mock-button" className={className} {...props}>
      {children}
    </button>
  )

  return {
    mockUseEmblaCarousel: mockUseEmblaCarouselInner,
    emblaApiMock: emblaApiMockInner,
    mockCnClassName: mockCnInner,
    mockButton: MockButtonInner,
    emblaApiWithPrevEnabled: emblaApiWithPrevEnabledInner,
  }
})

vi.mock("embla-carousel-react", () => ({
  __esModule: true,
  default: mockUseEmblaCarousel,
}))

vi.mock("lucide-react", () => ({
  __esModule: true,
  ArrowLeft: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-arrow-left" {...props} />
  ),
  ArrowRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-arrow-right" {...props} />
  ),
}))

vi.mock("@/lib/utils", () => ({
  __esModule: true,
  cn: (...classes: string[]) => mockCnClassName(...classes),
}))

vi.mock("@/components/ui/button", () => ({
  __esModule: true,
  Button: mockButton,
}))

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "./carousel"

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithProviders(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  )
}

describe("Carousel", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("renders basic horizontal carousel with items and navigation", () => {
    renderWithProviders(
      <Carousel>
        <CarouselContent data-testid="carousel-content">
          <CarouselItem data-testid="carousel-item-1">Slide 1</CarouselItem>
          <CarouselItem data-testid="carousel-item-2">Slide 2</CarouselItem>
        </CarouselContent>
        <CarouselPrevious data-testid="carousel-prev" />
        <CarouselNext data-testid="carousel-next" />
      </Carousel>
    )

    expect(screen.getByRole("region")).toHaveAttribute(
      "aria-roledescription",
      "carousel"
    )

    const item1 = screen.getByTestId("carousel-item-1")
    expect(item1).toHaveAttribute("role", "group")
    expect(item1).toHaveAttribute("aria-roledescription", "slide")
    expect(item1).toHaveTextContent("Slide 1")

    const prevButton = screen.getByTestId("carousel-prev")
    const nextButton = screen.getByTestId("carousel-next")

    expect(prevButton).toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    expect(screen.getByTestId("icon-arrow-left")).toBeInTheDocument()
    expect(screen.getByTestId("icon-arrow-right")).toBeInTheDocument()
  })

  it("calls scrollNext and scrollPrev on arrow key presses", () => {
    renderWithProviders(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
        </CarouselContent>
      </Carousel>
    )

    const region = screen.getByRole("region")

    fireEvent.keyDown(region, { key: "ArrowRight" })
    expect(emblaApiMock.scrollNext).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(region, { key: "ArrowLeft" })
    expect(emblaApiMock.scrollPrev).toHaveBeenCalledTimes(1)
  })

  it("calls scrollNext and scrollPrev when navigation buttons are clicked", () => {
    emblaApiMock.canScrollPrev.mockReturnValue(true)
    emblaApiMock.canScrollNext.mockReturnValue(true)

    renderWithProviders(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious data-testid="carousel-prev" />
        <CarouselNext data-testid="carousel-next" />
      </Carousel>
    )

    const prevButton = screen.getByTestId("carousel-prev")
    const nextButton = screen.getByTestId("carousel-next")

    expect(prevButton).not.toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    fireEvent.click(nextButton)
    expect(emblaApiMock.scrollNext).toHaveBeenCalledTimes(1)

    fireEvent.click(prevButton)
    expect(emblaApiMock.scrollPrev).toHaveBeenCalledTimes(1)
  })

  it("passes horizontal classes to content and items by default", () => {
    renderWithProviders(
      <Carousel>
        <CarouselContent data-testid="carousel-content" className="content-extra">
          <CarouselItem data-testid="carousel-item" className="item-extra">
            Slide
          </CarouselItem>
        </CarouselContent>
      </Carousel>
    )

    expect(mockCnClassName).toHaveBeenCalledWith("relative", undefined)
    expect(mockCnClassName).toHaveBeenCalledWith(
      "flex",
      "-ml-4",
      "content-extra"
    )
    expect(mockCnClassName).toHaveBeenCalledWith(
      "min-w-0 shrink-0 grow-0 basis-full",
      "pl-4",
      "item-extra"
    )
  })

  it("uses vertical orientation when specified and applies vertical classes", () => {
    renderWithProviders(
      <Carousel orientation="vertical">
        <CarouselContent data-testid="carousel-content" className="content-extra">
          <CarouselItem data-testid="carousel-item" className="item-extra">
            Slide
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious data-testid="carousel-prev" />
        <CarouselNext data-testid="carousel-next" />
      </Carousel>
    )

    expect(mockUseEmblaCarousel).toHaveBeenCalledWith(
      expect.objectContaining({ axis: "y" }),
      undefined
    )

    expect(mockCnClassName).toHaveBeenCalledWith(
      "flex",
      "-mt-4 flex-col",
      "content-extra"
    )
    expect(mockCnClassName).toHaveBeenCalledWith(
      "min-w-0 shrink-0 grow-0 basis-full",
      "pt-4",
      "item-extra"
    )

    const prevButton = screen.getByTestId("carousel-prev")
    const nextButton = screen.getByTestId("carousel-next")

    expect(prevButton.className).toContain("rotate-90")
    expect(nextButton.className).toContain("rotate-90")
  })

  it("calls setApi with embla api when provided", () => {
    const setApiMock = vi.fn()

    renderWithProviders(
      <Carousel setApi={setApiMock}>
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
        </CarouselContent>
      </Carousel>
    )

    expect(setApiMock).toHaveBeenCalledWith(emblaApiMock)
  })

  it("throws error when CarouselContent is used outside Carousel provider", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {})

    let caughtError: unknown
    try {
      renderWithProviders(
        <CarouselContent>
          <CarouselItem>Slide</CarouselItem>
        </CarouselContent>
      )
    } catch (err) {
      caughtError = err
    }

    expect(caughtError).toBeInstanceOf(Error)
    if (caughtError instanceof Error) {
      expect(caughtError.message).toBe(
        "useCarousel must be used within a <Carousel />"
      )
    }

    consoleErrorSpy.mockRestore()
  })

  it("updates canScrollPrev and canScrollNext based on api callbacks", () => {
    emblaApiMock.canScrollPrev.mockReturnValueOnce(true)
    emblaApiMock.canScrollNext.mockReturnValueOnce(false)

    renderWithProviders(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious data-testid="carousel-prev" />
        <CarouselNext data-testid="carousel-next" />
      </Carousel>
    )

    expect(emblaApiMock.on).toHaveBeenCalledWith(
      "reInit",
      expect.any(Function)
    )
    expect(emblaApiMock.on).toHaveBeenCalledWith(
      "select",
      expect.any(Function)
    )

    const prevButton = screen.getByTestId("carousel-prev")
    const nextButton = screen.getByTestId("carousel-next")

    expect(prevButton).not.toBeDisabled()
    expect(nextButton).toBeDisabled()
  })
})