import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThreadPointerMenu } from "./ThreadPointerMenu";

const {
  debugLogMock,
  debugErrorMock,
  dropdownState,
} = vi.hoisted(() => ({
  debugLogMock: vi.fn(),
  debugErrorMock: vi.fn(),
  dropdownState: {
    lastOnOpenChange: undefined as undefined | ((open: boolean) => void),
  },
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    log: debugLogMock,
    error: debugErrorMock,
  },
}));

vi.mock("@/hooks/email/useEmailFolders", () => ({
  useEmailFolders: () => ({ folders: [] }),
}));

vi.mock("@/hooks/email/useThreadFolders", () => ({
  useThreadFolderMutations: () => ({
    addThreadsToFolder: { mutate: vi.fn() },
  }),
}));

vi.mock("./folders/EmailFolderDialog", () => {
  const FolderIcon = () => <svg data-testid="folder-icon" />;
  return {
    EmailFolderDialog: () => null,
    getFolderColorClass: () => "",
    getFolderIconComponent: () => FolderIcon,
  };
});

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  const Icon = () => <svg data-testid="icon" />;
  return {
    ...actual,
    Archive: Icon,
    Trash2: Icon,
    Mail: Icon,
    MailOpen: Icon,
    Star: Icon,
    StarOff: Icon,
    Tag: Icon,
    CheckCircle2: Icon,
    Circle: Icon,
    Ban: Icon,
    Plus: Icon,
    Sparkles: Icon,
    Link2: Icon,
  };
});

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    onKeyDown,
    autoFocus,
    className,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    autoFocus?: boolean;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => {
  return {
    DropdownMenu: ({
      children,
      onOpenChange,
    }: {
      children: React.ReactNode;
      onOpenChange?: (open: boolean) => void;
    }) => {
      dropdownState.lastOnOpenChange = onOpenChange;
      return <div data-testid="dropdown-root">{children}</div>;
    },
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dropdown-trigger">{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dropdown-content">{children}</div>
    ),
    DropdownMenuItem: ({
      children,
      onClick,
      onSelect,
      className,
    }: {
      children: React.ReactNode;
      onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
      onSelect?: (e: Event) => void;
      className?: string;
    }) => (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          onClick?.(e);
          if (onSelect) {
            const event = new Event("select", { bubbles: true, cancelable: true });
            onSelect(event);
          }
        }}
      >
        {children}
      </button>
    ),
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuSub: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dropdown-sub">{children}</div>
    ),
    DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dropdown-sub-content">{children}</div>
    ),
    DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => (
      <button type="button">{children}</button>
    ),
    DropdownMenuCheckboxItem: ({
      children,
      checked,
      onCheckedChange,
      onClick,
    }: {
      children: React.ReactNode;
      checked?: boolean;
      onCheckedChange?: () => void;
      onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    }) => (
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked ? "true" : "false"}
        onClick={(e) => {
          onClick?.(e);
          onCheckedChange?.();
        }}
      >
        {children}
      </button>
    ),
  };
});

