import React, { type PropsWithChildren } from "react";
import { render, screen, within, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { PROFILES, STATS_OK, STATS_LOADING, STATS_ERROR, onViewDetails } = vi.hoisted(() => {
  const PROFILES = [
    {
      id: "p1",
      prenom: "Ada",
      nom: "Lovelace",
      email: "ada@example.test",
      role: "manager",
      actif: true,
      fonction: "Lead",
    },
    {
      id: "p2",
      prenom: "Alan",
      nom: "Turing",
      email: "alan@example.test",
      role: "commercial",
      actif: true,
      fonction: null,
    },
  ] as const;

  const STATS_OK = {
    p1: {
      totalProjects: 3,
      totalTasks: 10,
      tasksOverdue: 2,
      tasksCompleted: 7,
      completionRate: 70,
      workload: "medium",
    },
    p2: {
      totalProjects: 1,
      totalTasks: 4,
      tasksOverdue: 0,
      tasksCompleted: 1,
      completionRate: 25,
      workload: "high",
    },
  } as const;

  const STATS_LOADING = {
    p1: {
      totalProjects: 0,
      totalTasks: 0,
      tasksOverdue: 0,
      tasksCompleted: 0,
      completionRate: 0,
      workload: "low",
      isLoading: true,
    },
  } as const;

  const STATS_ERROR = {
    p1: {
      totalProjects: 0,
      totalTasks: 0,
      tasksOverdue: 0,
      tasksCompleted: 0,
      completionRate: 0,
      workload: "low",
      isError: true,
      error: { message: "x" },
    },
  } as const;

  const onViewDetails = vi.fn();

  return { PROFILES, STATS_OK, STATS_LOADING, STATS_ERROR, onViewDetails };
});

vi.mock("@/components/ui/table", () => {
  const Table = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <table {...props}>{children}</table>
  );
  const TableHeader = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <thead {...props}>{children}</thead>
  );
  const TableBody = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <tbody {...props}>{children}</tbody>
  );
  const TableRow = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <tr {...props}>{children}</tr>
  );
  const TableHead = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <th {...props}>{children}</th>
  );
  const TableCell = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <td {...props}>{children}</td>
  );
  return { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
});

vi.mock("@/components/ui/badge", () => {
  const Badge = ({
    children,
    ...props
  }: PropsWithChildren<{ variant?: string; className?: string }>) => (
    <span data-badge-variant={props.variant ?? ""} className={props.className}>
      {children}
    </span>
  );
  return { Badge };
});

vi.mock("@/components/ui/button", () => {
  const Button = ({
    children,
    onClick,
    ...props
  }: PropsWithChildren<{
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }>) => (
    <button type="button" onClick={onClick} data-variant={props.variant ?? ""} data-size={props.size ?? ""}>
      {children}
    </button>
  );
  return { Button };
});

vi.mock("@/components/ui/progress", () => {
  const Progress = ({ value, className }: { value: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value} className={className} />
  );
  return { Progress };
});

vi.mock("lucide-react", () => {
  const Eye = (props: Record<string, unknown>) => <svg aria-label="eye" {...props} />;
  return { Eye };
});

const { getCompletionRateColor } = vi.hoisted(() => {
  const getCompletionRateColor = vi.fn((rate: number) => {
    if (rate >= 80) return "text-green";
    if (rate >= 50) return "text-yellow";
    return "text-red";
  });
  return { getCompletionRateColor };
});
vi.mock("@/lib/teamUtils", () => ({ getCompletionRateColor }));

