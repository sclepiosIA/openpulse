import { render, screen, fireEvent, act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { MOCK_PROFILES, EtablissementFormImpl, ImportImpl } = vi.hoisted(() => {
  const MOCK_PROFILES = [{ id: "p1", role: "admin", name: "Profile 1" }];

  const EtablissementFormImpl = ({
    form,
    onSubmit,
    onCancel,
    submitLabel,
    isLoading,
    allProfiles,
  }: {
    form: unknown;
    onSubmit?: (data: unknown) => Promise<unknown>;
    onCancel?: () => void;
    submitLabel?: unknown;
    isLoading?: boolean;
    allProfiles?: unknown[];
  }) => {
    return (
      <div data-testid="etab-form">
        <div>{`submitLabel:${String(submitLabel)}`}</div>
        <div>{`isLoading:${isLoading ? "true" : "false"}`}</div>
        <div data-testid="profiles-count">{Array.isArray(allProfiles) ? allProfiles.length : 0}</div>
        <button
          type="button"
          onClick={() => {
            const promise = onSubmit ? onSubmit({ name: "ETAB" }) : undefined;
            (globalThis as any).__LAST_SUBMIT_PROMISE__ = promise;
          }}
        >
          submit
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof onCancel === "function") {
              onCancel();
            }
          }}
        >
          cancel
        </button>
      </div>
    );
  };

  const ImportImpl = () => {
    return <div data-testid="import-etabs">ImportEtablissements Mock</div>;
  };

  return { MOCK_PROFILES, EtablissementFormImpl, ImportImpl };
});

// Mock ui/dialog components used by the module - honor the `open` prop to avoid rendering closed dialogs
vi.mock("@/components/ui/dialog", () => {
  return {
    Dialog: ({ children, open }: { children: unknown; open?: boolean }) =>
      open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children, className }: { children: unknown; className?: string }) => (
      <div data-testid="dialog-content" className={className}>
        {children}
      </div>
    ),
    DialogHeader: ({ children }: { children: unknown }) => <div data-testid="dialog-header">{children}</div>,
    DialogTitle: ({ children }: { children: unknown }) => <h1 data-testid="dialog-title">{children}</h1>,
    DialogDescription: ({ children }: { children: unknown }) => <p data-testid="dialog-desc">{children}</p>,
  };
});

// Mock the EtablissementForm component with the hoisted stable implementation
vi.mock("@/components/etablissement/EtablissementForm", () => {
  return {
    EtablissementForm: EtablissementFormImpl,
  };
});

// Mock ImportEtablissements with the hoisted stable implementation
vi.mock("@/components/etablissement/ImportEtablissements", () => {
  return {
    ImportEtablissements: ImportImpl,
  };
});

// Safety mocks for type-only or internal hooks referenced in types
vi.mock("@/hooks/crm/useEtablissements", () => ({}));
vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({}));

import { EtablissementDialogs } from "./EtablissementDialogs";

