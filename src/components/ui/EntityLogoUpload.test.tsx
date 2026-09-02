/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { EntityLogoUpload } from "./EntityLogoUpload";

const {
  PUBLIC_URL,
  AUTH_STATE,
  mockDebugError,
  mockToastSuccess,
  mockToastError,
  mockCn,
  mockUpload,
  mockRemove,
  mockGetPublicUrl,
  mockEq,
  mockUpdate,
  mockFrom,
  stableBuilder,
  stableStorageBucket,
  stableStorage,
} = vi.hoisted(() => {
  const PUBLIC_URL_VALUE = "https://cdn.test/entity-logos/etablissement/e1/logo-1.png";
  const AUTH = {
    user: { id: "u1", email: "t@t.co" },
    session: { user: { id: "u1" } },
    isLoading: false,
  };

  const mockDebugErrorFn = vi.fn();
  const mockToastSuccessFn = vi.fn();
  const mockToastErrorFn = vi.fn();
  const mockCnFn = vi.fn((...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" ")
  );

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled)
  );
  builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected)
  );

  const uploadFn = vi.fn();
  const removeFn = vi.fn();
  const getPublicUrlFn = vi.fn();

  const storageBucket = {
    upload: uploadFn,
    remove: removeFn,
    getPublicUrl: getPublicUrlFn,
  };

  const storageObj = {
    from: vi.fn(() => storageBucket),
  };

  const fromFn = vi.fn(() => builder);

  return {
    PUBLIC_URL: PUBLIC_URL_VALUE,
    AUTH_STATE: AUTH,
    mockDebugError: mockDebugErrorFn,
    mockToastSuccess: mockToastSuccessFn,
    mockToastError: mockToastErrorFn,
    mockCn: mockCnFn,
    mockUpload: uploadFn,
    mockRemove: removeFn,
    mockGetPublicUrl: getPublicUrlFn,
    mockEq: builder.eq,
    mockUpdate: builder.update,
    mockFrom: fromFn,
    stableBuilder: builder,
    stableStorageBucket: storageBucket,
    stableStorage: storageObj,
  };
});

vi.mock("@/lib/debug", () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: mockCn,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom,
    storage: stableStorage,
  },
}));

vi.mock("./EntityAvatar", () => ({
  EntityAvatar: ({
    name,
    logoUrl,
    size,
    className,
  }: {
    name: string;
    logoUrl?: string | null;
    size: string;
    className?: string;
  }) => (
    <div
      data-testid="entity-avatar"
      data-name={name}
      data-logo-url={logoUrl ?? ""}
      data-size={size}
      className={className}
    />
  ),
}));