describe("ThreadPointerMenu", () => {
  const renderMenu = (
    overrideProps: Partial<React.ComponentProps<typeof ThreadPointerMenu>> = {},
  ) => {
    const props: React.ComponentProps<typeof ThreadPointerMenu> = {
      open: true,
      onOpenChange: vi.fn(),
      position: { x: 12, y: 34 },
      isUnread: true,
      isStarred: false,
      isProcessed: false,
      currentTags: ["Client", "CustomTag"],
      onToggleRead: vi.fn(),
      onToggleStar: vi.fn(),
      onToggleProcessed: vi.fn(),
      onArchive: vi.fn(),
      onDelete: vi.fn(),
      onMarkAsSpam: vi.fn(),
      onUpdateTags: vi.fn(),
      onSmartTasks: vi.fn(),
      onAssignThread: vi.fn(),
      ...overrideProps,
    };

    const view = render(<ThreadPointerMenu {...props} />);
    return { ...view, props };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dropdownState.lastOnOpenChange = undefined;
  });

  it("affiche les libellés selon les états métier", () => {
    renderMenu({
      isUnread: true,
      isStarred: false,
      isProcessed: false,
      currentTags: ["Urgent", "CustomTag"],
    });

    expect(screen.getByText("Marquer comme traité")).toBeInTheDocument();
    expect(screen.getByText("Marquer comme lu")).toBeInTheDocument();
    expect(screen.getByText("Ajouter aux favoris")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "Urgent" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemcheckbox", { name: "Client" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("menuitemcheckbox", { name: "CustomTag" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("Associer à...")).toBeInTheDocument();
    expect(screen.getByText("Tâches intelligentes")).toBeInTheDocument();
    expect(screen.getByText("Archiver")).toBeInTheDocument();
    expect(screen.getByText("Supprimer")).toBeInTheDocument();
    expect(screen.getByText("Marquer comme spam")).toBeInTheDocument();
  });

  it("déclenche les actions principales au clic", () => {
    const { props } = renderMenu();

    fireEvent.click(screen.getByText("Marquer comme traité"));
    expect(props.onToggleProcessed).toHaveBeenCalledTimes(1);
    expect(debugLogMock).toHaveBeenCalledWith(
      "[ThreadPointerMenu] Toggle processed clicked, isProcessed:",
      false,
    );

    fireEvent.click(screen.getByText("Marquer comme lu"));
    expect(props.onToggleRead).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Ajouter aux favoris"));
    expect(props.onToggleStar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Associer à..."));
    expect(props.onAssignThread).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Tâches intelligentes"));
    expect(props.onSmartTasks).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Archiver"));
    expect(props.onArchive).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Supprimer"));
    expect(props.onDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Marquer comme spam"));
    expect(props.onMarkAsSpam).toHaveBeenCalledTimes(1);
  });

  it("gère les libellés alternatifs quand les états sont inversés", () => {
    renderMenu({
      isUnread: false,
      isStarred: true,
      isProcessed: true,
      onSmartTasks: undefined,
    });

    expect(screen.getByText("Marquer comme non traité")).toBeInTheDocument();
    expect(screen.getByText("Marquer comme non lu")).toBeInTheDocument();
    expect(screen.getByText("Retirer des favoris")).toBeInTheDocument();
    expect(screen.queryByText("Tâches intelligentes")).not.toBeInTheDocument();
  });

  it("ajoute et retire des tags existants", () => {
    const { props } = renderMenu({
      currentTags: ["Client", "CustomTag"],
    });

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Client" }));
    expect(props.onUpdateTags).toHaveBeenCalledWith(["CustomTag"]);

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Urgent" }));
    expect(props.onUpdateTags).toHaveBeenCalledWith(["Client", "CustomTag", "Urgent"]);

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "CustomTag" }));
    expect(props.onUpdateTags).toHaveBeenCalledWith(["Client"]);
  });

  it("permet d'ajouter un nouveau tag via le champ et le bouton OK", () => {
    const { props } = renderMenu({
      currentTags: ["Client"],
    });

    fireEvent.click(screen.getByText("Ajouter un tag..."));

    const input = screen.getByPlaceholderText("Nouveau tag...");
    fireEvent.change(input, { target: { value: "Partenaire" } });
    fireEvent.click(screen.getByText("OK"));

    expect(props.onUpdateTags).toHaveBeenCalledWith(["Client", "Partenaire"]);
    expect(screen.queryByPlaceholderText("Nouveau tag...")).not.toBeInTheDocument();
  });

  it("ajoute un nouveau tag avec Enter et ferme la saisie avec Escape", () => {
    const { props, rerender } = renderMenu({
      currentTags: ["Client"],
    });

    fireEvent.click(screen.getByText("Ajouter un tag..."));
    const input = screen.getByPlaceholderText("Nouveau tag...");
    fireEvent.change(input, { target: { value: "Suivi" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onUpdateTags).toHaveBeenCalledWith(["Client", "Suivi"]);

    rerender(
      <ThreadPointerMenu
        {...props}
        currentTags={["Client"]}
        open={true}
      />,
    );

    fireEvent.click(screen.getByText("Ajouter un tag..."));
    const secondInput = screen.getByPlaceholderText("Nouveau tag...");
    fireEvent.keyDown(secondInput, { key: "Escape" });

    expect(screen.queryByPlaceholderText("Nouveau tag...")).not.toBeInTheDocument();
  });

  it("n'ajoute pas de tag vide ou déjà existant", () => {
    const { props } = renderMenu({
      currentTags: ["Client"],
    });

    fireEvent.click(screen.getByText("Ajouter un tag..."));
    const input = screen.getByPlaceholderText("Nouveau tag...");

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByText("OK"));

    fireEvent.change(screen.getByPlaceholderText("Nouveau tag..."), {
      target: { value: "Client" },
    });
    fireEvent.click(screen.getByText("OK"));

    expect(props.onUpdateTags).not.toHaveBeenCalled();
  });

  it("réinitialise la saisie d'un tag quand le menu se ferme puis se rouvre", () => {
    const onOpenChange = vi.fn();
    const props: React.ComponentProps<typeof ThreadPointerMenu> = {
      open: true,
      onOpenChange,
      position: { x: 1, y: 2 },
      isUnread: true,
      isStarred: false,
      isProcessed: false,
      currentTags: [],
      onToggleRead: vi.fn(),
      onToggleStar: vi.fn(),
      onToggleProcessed: vi.fn(),
      onArchive: vi.fn(),
      onDelete: vi.fn(),
      onMarkAsSpam: vi.fn(),
      onUpdateTags: vi.fn(),
      onSmartTasks: vi.fn(),
      onAssignThread: vi.fn(),
    };

    const { rerender } = render(<ThreadPointerMenu {...props} />);

    fireEvent.click(screen.getByText("Ajouter un tag..."));
    const input = screen.getByPlaceholderText("Nouveau tag...");
    fireEvent.change(input, { target: { value: "Temporaire" } });
    expect(screen.getByDisplayValue("Temporaire")).toBeInTheDocument();

    rerender(<ThreadPointerMenu {...props} open={false} />);
    rerender(<ThreadPointerMenu {...props} open={true} />);

    expect(screen.queryByPlaceholderText("Nouveau tag...")).not.toBeInTheDocument();
    expect(screen.getByText("Ajouter un tag...")).toBeInTheDocument();
  });

  it("capture une erreur sur le toggle processed et la loggue", () => {
    const error = new Error("boom");
    renderMenu({
      onToggleProcessed: vi.fn(() => {
        throw error;
      }),
      isProcessed: true,
    });

    fireEvent.click(screen.getByText("Marquer comme non traité"));

    expect(debugErrorMock).toHaveBeenCalledWith(
      "[ThreadPointerMenu] Error toggling processed:",
      error,
    );
  });
});