// @vitest-environment jsdom
import * as React from "react"
import { render, screen } from "@testing-library/react"
import { Avatar, AvatarImage, AvatarFallback } from "./avatar"

describe("avatar.tsx", () => {
  it("renders Avatar root with default classes and custom class", () => {
    render(
      <Avatar data-testid="avatar-root" className="custom-root">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )

    const root = screen.getByTestId("avatar-root")
    expect(root.tagName.toLowerCase()).toBe("span")
    expect(root.className).toContain("relative")
    expect(root.className).toContain("flex")
    expect(root.className).toContain("h-10")
    expect(root.className).toContain("w-10")
    expect(root.className).toContain("shrink-0")
    expect(root.className).toContain("overflow-hidden")
    expect(root.className).toContain("rounded-full")
    expect(root.className).toContain("custom-root")
  })

  it("renders fallback content by default when image is not available", () => {
    render(
      <Avatar>
        <AvatarFallback data-testid="avatar-fallback" className="custom-fallback">
          JD
        </AvatarFallback>
      </Avatar>
    )

    const fallback = screen.getByTestId("avatar-fallback")
    expect(fallback.tagName.toLowerCase()).toBe("span")
    expect(fallback.textContent).toBe("JD")
    expect(fallback.className).toContain("flex")
    expect(fallback.className).toContain("h-full")
    expect(fallback.className).toContain("w-full")
    expect(fallback.className).toContain("items-center")
    expect(fallback.className).toContain("justify-center")
    expect(fallback.className).toContain("rounded-full")
    expect(fallback.className).toContain("bg-muted")
    expect(fallback.className).toContain("custom-fallback")
  })

  it("does not render AvatarImage element immediately without load/error state handling", () => {
    render(
      <Avatar>
        <AvatarImage
          data-testid="avatar-image"
          src="/user.png"
          alt="User avatar"
          className="custom-image"
        />
        <AvatarFallback>UA</AvatarFallback>
      </Avatar>
    )

    expect(screen.queryByTestId("avatar-image")).toBeNull()
    expect(screen.getByText("UA")).toBeTruthy()
  })

  it("forwards ref to Avatar root element", () => {
    const ref = React.createRef<HTMLSpanElement>()

    render(
      <Avatar ref={ref} data-testid="avatar-root-ref">
        <AvatarFallback>RF</AvatarFallback>
      </Avatar>
    )

    const root = screen.getByTestId("avatar-root-ref")
    expect(ref.current).toBe(root)
    expect(ref.current?.tagName.toLowerCase()).toBe("span")
    expect(ref.current?.getAttribute("data-testid")).toBe("avatar-root-ref")
  })

  it("forwards ref to AvatarFallback element", () => {
    const ref = React.createRef<HTMLSpanElement>()

    render(
      <Avatar>
        <AvatarFallback ref={ref} data-testid="avatar-fallback-ref">
          ZZ
        </AvatarFallback>
      </Avatar>
    )

    const fallback = screen.getByTestId("avatar-fallback-ref")
    expect(ref.current).toBe(fallback)
    expect(ref.current?.tagName.toLowerCase()).toBe("span")
    expect(fallback.textContent).toBe("ZZ")
  })

  it("sets lazy loading and merged className on AvatarImage props definition", () => {
    const ref = React.createRef<HTMLImageElement>()
    const element = AvatarImage.render(
      {
        "data-testid": "avatar-image-props",
        src: "/pic.jpg",
        alt: "Pic",
        className: "custom-image",
      },
      ref
    ) as React.ReactElement

    expect(element.props.loading).toBe("lazy")
    expect(element.props.src).toBe("/pic.jpg")
    expect(element.props.alt).toBe("Pic")
    expect(element.props.className).toContain("aspect-square")
    expect(element.props.className).toContain("h-full")
    expect(element.props.className).toContain("w-full")
    expect(element.props.className).toContain("custom-image")
    expect(typeof element.type).toBe("object")
  })

  it("sets displayName from radix primitives", () => {
    expect(Avatar.displayName).toBeTruthy()
    expect(AvatarImage.displayName).toBeTruthy()
    expect(AvatarFallback.displayName).toBeTruthy()
    expect(typeof Avatar.displayName).toBe("string")
    expect(typeof AvatarImage.displayName).toBe("string")
    expect(typeof AvatarFallback.displayName).toBe("string")
  })
})