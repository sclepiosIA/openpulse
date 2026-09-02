// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmailListPanelHeader } from "./EmailListPanelHeader";

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
    "aria-label": ariaLabel,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    "aria-label"?: string;
    className?: string;
  }) => (
    <button
      type="button"
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

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    className,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    className?: string;
  }) => (
    <input
      type="checkbox"
      aria-label="select-all-checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={className}
    />
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    RefreshCw: Icon,
    Plus: Icon,
    Search: Icon,
    CheckSquare: Icon,
    MailOpen: Icon,
    CircleDashed: Icon,
    Inbox: Icon,
    Send: Icon,
    Trash2: Icon,
  };
});

describe("EmailListPanelHeader", () => {
  it("affiche les filtres rapides en inbox et les compteurs métiers", () => {
    const updateFilter = vi.fn();

    render(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: false,
          unprocessedOnly: false,
        }}
        updateFilter={updateFilter}
        isSelectionMode={false}
        threadsCount={12}
        selectedCount={0}
        unreadCount={3}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    expect(screen.getByText("Réception")).toBeInTheDocument();
    expect(screen.getByText("Envoyés")).toBeInTheDocument();
    expect(screen.getByText("Corbeille")).toBeInTheDocument();

    expect(screen.getByText("Tous")).toBeInTheDocument();
    expect(screen.getByText("Non lus")).toBeInTheDocument();
    expect(screen.getByText("Non traités")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(screen.getByPlaceholderText("Rechercher...")).toHaveValue("");
  });

  it("masque les filtres rapides pour la boîte envoyés", () => {
    render(
      <EmailListPanelHeader
        filters={{
          mailbox: "sent",
          search: "",
          unreadOnly: false,
          unprocessedOnly: false,
        }}
        updateFilter={vi.fn()}
        isSelectionMode={false}
        threadsCount={5}
        selectedCount={0}
        unreadCount={4}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    expect(screen.queryByText("Tous")).not.toBeInTheDocument();
    expect(screen.queryByText("Non lus")).not.toBeInTheDocument();
    expect(screen.queryByText("Non traités")).not.toBeInTheDocument();
  });

  it("appelle updateFilter correctement lors du changement de boîte mail", () => {
    const updateFilter = vi.fn();

    render(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: true,
          unprocessedOnly: true,
        }}
        updateFilter={updateFilter}
        isSelectionMode={false}
        threadsCount={5}
        selectedCount={0}
        unreadCount={2}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Envoyés"));

    expect(updateFilter).toHaveBeenCalledWith("mailbox", "sent");
    expect(updateFilter).toHaveBeenCalledWith("unreadOnly", false);
    expect(updateFilter).toHaveBeenCalledWith("unprocessedOnly", false);
    expect(updateFilter).toHaveBeenCalledTimes(3);
  });

  it("appelle updateFilter correctement lors du clic sur Corbeille", () => {
    const updateFilter = vi.fn();

    render(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: true,
          unprocessedOnly: true,
        }}
        updateFilter={updateFilter}
        isSelectionMode={false}
        threadsCount={5}
        selectedCount={0}
        unreadCount={2}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Corbeille"));

    expect(updateFilter).toHaveBeenCalledWith("mailbox", "trash");
    expect(updateFilter).toHaveBeenCalledWith("unreadOnly", false);
    expect(updateFilter).toHaveBeenCalledWith("unprocessedOnly", false);
    expect(updateFilter).toHaveBeenCalledTimes(3);
  });

  it("active les filtres rapides avec les bonnes valeurs", () => {
    const updateFilter = vi.fn();

    render(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: false,
          unprocessedOnly: false,
        }}
        updateFilter={updateFilter}
        isSelectionMode={false}
        threadsCount={8}
        selectedCount={0}
        unreadCount={6}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Tous"));
    expect(updateFilter).toHaveBeenNthCalledWith(1, "unreadOnly", false);
    expect(updateFilter).toHaveBeenNthCalledWith(2, "unprocessedOnly", false);

    updateFilter.mockClear();

    fireEvent.click(screen.getByText("Non lus"));
    expect(updateFilter).toHaveBeenNthCalledWith(1, "unreadOnly", true);
    expect(updateFilter).toHaveBeenNthCalledWith(2, "unprocessedOnly", false);

    updateFilter.mockClear();

    fireEvent.click(screen.getByText("Non traités"));
    expect(updateFilter).toHaveBeenNthCalledWith(1, "unreadOnly", false);
    expect(updateFilter).toHaveBeenNthCalledWith(2, "unprocessedOnly", true);
  });

  it("met à jour la recherche à la saisie", () => {
    const updateFilter = vi.fn();

    render(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: false,
          unprocessedOnly: false,
        }}
        updateFilter={updateFilter}
        isSelectionMode={false}
        threadsCount={4}
        selectedCount={0}
        unreadCount={1}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), {
      target: { value: "client urgent" },
    });

    expect(updateFilter).toHaveBeenCalledWith("search", "client urgent");
  });

  it("affiche la case sélectionner tout seulement en mode sélection avec des threads", () => {
    const onSelectAll = vi.fn();

    const { rerender } = render(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: false,
          unprocessedOnly: false,
        }}
        updateFilter={vi.fn()}
        isSelectionMode={false}
        threadsCount={3}
        selectedCount={0}
        unreadCount={0}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={onSelectAll}
      />
    );

    expect(screen.queryByLabelText("select-all-checkbox")).not.toBeInTheDocument();

    rerender(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: false,
          unprocessedOnly: false,
        }}
        updateFilter={vi.fn()}
        isSelectionMode={true}
        threadsCount={3}
        selectedCount={3}
        unreadCount={0}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={onSelectAll}
      />
    );

    const checkbox = screen.getByLabelText("select-all-checkbox");
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(onSelectAll).toHaveBeenCalledWith(false);
  });

  it("déclenche les actions des boutons d'action", () => {
    const onToggleSelectionMode = vi.fn();
    const onSyncNow = vi.fn();
    const onComposeNew = vi.fn();

    render(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: false,
          unprocessedOnly: false,
        }}
        updateFilter={vi.fn()}
        isSelectionMode={false}
        threadsCount={2}
        selectedCount={0}
        unreadCount={0}
        onToggleSelectionMode={onToggleSelectionMode}
        onSelectAll={vi.fn()}
        onSyncNow={onSyncNow}
        onComposeNew={onComposeNew}
      />
    );

    fireEvent.click(screen.getByLabelText("Tout sélectionner"));
    fireEvent.click(screen.getByLabelText("Actualiser"));
    fireEvent.click(screen.getByLabelText("Ajouter"));

    expect(onToggleSelectionMode).toHaveBeenCalledTimes(1);
    expect(onSyncNow).toHaveBeenCalledTimes(1);
    expect(onComposeNew).toHaveBeenCalledTimes(1);
  });

  it("désactive la synchronisation quand isSyncing vaut true", () => {
    const onSyncNow = vi.fn();

    render(
      <EmailListPanelHeader
        filters={{
          mailbox: "inbox",
          search: "",
          unreadOnly: false,
          unprocessedOnly: false,
        }}
        updateFilter={vi.fn()}
        isSelectionMode={false}
        threadsCount={2}
        selectedCount={0}
        unreadCount={0}
        onToggleSelectionMode={vi.fn()}
        onSelectAll={vi.fn()}
        onSyncNow={onSyncNow}
        isSyncing={true}
      />
    );

    const syncButton = screen.getByLabelText("Actualiser");
    expect(syncButton).toBeDisabled();

    fireEvent.click(syncButton);
    expect(onSyncNow).not.toHaveBeenCalled();
  });
});