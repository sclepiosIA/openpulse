import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockSkeleton } = vi.hoisted(() => {
  const mockSkeleton = vi.fn(({ className }: { className?: string }) => (
    <div data-testid="skeleton" data-classname={className ?? ""} />
  ));
  return { mockSkeleton };
});

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: { className?: string }) => mockSkeleton(props),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("sidebar-skeleton.tsx", () => {
  it("SidebarMenuSkeleton: rendu par défaut (group labels + items)", async () => {
    const Wrapper = createWrapper();
    const { SidebarMenuSkeleton } = await import("./sidebar-skeleton");

    render(
      <Wrapper>
        <SidebarMenuSkeleton />
      </Wrapper>
    );

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons).toHaveLength(27);

    const labelSkeletons = skeletons.filter((n) => n.getAttribute("data-classname") === "h-3 w-20");
    expect(labelSkeletons).toHaveLength(3);

    const iconSkeletons = skeletons.filter((n) => n.getAttribute("data-classname") === "h-5 w-5 rounded");
    expect(iconSkeletons).toHaveLength(12);

    const textSkeletons = skeletons.filter((n) => n.getAttribute("data-classname") === "h-4 flex-1 max-w-[120px]");
    expect(textSkeletons).toHaveLength(12);
  });

  it("SidebarMenuSkeleton: sans labels et props personnalisées", async () => {
    const Wrapper = createWrapper();
    const { SidebarMenuSkeleton } = await import("./sidebar-skeleton");

    render(
      <Wrapper>
        <SidebarMenuSkeleton groupCount={2} itemCount={3} showGroupLabels={false} />
      </Wrapper>
    );

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons).toHaveLength(12);

    const labelSkeletons = skeletons.filter((n) => n.getAttribute("data-classname") === "h-3 w-20");
    expect(labelSkeletons).toHaveLength(0);

    const iconSkeletons = skeletons.filter((n) => n.getAttribute("data-classname") === "h-5 w-5 rounded");
    expect(iconSkeletons).toHaveLength(6);

    const textSkeletons = skeletons.filter((n) => n.getAttribute("data-classname") === "h-4 flex-1 max-w-[120px]");
    expect(textSkeletons).toHaveLength(6);
  });

  it("SidebarMenuSkeletonCollapsed: rendu par défaut", async () => {
    const Wrapper = createWrapper();
    const { SidebarMenuSkeletonCollapsed } = await import("./sidebar-skeleton");

    render(
      <Wrapper>
        <SidebarMenuSkeletonCollapsed />
      </Wrapper>
    );

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons).toHaveLength(12);

    const iconSkeletons = skeletons.filter((n) => n.getAttribute("data-classname") === "h-5 w-5 rounded");
    expect(iconSkeletons).toHaveLength(12);
  });

  it("SidebarMenuSkeletonCollapsed: itemCount personnalisé", async () => {
    const Wrapper = createWrapper();
    const { SidebarMenuSkeletonCollapsed } = await import("./sidebar-skeleton");

    render(
      <Wrapper>
        <SidebarMenuSkeletonCollapsed itemCount={5} />
      </Wrapper>
    );

    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons).toHaveLength(5);

    const iconSkeletons = skeletons.filter((n) => n.getAttribute("data-classname") === "h-5 w-5 rounded");
    expect(iconSkeletons).toHaveLength(5);
  });
});