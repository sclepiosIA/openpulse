import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  mockOnOpenChange,
  mockMutate,
  setHookState,
  DOCUMENT,
  mockFrom,
  supabaseBuilder,
} = vi.hoisted(() => {
  const mockOnOpenChange = vi.fn<(open: boolean) => void>();
  const mockMutate = vi.fn<
    (
      variables: { id: string; newName: string },
      options?: { onSuccess?: () => void; onError?: (err: unknown) => void }
    ) => void
  >();

  const hookState: { isPending: boolean } = { isPending: false };
  const setHookState = (next: Partial<typeof hookState>) => Object.assign(hookState, next);

  const DOCUMENT = {
    id: "doc-1",
    name: "Ancien nom",
  };

  const createBuilder = () => {
    const builder: Record<string, unknown> = {};

    const chain = () => builder;

    const methods = [
      "select",
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "in",
      "order",
      "limit",
      "range",
      "insert",
      "update",
      "upsert",
      "delete",
      "rpc",
      "filter",
      "match",
      "contains",
      "ilike",
      "like",
      "is",
      "not",
    ] as const;

    for (const m of methods) builder[m] = chain;

    builder.single = () => Promise.resolve({ data: null, error: null });
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null });

    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
    builder.catch = (onRejected: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected);

    return builder;
  };

  const supabaseBuilder = createBuilder();
  const mockFrom = vi.fn(() => supabaseBuilder);

  return { mockOnOpenChange, mockMutate, setHookState, DOCUMENT, mockFrom, supabaseBuilder };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock("@/hooks/documents/useDocuments", () => ({
  useRenameDocument: () => ({
    mutate: (vars: { id: string; newName: string }, opts?: { onSuccess?: () => void }) => {
      mockMutate(vars, opts);
    },
    isPending: (() => {
      // state stable via hoisted object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (setHookState as any) ? undefined : false;
    })(),
  }),
}));

vi.mock("@/components/ui/dialog", () => {
  const Dialog = ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null);

  const passthrough =
    (testId: string) =>
    ({ children }: { children: React.ReactNode }) =>
      <div data-testid={testId}>{children}</div>;

  return {
    Dialog,
    DialogContent: passthrough("dialog-content"),
    DialogDescription: passthrough("dialog-description"),
    DialogFooter: passthrough("dialog-footer"),
    DialogHeader: passthrough("dialog-header"),
    DialogTitle: passthrough("dialog-title"),
  };
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
}));

import { RenameDocumentDialog } from "./RenameDocumentDialog";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("RenameDocumentDialog", () => {
  it("affiche le nom initial et permet d'annuler", async () => {
    renderWithClient(
      <RenameDocumentDialog
        document={DOCUMENT as unknown as import("@/types/documents").DocumentWithRelations}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    expect(screen.getByTestId("dialog-root")).toBeTruthy();
    expect(screen.getByText("Renommer le document")).toBeTruthy();

    const input = screen.getByLabelText("Nouveau nom") as HTMLInputElement;
    expect(input.value).toBe("Ancien nom");

    const cancel = screen.getByRole("button", { name: "Annuler" });
    fireEvent.click(cancel);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("soumet la mutation avec les valeurs métier et ferme à succès", async () => {
    mockMutate.mockImplementationOnce((vars, opts) => {
      opts?.onSuccess?.();
    });

    renderWithClient(
      <RenameDocumentDialog
        document={DOCUMENT as unknown as import("@/types/documents").DocumentWithRelations}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    const input = screen.getByLabelText("Nouveau nom") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Nouveau titre  " } });

    const submit = screen.getByRole("button", { name: "Renommer" });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    const call = mockMutate.mock.calls[0];
    expect(call[0]).toEqual({ id: "doc-1", newName: "Nouveau titre" });

    await waitFor(() => {
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("ne soumet pas si le nom est vide (après trim)", async () => {
    mockMutate.mockClear();
    mockOnOpenChange.mockClear();

    renderWithClient(
      <RenameDocumentDialog
        document={DOCUMENT as unknown as import("@/types/documents").DocumentWithRelations}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    const input = screen.getByLabelText("Nouveau nom") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });

    const submit = screen.getByRole("button", { name: "Renommer" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(submit);
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });

  it("n'écrit pas si document est null", async () => {
    mockMutate.mockClear();

    renderWithClient(<RenameDocumentDialog document={null} open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByLabelText("Nouveau nom") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Nom" } });

    const submit = screen.getByRole("button", { name: "Renommer" });
    fireEvent.click(submit);

    expect(mockMutate).not.toHaveBeenCalled();
  });
});