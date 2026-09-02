import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  PROFILES,
  PROFILES_RESULT,
  UPDATE_GROUPE_RESULT,
  mockMutateAsync,
  mockUseProfilesWithRoles,
  mockUseUpdateGroupe,
  toastError,
  toastSuccess,
} = vi.hoisted(() => {
  const PROFILES = [
    { id: "p1", prenom: "Alice", nom: "Martin" },
    { id: "p2", prenom: "Benoit", nom: "Durand" },
  ];

  const mockMutateAsync = vi.fn();

  const UPDATE_GROUPE_RESULT = {
    mutateAsync: mockMutateAsync,
    isPending: false,
  };

  const PROFILES_RESULT = {
    data: PROFILES,
  };

  return {
    PROFILES,
    PROFILES_RESULT,
    UPDATE_GROUPE_RESULT,
    mockMutateAsync,
    mockUseProfilesWithRoles: vi.fn(() => PROFILES_RESULT),
    mockUseUpdateGroupe: vi.fn(() => UPDATE_GROUPE_RESULT),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

vi.mock("@/hooks/crm/useGroupes", () => ({
  useUpdateGroupe: mockUseUpdateGroupe,
}));

vi.mock("@/hooks/profile/useProfilesWithRoles", () => ({
  useProfilesWithRoles: mockUseProfilesWithRoles,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("@/components/ui/dialog", async () => {
  const ReactModule = await import("react");

  type DialogProps = {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: React.ReactNode;
  };

  type DivProps = React.HTMLAttributes<HTMLDivElement>;

  return {
    Dialog: ({ open, children }: DialogProps) => (open ? <div data-testid="dialog-root">{children}</div> : null),
    DialogContent: ({ children, ...props }: DivProps) => (
      <div role="dialog" {...props}>
        {children}
      </div>
    ),
    DialogHeader: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
    DialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  };
});

vi.mock("@/components/ui/button", async () => {
  const ReactModule = await import("react");

  type ButtonProps = React.ComponentProps<"button"> & {
    variant?: string;
  };

  const Button = ReactModule.forwardRef<HTMLButtonElement, ButtonProps>(({ variant: _variant, ...props }, ref) => (
    <button ref={ref} {...props} />
  ));

  Button.displayName = "Button";

  return { Button };
});

vi.mock("@/components/ui/input", async () => {
  const ReactModule = await import("react");

  const Input = ReactModule.forwardRef<HTMLInputElement, React.ComponentProps<"input">>((props, ref) => (
    <input ref={ref} {...props} />
  ));

  Input.displayName = "Input";

  return { Input };
});

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.ComponentProps<"label">) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/textarea", async () => {
  const ReactModule = await import("react");

  const Textarea = ReactModule.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>((props, ref) => (
    <textarea ref={ref} {...props} />
  ));

  Textarea.displayName = "Textarea";

  return { Textarea };
});

vi.mock("@/components/ui/select", () => {
  type SelectProps = {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: React.ReactNode;
  };

  type SelectItemProps = {
    value: string;
    children?: React.ReactNode;
  };

  return {
    Select: ({ value, onValueChange, children }: SelectProps) => (
      <select value={value ?? ""} onChange={(event) => onValueChange?.(event.currentTarget.value)}>
        {children}
      </select>
    ),
    SelectContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SelectItem: ({ value, children }: SelectItemProps) => <option value={value}>{children}</option>,
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
  };
});

vi.mock("@/components/ui/EntityLogoUpload", () => {
  type EntityLogoUploadProps = {
    entityType: string;
    entityId: string;
    entityName: string;
    currentLogoUrl?: string | null;
    onLogoChange: (url: string | null) => void;
    size?: string;
  };

  return {
    EntityLogoUpload: ({ entityId, entityName, currentLogoUrl }: EntityLogoUploadProps) => (
      <div data-testid="entity-logo-upload" data-entity-id={entityId} data-current-logo={currentLogoUrl ?? ""}>
        {entityName}
      </div>
    ),
  };
});

import { GroupeEditDialog } from "./GroupeEditDialog";

type GroupeProp = React.ComponentProps<typeof GroupeEditDialog>["groupe"];

const baseGroupe = {
  id: "g1",
  nom: "Groupe Santé Nord",
  type: "GHT",
  description: "Réseau public de soins",
  adresse_siege: "1 rue des Lilas",
  code_postal_siege: "59000",
  ville_siege: "Lille",
  region: "Hauts-de-France",
  telephone: "0102030405",
  email: "a@b.fr",
  responsable_commercial_id: "p1",
  responsable_csm_id: "p2",
  notes: "Note interne",
  logo_url: "/logo-groupe.png",
  created_at: "2024-01-01",
  updated_at: "2024-01-02",
} as GroupeProp;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);
}

function renderDialog({
  open = true,
  onOpenChange = vi.fn(),
  groupe = baseGroupe,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  groupe?: GroupeProp;
} = {}) {
  renderWithProviders(<GroupeEditDialog open={open} onOpenChange={onOpenChange} groupe={groupe} />);
  return { onOpenChange };
}

describe("GroupeEditDialog", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ id: "g1" });
    toastSuccess.mockClear();
    toastError.mockClear();
    mockUseProfilesWithRoles.mockClear();
    mockUseUpdateGroupe.mockClear();
    PROFILES_RESULT.data = PROFILES;
    UPDATE_GROUPE_RESULT.isPending = false;
  });

  it("affiche le formulaire ouvert avec les valeurs métier du groupe", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Modifier le groupe" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom du groupe/)).toHaveValue("Groupe Santé Nord");
    expect(screen.getByLabelText("Description")).toHaveValue("Réseau public de soins");
    expect(screen.getByLabelText("Adresse")).toHaveValue("1 rue des Lilas");
    expect(screen.getByLabelText("Code postal")).toHaveValue("59000");
    expect(screen.getByLabelText("Ville")).toHaveValue("Lille");
    expect(screen.getByLabelText("Région")).toHaveValue("Hauts-de-France");
    expect(screen.getByLabelText("Téléphone")).toHaveValue("0102030405");
    expect(screen.getByLabelText("Email")).toHaveValue("a@b.fr");
    expect(screen.getByLabelText("Notes")).toHaveValue("Note interne");
    expect(screen.getByText("Logo du groupe")).toBeInTheDocument();
    expect(screen.getAllByText("Alice Martin")).toHaveLength(2);
    expect(screen.getAllByText("Benoit Durand")).toHaveLength(2);
  });

  it("ne rend pas le dialogue quand open vaut false", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Modifier le groupe" })).not.toBeInTheDocument();
  });

  it("affiche l'état de chargement de la mutation", () => {
    UPDATE_GROUPE_RESULT.isPending = true;

    renderDialog();

    expect(screen.getByRole("button", { name: "Modification..." })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument();
  });

  it("soumet les modifications, affiche un succès et ferme le dialogue", async () => {
    const onOpenChange = vi.fn();

    renderDialog({ onOpenChange });

    fireEvent.change(screen.getByLabelText(/Nom du groupe/), {
      target: { value: "Groupe Santé Nord Actualisé" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "g1",
        data: expect.objectContaining({
          nom: "Groupe Santé Nord Actualisé",
          type: "GHT",
          description: "Réseau public de soins",
          adresse_siege: "1 rue des Lilas",
          code_postal_siege: "59000",
          ville_siege: "Lille",
          region: "Hauts-de-France",
          telephone: "0102030405",
          email: "a@b.fr",
          responsable_commercial_id: "p1",
          responsable_csm_id: "p2",
          notes: "Note interne",
        }),
      });
    });

    expect(toastSuccess).toHaveBeenCalledWith("Groupe modifié avec succès");
    expect(toastError).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("convertit les responsables à none en valeurs undefined lors de la soumission", async () => {
    const groupeSansResponsables = {
      ...baseGroupe,
      responsable_commercial_id: null,
      responsable_csm_id: null,
    } as GroupeProp;

    renderDialog({ groupe: groupeSansResponsables });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "g1",
        data: expect.objectContaining({
          nom: "Groupe Santé Nord",
          responsable_commercial_id: undefined,
          responsable_csm_id: undefined,
        }),
      });
    });
  });

  it("affiche une erreur et ne ferme pas le dialogue quand la mutation échoue", async () => {
    const onOpenChange = vi.fn();
    mockMutateAsync.mockRejectedValue(new Error("x"));

    renderDialog({ onOpenChange });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: "g1",
        data: expect.objectContaining({
          nom: "Groupe Santé Nord",
          responsable_commercial_id: "p1",
          responsable_csm_id: "p2",
        }),
      });
    });

    expect(toastError).toHaveBeenCalledWith("Erreur lors de la modification du groupe");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("ferme le dialogue via le bouton Annuler", () => {
    const onOpenChange = vi.fn();

    renderDialog({ onOpenChange });

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});