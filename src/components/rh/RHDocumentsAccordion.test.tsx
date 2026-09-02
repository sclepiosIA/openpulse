// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { RHDocumentsAccordion } from "./RHDocumentsAccordion";

const { DOCS, OPEN_DOC, DELETE_DOC, DEBUG_ERROR } = vi.hoisted(() => ({
  DOCS: [
    {
      id: "1",
      titre: "Bulletin Janvier",
      type_document: "bulletin_salaire",
      description: null,
      date_document: "2024-01-15T00:00:00.000Z",
      created_at: "2024-01-16T00:00:00.000Z",
      taille_octets: 2048,
    },
    {
      id: "2",
      titre: "CDI 2024",
      type_document: "contrat",
      description: "Contrat principal",
      date_document: "2024-02-01T00:00:00.000Z",
      created_at: "2024-02-02T00:00:00.000Z",
      taille_octets: 1024,
    },
    {
      id: "3",
      titre: "Attestation employeur",
      type_document: "attestation",
      description: null,
      date_document: null,
      created_at: "2024-03-10T00:00:00.000Z",
      taille_octets: null,
    },
    {
      id: "4",
      titre: "Note interne",
      type_document: "autre",
      description: "Document divers",
      date_document: "2024-04-05T00:00:00.000Z",
      created_at: "2024-04-06T00:00:00.000Z",
      taille_octets: 3072,
    },
  ],
  OPEN_DOC: vi.fn(),
  DELETE_DOC: vi.fn(),
  DEBUG_ERROR: vi.fn(),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="accordion" className={className}>
      {children}
    </div>
  ),
  AccordionItem: ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => (
    <section data-testid={`accordion-item-${value}`} className={className}>
      {children}
    </section>
  ),
  AccordionTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
  AccordionContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void | Promise<void>;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <th className={className}>{children}</th>
  ),
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <td className={className}>{children}</td>
  ),
}));

vi.mock("lucide-react", () => ({
  FileText: ({ className }: { className?: string }) => <svg data-testid="file-text-icon" className={className} />,
}));

vi.mock("@/lib/debug", () => ({
  debug: {
    error: DEBUG_ERROR,
  },
}));