vi.mock("./button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  Camera: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="camera-icon" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="x-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => AUTH_STATE,
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

describe("EntityLogoUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue(stableBuilder);
    stableStorage.from.mockReturnValue(stableStorageBucket);
    mockRemove.mockResolvedValue({ data: [], error: null });
    mockUpload.mockResolvedValue({ data: { path: "ok" }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: PUBLIC_URL } });
    mockUpdate.mockReturnValue(stableBuilder);
    mockEq.mockResolvedValue({ data: [{ id: "e1", logo_url: PUBLIC_URL }], error: null });
  });

  it("renders with the expected business props and supports a QueryClient wrapper setup", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => ({ ready: true }), { wrapper });
    expect(result.current.ready).toBe(true);

    const onLogoChange = vi.fn();

    render(
      <EntityLogoUpload
        entityType="etablissement"
        entityId="e1"
        entityName="Etablissement Alpha"
        currentLogoUrl="https://cdn.test/entity-logos/old/logo.png"
        onLogoChange={onLogoChange}
        size="lg"
        className="extra-class"
      />,
      { wrapper }
    );

    const avatar = screen.getByTestId("entity-avatar");
    expect(avatar.getAttribute("data-name")).toBe("Etablissement Alpha");
    expect(avatar.getAttribute("data-logo-url")).toBe("https://cdn.test/entity-logos/old/logo.png");
    expect(avatar.getAttribute("data-size")).toBe("xl");

    expect(screen.getByLabelText("Changer le logo")).toBeInTheDocument();
    expect(screen.getByLabelText("Fermer")).toBeInTheDocument();
  });

  it("shows loading then uploads a valid image, updates the correct table, and emits the new public URL", async () => {
    const wrapper = createWrapper();
    const onLogoChange = vi.fn();

    let resolveUpload: ((value: { data: { path: string }; error: null }) => void) | undefined;
    mockUpload.mockImplementation(
      () =>
        new Promise<{ data: { path: string }; error: null }>((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(
      <EntityLogoUpload
        entityType="etablissement"
        entityId="e1"
        entityName="Entity One"
        currentLogoUrl="https://cdn.test/storage/v1/object/public/entity-logos/etablissement/e1/old.png"
        onLogoChange={onLogoChange}
        size="md"
      />,
      { wrapper }
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "logo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    });

    expect(mockRemove).toHaveBeenCalledWith(["etablissement/e1/old.png"]);

    resolveUpload?.({ data: { path: "ok" }, error: null });

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
    });

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^etablissement\/e1\/logo-\d+\.png$/),
      file,
      { upsert: true }
    );
    expect(mockGetPublicUrl).toHaveBeenCalledWith(expect.stringMatching(/^etablissement\/e1\/logo-\d+\.png$/));
    expect(mockFrom).toHaveBeenCalledWith("etablissements");
    expect(mockUpdate).toHaveBeenCalledWith({ logo_url: PUBLIC_URL });
    expect(mockEq).toHaveBeenCalledWith("id", "e1");

    await waitFor(() => {
      expect(onLogoChange).toHaveBeenCalledWith(PUBLIC_URL);
      expect(mockToastSuccess).toHaveBeenCalledWith("Logo mis à jour");
    });

    expect(input.value).toBe("");
  });

  it("removes the current logo, updates the correct groupe table, and emits null", async () => {
    const wrapper = createWrapper();
    const onLogoChange = vi.fn();

    render(
      <EntityLogoUpload
        entityType="groupe"
        entityId="g1"
        entityName="Groupe One"
        currentLogoUrl="https://cdn.test/storage/v1/object/public/entity-logos/groupe/g1/logo.png"
        onLogoChange={onLogoChange}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByLabelText("Fermer"));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith(["groupe/g1/logo.png"]);
    });

    expect(mockFrom).toHaveBeenCalledWith("groupes_etablissements");
    expect(mockUpdate).toHaveBeenCalledWith({ logo_url: null });
    expect(mockEq).toHaveBeenCalledWith("id", "g1");

    await waitFor(() => {
      expect(onLogoChange).toHaveBeenCalledWith(null);
      expect(mockToastSuccess).toHaveBeenCalledWith("Logo supprimé");
    });
  });

  it("rejects a non-image file with a specific error and does not upload", async () => {
    const wrapper = createWrapper();
    const onLogoChange = vi.fn();

    render(
      <EntityLogoUpload
        entityType="partenaire"
        entityId="p1"
        entityName="Partenaire"
        currentLogoUrl={null}
        onLogoChange={onLogoChange}
      />,
      { wrapper }
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["text"], "notes.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Veuillez sélectionner une image");
    });

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalledWith("partenaires");
    expect(onLogoChange).not.toHaveBeenCalled();
  });

  it("rejects an image larger than 2 Mo with a specific error and does not upload", async () => {
    const wrapper = createWrapper();
    const onLogoChange = vi.fn();

    render(
      <EntityLogoUpload
        entityType="partenaire"
        entityId="p1"
        entityName="Partenaire"
        currentLogoUrl={null}
        onLogoChange={onLogoChange}
      />,
      { wrapper }
    );

    const file = new File(["img"], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 + 1 });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("L'image ne doit pas dépasser 2 Mo");
    });

    expect(mockUpload).not.toHaveBeenCalled();
    expect(onLogoChange).not.toHaveBeenCalled();
  });

  it("handles upload database error by logging and showing the generic upload error", async () => {
    const wrapper = createWrapper();
    const onLogoChange = vi.fn();

    mockEq.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    render(
      <EntityLogoUpload
        entityType="partenaire"
        entityId="p1"
        entityName="Partenaire"
        currentLogoUrl={null}
        onLogoChange={onLogoChange}
      />,
      { wrapper }
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "logo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("partenaires");
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'upload du logo");
      expect(mockDebugError).toHaveBeenCalled();
    });

    expect(onLogoChange).not.toHaveBeenCalled();
  });

  it("handles remove error by logging and showing the generic delete error", async () => {
    const wrapper = createWrapper();
    const onLogoChange = vi.fn();

    mockEq.mockResolvedValueOnce({ data: null, error: { message: "x" } });

    render(
      <EntityLogoUpload
        entityType="partenaire"
        entityId="p2"
        entityName="Partenaire 2"
        currentLogoUrl="https://cdn.test/storage/v1/object/public/entity-logos/partenaire/p2/logo.png"
        onLogoChange={onLogoChange}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByLabelText("Fermer"));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith(["partenaire/p2/logo.png"]);
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Erreur lors de la suppression du logo");
      expect(mockDebugError).toHaveBeenCalled();
    });

    expect(onLogoChange).not.toHaveBeenCalledWith(null);
  });
});