const { WorkloadIndicator } = vi.hoisted(() => {
  const WorkloadIndicator = vi.fn(({ workload, taskCount }: { workload: string; taskCount: number }) => (
    <div data-testid="workload-indicator" data-workload={workload} data-taskcount={String(taskCount)} />
  ));
  return { WorkloadIndicator };
});
vi.mock("./WorkloadIndicator", () => ({ WorkloadIndicator }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { Wrapper, queryClient };
}

import { TeamTableView } from "./TeamTableView";
import { renderHook } from "@testing-library/react";

describe("TeamTableView", () => {
  it("affiche un état de chargement (via stats) puis succès avec valeurs métier et indicateurs", () => {
    const { Wrapper } = createWrapper();
    renderHook(() => ({ ok: true }), { wrapper: Wrapper });

    const { rerender } = render(
      <TeamTableView profiles={[...PROFILES]} stats={STATS_LOADING as unknown as Record<string, unknown>} onViewDetails={onViewDetails} />
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.test")).toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar").some((p) => p.getAttribute("aria-valuenow") === "0")).toBe(true);

    rerender(<TeamTableView profiles={[...PROFILES]} stats={STATS_OK as unknown as Record<string, unknown>} onViewDetails={onViewDetails} />);

    const adaRow = screen.getByText("Ada Lovelace").closest("tr");
    expect(adaRow).not.toBeNull();
    if (adaRow) {
      expect(within(adaRow).getByText("ada@example.test")).toBeInTheDocument();
      expect(within(adaRow).getByText("Lead")).toBeInTheDocument();
      expect(within(adaRow).getByText("Manager")).toBeInTheDocument();
      expect(within(adaRow).getByText("3")).toBeInTheDocument();
      expect(within(adaRow).getByText("10")).toBeInTheDocument();
      expect(within(adaRow).getByText("2")).toBeInTheDocument();
      expect(within(adaRow).getByText("70%")).toBeInTheDocument();
      expect(within(adaRow).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("70");
      const adaWorkload = within(adaRow).getByTestId("workload-indicator");
      expect(adaWorkload.getAttribute("data-workload")).toBe("medium");
      expect(adaWorkload.getAttribute("data-taskcount")).toBe("3");
    }

    const alanRow = screen.getByText("Alan Turing").closest("tr");
    expect(alanRow).not.toBeNull();
    if (alanRow) {
      expect(within(alanRow).getByText("alan@example.test")).toBeInTheDocument();
      expect(within(alanRow).getByText("-")).toBeInTheDocument();
      expect(within(alanRow).getByText("Commercial")).toBeInTheDocument();
      expect(within(alanRow).getByText("1")).toBeInTheDocument();
      expect(within(alanRow).getByText("4")).toBeInTheDocument();
      expect(within(alanRow).queryByText("0")).toBeNull();
      expect(within(alanRow).getByText("25%")).toBeInTheDocument();
      expect(within(alanRow).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("25");
      const alanWorkload = within(alanRow).getByTestId("workload-indicator");
      expect(alanWorkload.getAttribute("data-workload")).toBe("high");
      expect(alanWorkload.getAttribute("data-taskcount")).toBe("3");
    }

    expect(getCompletionRateColor).toHaveBeenCalledWith(70);
    expect(getCompletionRateColor).toHaveBeenCalledWith(25);
    expect(WorkloadIndicator).toHaveBeenCalledWith(expect.objectContaining({ workload: "medium", taskCount: 3 }), {});
    expect(WorkloadIndicator).toHaveBeenCalledWith(expect.objectContaining({ workload: "high", taskCount: 3 }), {});
  });

  it("déclenche onViewDetails au clic sur l'action", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => ({ ok: true }), { wrapper: Wrapper });

    onViewDetails.mockClear();

    render(<TeamTableView profiles={[...PROFILES]} stats={STATS_OK as unknown as Record<string, unknown>} onViewDetails={onViewDetails} />);

    const adaRow = screen.getByText("Ada Lovelace").closest("tr");
    expect(adaRow).not.toBeNull();
    if (!adaRow) return;

    const button = within(adaRow).getByRole("button");
    await act(async () => {
      button.click();
    });

    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(onViewDetails).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", prenom: "Ada", nom: "Lovelace" }));
  });

  it("cas erreur (via stats) : affiche une valeur cohérente et applique la couleur d'erreur", () => {
    const { Wrapper } = createWrapper();
    renderHook(() => ({ ok: true }), { wrapper: Wrapper });

    getCompletionRateColor.mockClear();

    render(<TeamTableView profiles={[PROFILES[0]]} stats={STATS_ERROR as unknown as Record<string, unknown>} onViewDetails={onViewDetails} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(getCompletionRateColor).toHaveBeenCalledWith(0);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });
});