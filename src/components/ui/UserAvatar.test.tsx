/* @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { UserAvatar } from "./UserAvatar";

const { avatarPropsSpy, avatarImagePropsSpy, avatarFallbackPropsSpy } = vi.hoisted(() => ({
  avatarPropsSpy: vi.fn(),
  avatarImagePropsSpy: vi.fn(),
  avatarFallbackPropsSpy: vi.fn(),
}));

vi.mock("@/components/ui/avatar", () => {
  const ReactModule = require("react") as typeof import("react");
  return {
    Avatar: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      avatarPropsSpy({ className });
      return ReactModule.createElement("div", { "data-testid": "avatar", className }, children);
    },
    AvatarImage: ({
      src,
      alt,
      className,
    }: {
      src?: string;
      alt?: string;
      className?: string;
    }) => {
      avatarImagePropsSpy({ src, alt, className });
      return ReactModule.createElement("img", {
        "data-testid": "avatar-image",
        src,
        alt,
        className,
      });
    },
    AvatarFallback: ({
      className,
      children,
    }: {
      className?: string;
      children?: React.ReactNode;
    }) => {
      avatarFallbackPropsSpy({ className, children });
      return ReactModule.createElement(
        "div",
        { "data-testid": "avatar-fallback", className },
        children
      );
    },
  };
});

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(" "),
}));

describe("UserAvatar", () => {
  beforeEach(() => {
    avatarPropsSpy.mockClear();
    avatarImagePropsSpy.mockClear();
    avatarFallbackPropsSpy.mockClear();
  });

  it("renders avatar image when avatarUrl is provided and shows initials fallback for full name", () => {
    render(
      <UserAvatar
        avatarUrl="https://example.com/avatar.png"
        email="john@example.com"
        name="John Doe"
        size="lg"
        className="rounded-full shadow"
      />
    );

    const avatar = screen.getByTestId("avatar");
    const image = screen.getByTestId("avatar-image");
    const fallback = screen.getByTestId("avatar-fallback");

    expect(avatar).toHaveClass("h-12", "w-12", "text-base", "rounded-full", "shadow");
    expect(image).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(image).toHaveAttribute("alt", "John Doe");
    expect(image).toHaveClass("object-cover");
    expect(fallback).toHaveTextContent("JD");
    expect(fallback.className).toMatch(/bg-[a-z]+-500/);
    expect(fallback).toHaveClass("text-white", "font-medium");

    expect(avatarPropsSpy).toHaveBeenCalledWith({
      className: "h-12 w-12 text-base rounded-full shadow",
    });
    expect(avatarImagePropsSpy).toHaveBeenCalledWith({
      src: "https://example.com/avatar.png",
      alt: "John Doe",
      className: "object-cover",
    });
  });

  it("does not render image when avatarUrl is null and uses first two letters for single-word name", () => {
    render(<UserAvatar avatarUrl={null} name="alice" size="sm" />);

    const avatar = screen.getByTestId("avatar");
    const fallback = screen.getByTestId("avatar-fallback");

    expect(avatar).toHaveClass("h-8", "w-8", "text-xs");
    expect(screen.queryByTestId("avatar-image")).toBeNull();
    expect(fallback).toHaveTextContent("AL");
    expect(fallback.className).toMatch(/bg-[a-z]+-500/);

    expect(avatarImagePropsSpy).not.toHaveBeenCalled();
  });

  it("uses question mark initials when name is empty", () => {
    render(<UserAvatar name="" />);

    const avatar = screen.getByTestId("avatar");
    const fallback = screen.getByTestId("avatar-fallback");

    expect(avatar).toHaveClass("h-10", "w-10", "text-sm");
    expect(fallback).toHaveTextContent("?");
    expect(screen.queryByTestId("avatar-image")).toBeNull();
  });

  it("uses deterministic fallback color from email when name is empty", () => {
    const { rerender } = render(<UserAvatar name="" email="same@example.com" />);

    const firstClassName = screen.getByTestId("avatar-fallback").className;

    rerender(<UserAvatar name="" email="same@example.com" />);

    const secondClassName = screen.getByTestId("avatar-fallback").className;

    expect(firstClassName).toBe(secondClassName);
    expect(firstClassName).toContain("text-white font-medium");
  });

  it("supports xl size and computes initials from trimmed multi-part names", () => {
    render(<UserAvatar name="  Marie   Curie  Sklodowska " size="xl" className="ring-2" />);

    const avatar = screen.getByTestId("avatar");
    const fallback = screen.getByTestId("avatar-fallback");

    expect(avatar).toHaveClass("h-16", "w-16", "text-lg", "ring-2");
    expect(fallback).toHaveTextContent("MS");
  });
});