import { render, screen, fireEvent, act, waitFor, cleanup } from "@testing-library/react";
import React from "react";
import { ResetPortalPasswordDialog } from "./ResetPortalPasswordDialog";

const { mockMutateAsync, hookState, writeTextMock } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  hookState: { isPending: false },
  writeTextMock: vi.fn(),
}));

vi.mock("@/hooks/portail/useClientPortal", () => ({
  useResetClientPortalPassword: () => ({
    mutateAsync: mockMutateAsync,
    isPending: hookState.isPending,
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children?: React.ReactNode }) => <div role="alert">{children}</div>,
  AlertTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe("ResetPortalPasswordDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.isPending = false;
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("ne rend rien quand open est false", () => {
    render(
      <ResetPortalPasswordDialog
        open={false}
        onOpenChange={vi.fn()}
        userId="u1"
        userEmail="client@test.fr"
      />
    );
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("affiche le titre et l'email du compte quand open est true", () => {
    render(
      <ResetPortalPasswordDialog
        open={true}
        onOpenChange={vi.fn()}
        userId="u1"
        userEmail="client@test.fr"
      />
    );
    expect(screen.getByText("Réinitialiser le mot de passe")).toBeInTheDocument();
    expect(screen.getByText("client@test.fr")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
    ).toBeInTheDocument();
  });

  it("affiche la description générique sans userEmail", () => {
    render(
      <ResetPortalPasswordDialog open={true} onOpenChange={vi.fn()} userId="u1" />
    );
    expect(
      screen.getByText("Génère un nouveau mot de passe temporaire.")
    ).toBeInTheDocument();
  });

  it("désactive le bouton de génération quand userId est null", () => {
    render(
      <ResetPortalPasswordDialog open={true} onOpenChange={vi.fn()} userId={null} />
    );
    expect(
      screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
    ).toBeDisabled();
  });

  it("affiche 'Génération...' quand la mutation est en cours", () => {
    hookState.isPending = true;
    render(
      <ResetPortalPasswordDialog open={true} onOpenChange={vi.fn()} userId="u1" />
    );
    const btn = screen.getByRole("button", { name: "Génération..." });
    expect(btn).toBeDisabled();
  });

  it("appelle mutateAsync avec le userId et affiche le mot de passe temporaire", async () => {
    mockMutateAsync.mockResolvedValue({ temp_password: "motdepasse-temp" });
    render(
      <ResetPortalPasswordDialog
        open={true}
        onOpenChange={vi.fn()}
        userId="user-42"
        userEmail="client@test.fr"
      />
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
      );
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith("user-42");

    await waitFor(() => {
      expect(screen.getByDisplayValue("motdepasse-temp")).toBeInTheDocument();
    });
    expect(screen.getByText("Nouveau mot de passe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fermer" })).toBeInTheDocument();
  });

  it("copie le mot de passe dans le presse-papier", async () => {
    mockMutateAsync.mockResolvedValue({ temp_password: "motdepasse-temp" });
    render(
      <ResetPortalPasswordDialog open={true} onOpenChange={vi.fn()} userId="user-42" />
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith("motdepasse-temp");
  });

  it("appelle onOpenChange(false) au clic sur Annuler", () => {
    const onOpenChange = vi.fn();
    render(
      <ResetPortalPasswordDialog open={true} onOpenChange={onOpenChange} userId="u1" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("appelle onOpenChange(false) au clic sur Fermer après génération", async () => {
    mockMutateAsync.mockResolvedValue({ temp_password: "motdepasse-temp" });
    const onOpenChange = vi.fn();
    render(
      <ResetPortalPasswordDialog open={true} onOpenChange={onOpenChange} userId="u1" />
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("n'affiche pas de mot de passe tant que la mutation n'a pas résolu", async () => {
    // Promesse jamais résolue : le composant reste sur l'écran initial
    // (le composant ne catch pas les rejets, on évite donc une rejection non gérée)
    mockMutateAsync.mockImplementation(() => new Promise(() => undefined));
    render(
      <ResetPortalPasswordDialog open={true} onOpenChange={vi.fn()} userId="u1" />
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
      );
    });

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith("u1");
    expect(screen.queryByText("Nouveau mot de passe")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
    ).toBeInTheDocument();
  });

  it("réinitialise l'état (mot de passe masqué) quand le dialog se ferme puis se rouvre", async () => {
    mockMutateAsync.mockResolvedValue({ temp_password: "motdepasse-temp" });
    const { rerender } = render(
      <ResetPortalPasswordDialog open={true} onOpenChange={vi.fn()} userId="u1" />
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
      );
    });
    expect(screen.getByDisplayValue("motdepasse-temp")).toBeInTheDocument();

    rerender(
      <ResetPortalPasswordDialog open={false} onOpenChange={vi.fn()} userId="u1" />
    );
    rerender(
      <ResetPortalPasswordDialog open={true} onOpenChange={vi.fn()} userId="u1" />
    );

    expect(screen.queryByDisplayValue("motdepasse-temp")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Générer un nouveau mot de passe" })
    ).toBeInTheDocument();
  });
});