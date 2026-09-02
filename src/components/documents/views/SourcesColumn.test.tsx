// @vitest-environment jsdom

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SourcesColumn } from "./SourcesColumn";

const { scrollAreaSpy, cnSpy, folderIconSpy, cloudIconSpy, chevronIconSpy } = vi.hoisted(() => ({
  scrollAreaSpy: vi.fn(),
  cnSpy: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ")),
  folderIconSpy: vi.fn(),
  cloudIconSpy: vi.fn(),
  chevronIconSpy: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: cnSpy,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ className, children }: { className?: string; children: React.ReactNode }) => {
    scrollAreaSpy({ className });
    return (
      <div data-testid="scroll-area" className={className}>
        {children}
      </div>
    );
  },
}));

vi.mock("lucide-react", () => ({
  FolderOpen: ({ className }: { className?: string }) => {
    folderIconSpy({ className });
    return <svg data-testid="folder-icon" className={className} />;
  },
  Cloud: ({ className }: { className?: string }) => {
    cloudIconSpy({ className });
    return <svg data-testid="cloud-icon" className={className} />;
  },
  ChevronRight: ({ className }: { className?: string }) => {
    chevronIconSpy({ className });
    return <svg data-testid="chevron-icon" className={className} />;
  },
}));

describe("SourcesColumn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la source locale et masque Nextcloud quand non connecté", () => {
    const onSelectSource = vi.fn();

    render(
      <SourcesColumn
        selectedSource={null}
        onSelectSource={onSelectSource}
        isNextcloudConnected={false}
      />
    );

    expect(screen.getByTestId("scroll-area")).toBeInTheDocument();
    expect(screen.getByText("Mes documents")).toBeInTheDocument();
    expect(screen.queryByText("Serveur Nextcloud")).not.toBeInTheDocument();
    expect(scrollAreaSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: expect.stringContaining("finder-column"),
      })
    );
    expect(folderIconSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: expect.stringContaining("text-blue-500"),
      })
    );
  });

  it("appelle onSelectSource avec local au clic sur Mes documents", () => {
    const onSelectSource = vi.fn();

    render(
      <SourcesColumn
        selectedSource={null}
        onSelectSource={onSelectSource}
        isNextcloudConnected={true}
      />
    );

    fireEvent.click(screen.getByText("Mes documents"));

    expect(onSelectSource).toHaveBeenCalledTimes(1);
    expect(onSelectSource).toHaveBeenCalledWith("local");
  });

  it("appelle onSelectSource avec nextcloud au clic sur Serveur Nextcloud", () => {
    const onSelectSource = vi.fn();

    render(
      <SourcesColumn
        selectedSource={null}
        onSelectSource={onSelectSource}
        isNextcloudConnected={true}
      />
    );

    fireEvent.click(screen.getByText("Serveur Nextcloud"));

    expect(onSelectSource).toHaveBeenCalledTimes(1);
    expect(onSelectSource).toHaveBeenCalledWith("nextcloud");
  });

  it("applique les styles de sélection sur la source locale", () => {
    const onSelectSource = vi.fn();

    render(
      <SourcesColumn
        selectedSource="local"
        onSelectSource={onSelectSource}
        isNextcloudConnected={true}
      />
    );

    const localLabel = screen.getByText("Mes documents");
    expect(localLabel.className).toContain("font-medium");

    expect(folderIconSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: expect.stringContaining("text-primary"),
      })
    );

    const chevrons = screen.getAllByTestId("chevron-icon");
    expect(chevrons).toHaveLength(2);
    expect(cnSpy).toHaveBeenCalledWith(
      "h-3 w-3 shrink-0 text-muted-foreground/40 transition-opacity",
      "text-primary/60"
    );
  });

  it("applique les styles de sélection sur Nextcloud quand connecté et sélectionné", () => {
    const onSelectSource = vi.fn();

    render(
      <SourcesColumn
        selectedSource="nextcloud"
        onSelectSource={onSelectSource}
        isNextcloudConnected={true}
      />
    );

    const nextcloudLabel = screen.getByText("Serveur Nextcloud");
    expect(nextcloudLabel.className).toContain("font-medium");

    expect(cloudIconSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: expect.stringContaining("text-primary"),
      })
    );

    expect(screen.getByText("Mes documents").className).not.toContain("font-medium");
  });

  it("rend les deux sources quand Nextcloud est connecté", () => {
    const onSelectSource = vi.fn();

    render(
      <SourcesColumn
        selectedSource={null}
        onSelectSource={onSelectSource}
        isNextcloudConnected={true}
      />
    );

    expect(screen.getByText("Mes documents")).toBeInTheDocument();
    expect(screen.getByText("Serveur Nextcloud")).toBeInTheDocument();
    expect(screen.getAllByTestId("chevron-icon")).toHaveLength(2);
    expect(screen.getByTestId("folder-icon")).toBeInTheDocument();
    expect(screen.getByTestId("cloud-icon")).toBeInTheDocument();
  });

  it("utilise memo sans empêcher le rendu avec changement de props", () => {
    const onSelectSource = vi.fn();

    const { rerender } = render(
      <SourcesColumn
        selectedSource={null}
        onSelectSource={onSelectSource}
        isNextcloudConnected={false}
      />
    );

    expect(screen.queryByText("Serveur Nextcloud")).not.toBeInTheDocument();

    rerender(
      <SourcesColumn
        selectedSource="nextcloud"
        onSelectSource={onSelectSource}
        isNextcloudConnected={true}
      />
    );

    expect(screen.getByText("Serveur Nextcloud")).toBeInTheDocument();
    expect(screen.getByText("Serveur Nextcloud").className).toContain("font-medium");
  });
});