describe("EtablissementDialogs", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  const wrapper = ({ children }: { children: unknown }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    (globalThis as any).__LAST_SUBMIT_PROMISE__ = undefined;
    vi.resetAllMocks();
  });

  it("renders create dialog with correct title, description and form props (not loading)", () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onCreateOpenChange = vi.fn();
    const fakeForm = {} as unknown as import("react-hook-form").UseFormReturn<Record<string, unknown>>;

    render(
      <EtablissementDialogs
        createOpen={true}
        onCreateOpenChange={onCreateOpenChange}
        createForm={fakeForm}
        onCreate={onCreate}
        createPending={false}
        editOpen={false}
        onEditOpenChange={() => {}}
        editForm={fakeForm}
        onEdit={() => Promise.resolve()}
        editPending={false}
        importOpen={false}
        onImportOpenChange={() => {}}
        allProfiles={MOCK_PROFILES}
      />,
      { wrapper }
    );

    // Title and description present for the open create dialog
    expect(screen.getByTestId("dialog-title").textContent).toBe("Nouvel établissement");
    expect(screen.getByTestId("dialog-desc").textContent).toContain("Créer une fiche");

    // EtablissementForm received submitLabel "Créer" and isLoading false
    expect(screen.getByText("submitLabel:Créer")).toBeTruthy();
    expect(screen.getByText("isLoading:false")).toBeTruthy();

    // All profiles passed through: mocked form shows profiles count
    expect(screen.getByTestId("profiles-count").textContent).toBe(String(MOCK_PROFILES.length));
  });

  it("shows loading state when createPending is true", () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const fakeForm = {} as unknown as import("react-hook-form").UseFormReturn<Record<string, unknown>>;

    render(
      <EtablissementDialogs
        createOpen={true}
        onCreateOpenChange={() => {}}
        createForm={fakeForm}
        onCreate={onCreate}
        createPending={true}
        editOpen={false}
        onEditOpenChange={() => {}}
        editForm={fakeForm}
        onEdit={() => Promise.resolve()}
        editPending={false}
        importOpen={false}
        onImportOpenChange={() => {}}
        allProfiles={[]}
      />,
      { wrapper }
    );

    expect(screen.getByText("isLoading:true")).toBeTruthy();
  });

  it("invokes onCreate with form data when submit is clicked and resolves (mutation success)", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onCreateOpenChange = vi.fn();
    const fakeForm = {} as unknown as import("react-hook-form").UseFormReturn<Record<string, unknown>>;

    render(
      <EtablissementDialogs
        createOpen={true}
        onCreateOpenChange={onCreateOpenChange}
        createForm={fakeForm}
        onCreate={onCreate}
        createPending={false}
        editOpen={false}
        onEditOpenChange={() => {}}
        editForm={fakeForm}
        onEdit={() => Promise.resolve()}
        editPending={false}
        importOpen={false}
        onImportOpenChange={() => {}}
        allProfiles={MOCK_PROFILES}
      />,
      { wrapper }
    );

    const submitButton = screen.getByText("submit");
    await act(async () => {
      fireEvent.click(submitButton);
      const p = (globalThis as any).__LAST_SUBMIT_PROMISE__;
      await expect(p).resolves.toBeUndefined();
    });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({ name: "ETAB" });
  });

  it("propagates rejection from onCreate when submit fails (mutation error)", async () => {
    const error = new Error("create-fail");
    const onCreate = vi.fn().mockRejectedValue(error);
    const fakeForm = {} as unknown as import("react-hook-form").UseFormReturn<Record<string, unknown>>;

    render(
      <EtablissementDialogs
        createOpen={true}
        onCreateOpenChange={() => {}}
        createForm={fakeForm}
        onCreate={onCreate}
        createPending={false}
        editOpen={false}
        onEditOpenChange={() => {}}
        editForm={fakeForm}
        onEdit={() => Promise.resolve()}
        editPending={false}
        importOpen={false}
        onImportOpenChange={() => {}}
        allProfiles={[]}
      />,
      { wrapper }
    );

    const submitButton = screen.getByText("submit");
    await act(async () => {
      fireEvent.click(submitButton);
      const p = (globalThis as any).__LAST_SUBMIT_PROMISE__;
      await expect(p).rejects.toThrow("create-fail");
    });

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("renders edit dialog with correct title and calls onEdit with submitted data", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const fakeForm = {} as unknown as import("react-hook-form").UseFormReturn<Record<string, unknown>>;

    render(
      <EtablissementDialogs
        createOpen={false}
        onCreateOpenChange={() => {}}
        createForm={fakeForm}
        onCreate={() => Promise.resolve()}
        createPending={false}
        editOpen={true}
        onEditOpenChange={() => {}}
        editForm={fakeForm}
        onEdit={onEdit}
        editPending={false}
        importOpen={false}
        onImportOpenChange={() => {}}
        allProfiles={MOCK_PROFILES}
      />,
      { wrapper }
    );

    expect(screen.getByTestId("dialog-title").textContent).toBe("Modifier l'établissement");

    const submitButton = screen.getByText("submit");
    await act(async () => {
      fireEvent.click(submitButton);
      const p = (globalThis as any).__LAST_SUBMIT_PROMISE__;
      await expect(p).resolves.toBeUndefined();
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith({ name: "ETAB" });
  });

  it("shows import dialog when importOpen is true and renders ImportEtablissements", () => {
    const fakeForm = {} as unknown as import("react-hook-form").UseFormReturn<Record<string, unknown>>;

    render(
      <EtablissementDialogs
        createOpen={false}
        onCreateOpenChange={() => {}}
        createForm={fakeForm}
        onCreate={() => Promise.resolve()}
        createPending={false}
        editOpen={false}
        onEditOpenChange={() => {}}
        editForm={fakeForm}
        onEdit={() => Promise.resolve()}
        editPending={false}
        importOpen={true}
        onImportOpenChange={() => {}}
        allProfiles={[]}
      />,
      { wrapper }
    );

    expect(screen.getByTestId("import-etabs").textContent).toBe("ImportEtablissements Mock");
    expect(screen.getByTestId("dialog-title").textContent).toBe("Import d'établissements");
  });

  it("uses QueryClientProvider wrapper correctly (sanity check via renderHook)", () => {
    const { result } = renderHook(() => 42, { wrapper });
    expect(result.current).toBe(42);
  });
});