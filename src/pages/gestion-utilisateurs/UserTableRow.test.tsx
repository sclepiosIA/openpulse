/* @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { UserTableRow } from "./UserTableRow";

const {
  USER,
  INACTIVE_USER,
  EDITING_USER,
  FORM_DATA,
  ROLE_INFO,
  ROLES_CONFIG,
  TEAMS_CONFIG,
} = vi.hoisted(() => ({
  USER: {
    id: "u1",
    prenom: "Jean",
    nom: "Dupont",
    email: "jean@example.com",
    role: "admin",
    actif: true,
  },
  INACTIVE_USER: {
    id: "u1",
    prenom: "Jean",
    nom: "Dupont",
    email: "jean@example.com",
    role: "admin",
    actif: false,
  },
  EDITING_USER: {
    id: "u1",
    prenom: "Jean",
    nom: "Dupont",
  },
  FORM_DATA: {
    prenom: "Jean",
    nom: "Dupont",
    email: "jean@example.com",
    role: "admin",
    actif: true,
  },
  ROLE_INFO: {
    icon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="role-icon" {...props} />,
    team: "direction",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: "Administrateur",
  },
  ROLES_CONFIG: {
    admin: {
      icon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="admin-role-option-icon" {...props} />,
      team: "direction",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      label: "Administrateur",
    },
    manager: {
      icon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="manager-role-option-icon" {...props} />,
      team: "operations",
      color: "text-green-600",
      bgColor: "bg-green-50",
      label: "Manager",
    },
  },
  TEAMS_CONFIG: {
    direction: {
      label: "Direction",
      color: "text-slate-700",
      bgColor: "bg-slate-100",
    },
    operations: {
      label: "Opérations",
      color: "text-orange-700",
      bgColor: "bg-orange-100",
    },
  },
}));

vi.mock("../GestionUtilisateurs.config", () => ({
  rolesConfig: ROLES_CONFIG,
  teamsConfig: TEAMS_CONFIG,
}));

vi.mock("./EmailAccountsSection", () => ({
  EmailAccountsSection: ({ profileId, prenom, nom }: { profileId: string; prenom: string; nom: string }) => (
    <div data-testid="email-accounts-section">
      {profileId}-{prenom}-{nom}
    </div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="badge" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    type = "button",
    disabled,
    title,
    "aria-label": ariaLabel,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    title?: string;
    "aria-label"?: string;
    className?: string;
  }) => (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    id,
    value,
    onChange,
    type = "text",
    required,
  }: {
    id?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    type?: string;
    required?: boolean;
  }) => <input id={id} value={value} onChange={onChange} type={type} required={required} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
  }) => (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={id === "edit-actif" ? "Compte actif" : undefined}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? "on" : "off"}
    </button>
  ),
}));

vi.mock("@/components/ui/table", () => ({
  TableRow: ({ children }: { children: React.ReactNode }) => (
    <tr data-testid="table-row">{children}</tr>
  ),
  TableCell: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <td className={className}>{children}</td>,
}));

vi.mock("@/components/ui/dialog", () => {
  const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }>({ open: false });

  return {
    Dialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>,
    DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => {
      const ctx = React.useContext(DialogContext);
      return ctx.open ? (
        <div data-testid="dialog-content" className={className}>
          {children}
        </div>
      ) : null;
    },
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  };
});

vi.mock("@/components/ui/alert-dialog", () => {
  const AlertDialogContext = React.createContext<{
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  } | null>(null);

  function AlertDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false);
    return <AlertDialogContext.Provider value={{ open, setOpen }}>{children}</AlertDialogContext.Provider>;
  }

  function AlertDialogTrigger({
    children,
  }: {
    children: React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
    asChild?: boolean;
  }) {
    const ctx = React.useContext(AlertDialogContext);
    if (!ctx) return children;
    const originalOnClick = children.props.onClick;
    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        originalOnClick?.(event);
        ctx.setOpen(true);
      },
    });
  }

  function AlertDialogContent({ children }: { children: React.ReactNode }) {
    const ctx = React.useContext(AlertDialogContext);
    return ctx?.open ? <div data-testid="alert-dialog-content">{children}</div> : null;
  }

  function AlertDialogCancel({ children }: { children: React.ReactNode }) {
    const ctx = React.useContext(AlertDialogContext);
    return (
      <button type="button" onClick={() => ctx?.setOpen(false)}>
        {children}
      </button>
    );
  }

  function AlertDialogAction({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    className?: string;
  }) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    );
  }

  return {
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    AlertDialogDescription: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogCancel,
    AlertDialogAction,
  };
});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="select-root" data-value={value}>
      <button type="button" onClick={() => onValueChange("manager")}>
        change-role
      </button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>selected-role</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`select-item-${value}`}>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Edit: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="edit-icon" {...props} />,
  Key: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="key-icon" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  ShieldOff: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="shieldoff-icon" {...props} />,
  UserX: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="userx-icon" {...props} />,
}));

function renderRow(
  override?: Partial<React.ComponentProps<typeof UserTableRow>>,
  userOverride?: typeof USER
) {
  const getRoleInfo = vi.fn(() => ROLE_INFO);
  const setEditingUser = vi.fn();
  const setFormData = vi.fn();
  const onToggleStatus = vi.fn();
  const onOpenResetPassword = vi.fn();
  const onDisableUser = vi.fn();
  const onEdit = vi.fn();
  const onEditSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
  const onDelete = vi.fn();

  render(
    <table>
      <tbody>
        <UserTableRow
          user={userOverride ?? USER}
          getRoleInfo={getRoleInfo}
          disablingUserId={null}
          editingUser={null}
          setEditingUser={setEditingUser}
          formData={FORM_DATA}
          setFormData={setFormData}
          updateProfilePending={false}
          onToggleStatus={onToggleStatus}
          onOpenResetPassword={onOpenResetPassword}
          onDisableUser={onDisableUser}
          onEdit={onEdit}
          onEditSubmit={onEditSubmit}
          onDelete={onDelete}
          {...override}
        />
      </tbody>
    </table>
  );

  return {
    getRoleInfo,
    setEditingUser,
    setFormData,
    onToggleStatus,
    onOpenResetPassword,
    onDisableUser,
    onEdit,
    onEditSubmit,
    onDelete,
  };
}

describe("UserTableRow", () => {
  it("affiche les informations métier de l'utilisateur, le rôle, l'équipe et le statut actif", () => {
    const { getRoleInfo } = renderRow();

    expect(getRoleInfo).toHaveBeenCalledWith("admin");
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getAllByText("jean@example.com")).toHaveLength(2);
    expect(screen.getByText("Administrateur")).toBeInTheDocument();
    expect(screen.getByText("Direction")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("déclenche les actions directes et ouvre les dialogues de confirmation", () => {
    const { onToggleStatus, onOpenResetPassword, onDisableUser, onDelete } = renderRow();

    fireEvent.click(screen.getByRole("switch"));
    expect(onToggleStatus).toHaveBeenCalledWith(USER);

    fireEvent.click(screen.getByLabelText("Clé"));
    expect(onOpenResetPassword).toHaveBeenCalledWith(USER);

    fireEvent.click(screen.getByTitle("Désactiver et déconnecter"));
    expect(screen.getByText("Désactiver et déconnecter Jean Dupont ?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Désactiver et déconnecter"));
    expect(onDisableUser).toHaveBeenCalledWith(USER);

    fireEvent.click(screen.getByLabelText("Désactiver l'utilisateur"));
    expect(screen.getByText("Offboarding de Jean Dupont ?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirmer l'offboarding"));
    expect(onDelete).toHaveBeenCalledWith("u1");
  });

  it("affiche le loader de désactivation quand l'utilisateur est en cours de traitement", () => {
    renderRow({ disablingUserId: "u1" });

    expect(screen.getByTitle("Désactiver et déconnecter")).toBeDisabled();
    expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("shieldoff-icon")).not.toBeInTheDocument();
  });

  it("ouvre le dialogue d'édition, affiche le formulaire, propage les changements et permet de fermer", () => {
    const { onEdit, setFormData, setEditingUser, onEditSubmit } = renderRow({
      editingUser: EDITING_USER,
    });

    fireEvent.click(screen.getByLabelText("Modifier"));
    expect(onEdit).toHaveBeenCalledWith(USER);

    expect(screen.getByText("Modifier Jean Dupont")).toBeInTheDocument();
    expect(screen.getByLabelText("Prénom")).toHaveValue("Jean");
    expect(screen.getByLabelText("Nom")).toHaveValue("Dupont");
    expect(screen.getByLabelText("Email")).toHaveValue("jean@example.com");
    expect(screen.getByLabelText("Compte actif")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("email-accounts-section")).toHaveTextContent("u1-Jean-Dupont");

    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Jeanne" } });
    expect(setFormData).toHaveBeenCalledWith({
      ...FORM_DATA,
      prenom: "Jeanne",
    });

    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Martin" } });
    expect(setFormData).toHaveBeenCalledWith({
      ...FORM_DATA,
      nom: "Martin",
    });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jeanne@example.com" } });
    expect(setFormData).toHaveBeenCalledWith({
      ...FORM_DATA,
      email: "jeanne@example.com",
    });

    fireEvent.click(screen.getByText("change-role"));
    expect(setFormData).toHaveBeenCalledWith({
      ...FORM_DATA,
      role: "manager",
    });

    fireEvent.click(screen.getByLabelText("Compte actif"));
    expect(setFormData).toHaveBeenCalledWith({
      ...FORM_DATA,
      actif: false,
    });

    fireEvent.submit(screen.getByRole("button", { name: "Enregistrer" }).closest("form") as HTMLFormElement);
    expect(onEditSubmit).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(setEditingUser).toHaveBeenCalledWith(null);
  });

  it("affiche l'état inactif et masque l'action de désactivation rapide pour un utilisateur déjà inactif", () => {
    renderRow(undefined, INACTIVE_USER);

    expect(screen.getByText("Inactif")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTitle("Désactiver et déconnecter")).not.toBeInTheDocument();
  });

  it("affiche le texte de soumission en attente dans le formulaire d'édition", () => {
    renderRow({
      editingUser: EDITING_USER,
      updateProfilePending: true,
    });

    expect(screen.getByRole("button", { name: "Mise à jour..." })).toBeDisabled();
  });
});