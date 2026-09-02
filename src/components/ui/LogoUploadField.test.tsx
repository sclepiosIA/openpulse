/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LogoUploadField } from "./LogoUploadField";

const {
  mockToast,
  mockUseToast,
  mockSanitizeSupabaseError,
  mockCn,
  uploadMock,
  getPublicUrlMock,
  storageFromMock,
  FIXED_PUBLIC_URL,
  FIXED_UPLOAD_PATH,
} = vi.hoisted(() => {
  const FIXED_PUBLIC_URL = "https://cdn.test/logo.png";
  const FIXED_UPLOAD_PATH = "etablissement/temp-fixed/logo-fixed.png";

  return {
    mockToast: vi.fn(),
    mockUseToast: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(),
    mockCn: vi.fn(),
    uploadMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
    storageFromMock: vi.fn(),
    FIXED_PUBLIC_URL,
    FIXED_UPLOAD_PATH,
  };
});

vi.mock("@/hooks/shared/use-toast", () => ({
  useToast: mockUseToast,
}));

vi.mock("@/lib/supabaseErrorSanitizer", () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock("@/lib/utils", () => ({
  cn: mockCn,
}));

vi.mock("lucide-react", () => ({
  Camera: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="camera-icon" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="x-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: storageFromMock,
    },
  },
}));

describe("LogoUploadField", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseToast.mockReturnValue({ toast: mockToast });
    mockSanitizeSupabaseError.mockReturnValue("Erreur upload");
    mockCn.mockImplementation((...classes: Array<string | undefined | null | false>) =>
      classes.filter(Boolean).join(" ")
    );

    uploadMock.mockResolvedValue({
      data: { path: FIXED_UPLOAD_PATH },
      error: null,
    });

    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: FIXED_PUBLIC_URL },
    });

    storageFromMock.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    });
  });

  it("affiche l'état initial sans logo et les textes d'aide", () => {
    const onLogoUploaded = vi.fn();

    render(
      <LogoUploadField
        entityType="etablissement"
        onLogoUploaded={onLogoUploaded}
      />
    );

    expect(screen.getByText("Cliquez pour ajouter un logo")).toBeInTheDocument();
    expect(screen.getByText("PNG, JPG (max. 2 Mo)")).toBeInTheDocument();
    expect(screen.getByText("Logo")).toBeInTheDocument();
    expect(screen.queryByAltText("Logo preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("affiche le logo courant et permet sa suppression", () => {
    const onLogoUploaded = vi.fn();

    render(
      <LogoUploadField
        currentLogoUrl="https://cdn.test/current.png"
        entityType="partenaire"
        onLogoUploaded={onLogoUploaded}
      />
    );

    const image = screen.getByAltText("Logo preview");
    expect(image).toHaveAttribute("src", "https://cdn.test/current.png");

    const removeButton = screen.getByRole("button");
    fireEvent.click(removeButton);

    expect(onLogoUploaded).toHaveBeenCalledWith(null);
    expect(screen.queryByAltText("Logo preview")).not.toBeInTheDocument();
  });

  it("refuse un fichier non image et affiche un toast d'erreur métier", async () => {
    const onLogoUploaded = vi.fn();

    render(
      <LogoUploadField
        entityType="groupe"
        onLogoUploaded={onLogoUploaded}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["hello"], "doc.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Veuillez sélectionner une image",
      variant: "destructive",
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onLogoUploaded).not.toHaveBeenCalled();
  });

  it("refuse une image de plus de 2 Mo et affiche un toast d'erreur", async () => {
    const onLogoUploaded = vi.fn();

    render(
      <LogoUploadField
        entityType="etablissement"
        onLogoUploaded={onLogoUploaded}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 + 1 });

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur",
      description: "L'image ne doit pas dépasser 2 Mo",
      variant: "destructive",
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onLogoUploaded).not.toHaveBeenCalled();
  });

  it("upload un logo avec succès, affiche le loader pendant le chargement puis la preview et notifie le parent", async () => {
    const onLogoUploaded = vi.fn();

    let resolveUpload:
      | ((value: { data: { path: string }; error: null }) => void)
      | undefined;

    uploadMock.mockImplementation(
      () =>
        new Promise<{ data: { path: string }; error: null }>((resolve) => {
          resolveUpload = resolve;
        })
    );

    render(
      <LogoUploadField
        entityType="etablissement"
        onLogoUploaded={onLogoUploaded}
        size="lg"
        className="custom-class"
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "logo.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(uploadMock).toHaveBeenCalledTimes(1);

    const [uploadedPathArg, uploadedFileArg, uploadedOptionsArg] = uploadMock.mock.calls[0];
    expect(uploadedPathArg).toMatch(/^etablissement\/temp-\d+\/logo-\d+\.png$/);
    expect(uploadedFileArg).toBe(file);
    expect(uploadedOptionsArg).toEqual({ upsert: true });

    resolveUpload?.({ data: { path: FIXED_UPLOAD_PATH }, error: null });

    await waitFor(() => {
      expect(screen.getByAltText("Logo preview")).toHaveAttribute("src", FIXED_PUBLIC_URL);
    });

    expect(storageFromMock).toHaveBeenCalledWith("entity-logos");
    expect(getPublicUrlMock).toHaveBeenCalledWith(FIXED_UPLOAD_PATH);
    expect(onLogoUploaded).toHaveBeenCalledWith(FIXED_PUBLIC_URL);
    expect(mockToast).toHaveBeenCalledWith({
      title: "Logo uploadé",
      description: "Le logo sera enregistré avec l'entité",
    });
    expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
    expect(input.value).toBe("");
  });

  it("gère une erreur d'upload Supabase, sanitize le message et n'appelle pas le callback de succès", async () => {
    const onLogoUploaded = vi.fn();

    uploadMock.mockResolvedValue({
      data: null,
      error: { message: "storage failed" },
    });

    mockSanitizeSupabaseError.mockReturnValue("Message utilisateur");

    render(
      <LogoUploadField
        entityType="partenaire"
        onLogoUploaded={onLogoUploaded}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "brand.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: "storage failed" });
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur",
      description: "Message utilisateur",
      variant: "destructive",
    });
    expect(onLogoUploaded).not.toHaveBeenCalled();
    expect(screen.queryByAltText("Logo preview")).not.toBeInTheDocument();
    expect(input.value).toBe("");
  });
});