describe("RHDocumentsAccordion", () => {
  beforeEach(() => {
    OPEN_DOC.mockReset();
    DELETE_DOC.mockReset();
    DEBUG_ERROR.mockReset();
  });

  it("affiche un skeleton pendant le chargement", () => {
    render(
      <RHDocumentsAccordion
        documents={undefined}
        documentsLoading={true}
        handleOpenDocument={OPEN_DOC}
        deleteDocument={DELETE_DOC}
      />,
    );

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Aucun document")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accordion")).not.toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun document n'est disponible", () => {
    render(
      <RHDocumentsAccordion
        documents={[]}
        documentsLoading={false}
        handleOpenDocument={OPEN_DOC}
        deleteDocument={DELETE_DOC}
      />,
    );

    expect(screen.getByText("Aucun document")).toBeInTheDocument();
    expect(screen.getByText("Commencez par ajouter un document pour cet employé")).toBeInTheDocument();
    expect(screen.getByTestId("file-text-icon")).toBeInTheDocument();
  });

  it("affiche les sections par type avec les informations métier formatées", () => {
    render(
      <RHDocumentsAccordion
        documents={DOCS}
        documentsLoading={false}
        handleOpenDocument={OPEN_DOC}
        deleteDocument={DELETE_DOC}
      />,
    );

    const bulletinsSection = screen.getByTestId("accordion-item-bulletins");
    const contratsSection = screen.getByTestId("accordion-item-contrats");
    const attestationsSection = screen.getByTestId("accordion-item-attestations");
    const autresSection = screen.getByTestId("accordion-item-autres");

    expect(within(bulletinsSection).getByText("Bulletins de salaire")).toBeInTheDocument();
    expect(within(contratsSection).getByText("Contrats")).toBeInTheDocument();
    expect(within(attestationsSection).getByText("Attestations")).toBeInTheDocument();
    expect(within(autresSection).getByText("Autres documents")).toBeInTheDocument();

    expect(within(bulletinsSection).getByText("Bulletin Janvier")).toBeInTheDocument();
    expect(within(contratsSection).getByText("CDI 2024")).toBeInTheDocument();
    expect(within(attestationsSection).getByText("Attestation employeur")).toBeInTheDocument();
    expect(within(autresSection).getByText("Note interne")).toBeInTheDocument();

    expect(within(bulletinsSection).getByText("15 janv. 2024")).toBeInTheDocument();
    expect(within(contratsSection).getByText("01 févr. 2024")).toBeInTheDocument();
    expect(within(attestationsSection).getByText("10 mars 2024")).toBeInTheDocument();
    expect(within(autresSection).getByText("05 avr. 2024")).toBeInTheDocument();

    expect(within(bulletinsSection).getByText("2.0 KB")).toBeInTheDocument();
    expect(within(contratsSection).getByText("1.0 KB")).toBeInTheDocument();
    expect(within(autresSection).getByText("3.0 KB")).toBeInTheDocument();

    expect(within(attestationsSection).getByText("-")).toBeInTheDocument();
    expect(within(autresSection).getByText("Document divers")).toBeInTheDocument();

    expect(within(bulletinsSection).getByText("1")).toBeInTheDocument();
    expect(within(contratsSection).getByText("1")).toBeInTheDocument();
    expect(within(attestationsSection).getByText("1")).toBeInTheDocument();
    expect(within(autresSection).getByText("1")).toBeInTheDocument();
  });

  it("n'affiche pas les sections sans documents correspondants", () => {
    render(
      <RHDocumentsAccordion
        documents={[DOCS[0]]}
        documentsLoading={false}
        handleOpenDocument={OPEN_DOC}
        deleteDocument={DELETE_DOC}
      />,
    );

    expect(screen.getByTestId("accordion-item-bulletins")).toBeInTheDocument();
    expect(screen.queryByTestId("accordion-item-contrats")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accordion-item-attestations")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accordion-item-autres")).not.toBeInTheDocument();
  });

  it("ouvre un document via le bouton d'action", () => {
    render(
      <RHDocumentsAccordion
        documents={DOCS}
        documentsLoading={false}
        handleOpenDocument={OPEN_DOC}
        deleteDocument={DELETE_DOC}
      />,
    );

    const bulletinsSection = screen.getByTestId("accordion-item-bulletins");
    const openButton = within(bulletinsSection).getByRole("button", { name: "👁️" });

    fireEvent.click(openButton);

    expect(OPEN_DOC).toHaveBeenCalledTimes(1);
    expect(OPEN_DOC).toHaveBeenCalledWith(DOCS[0]);
  });

  it("supprime un document via le bouton d'action", async () => {
    DELETE_DOC.mockResolvedValueOnce({ ok: true });

    render(
      <RHDocumentsAccordion
        documents={DOCS}
        documentsLoading={false}
        handleOpenDocument={OPEN_DOC}
        deleteDocument={DELETE_DOC}
      />,
    );

    const contratsSection = screen.getByTestId("accordion-item-contrats");
    const deleteButton = within(contratsSection).getByRole("button", { name: "🗑️" });

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(DELETE_DOC).toHaveBeenCalledTimes(1);
    });

    expect(DELETE_DOC).toHaveBeenCalledWith("2");
    expect(DEBUG_ERROR).not.toHaveBeenCalled();
  });

  it("journalise une erreur si la suppression échoue", async () => {
    const error = new Error("suppression impossible");
    DELETE_DOC.mockRejectedValueOnce(error);

    render(
      <RHDocumentsAccordion
        documents={DOCS}
        documentsLoading={false}
        handleOpenDocument={OPEN_DOC}
        deleteDocument={DELETE_DOC}
      />,
    );

    const bulletinsSection = screen.getByTestId("accordion-item-bulletins");
    const deleteButton = within(bulletinsSection).getByRole("button", { name: "🗑️" });

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(DELETE_DOC).toHaveBeenCalledWith("1");
    });

    await waitFor(() => {
      expect(DEBUG_ERROR).toHaveBeenCalledTimes(1);
    });

    expect(DEBUG_ERROR).toHaveBeenCalledWith("Erreur suppression:", error);
  });
});