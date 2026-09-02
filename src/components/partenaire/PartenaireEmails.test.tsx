import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

const { stableAuth, mockNavigate, mockSanitizeEmailSubject, mockUseEmailsByPartenaire, EMAILS } = vi.hoisted(() => {
  const EMAILS = [
    {
      id: "th_1",
      subject: "Sujet <b>1</b>",
      ai_summary: "Résumé <i>1</i>",
      last_message_date: "2024-02-01T12:00:00.000Z",
      message_count: 1,
    },
    {
      id: "th_2",
      subject: "Sujet 2",
      ai_summary: null,
      last_message_date: "2024-02-02T12:00:00.000Z",
      message_count: 3,
    },
  ] as const;

  return {
    stableAuth: {
      user: { id: "u1", email: "t@t.co" },
      session: { user: { id: "u1" } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
    mockSanitizeEmailSubject: vi.fn((s: string) => `san:${String(s)}`),
    mockUseEmailsByPartenaire: vi.fn(),
    EMAILS,
  };
});

vi.mock("@/components/ui/card", () => {
  const React = require("react") as typeof import("react");
  return {
    Card: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
      <div data-testid="card" role="button" tabIndex={0} onClick={onClick} className={className}>
        {children}
      </div>
    ),
    CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="card-content" className={className}>
        {children}
      </div>
    ),
  };
});

vi.mock("lucide-react", () => {
  const React = require("react") as typeof import("react");
  return {
    Mail: (props: Record<string, unknown>) => <svg data-testid="mail-icon" {...props} />,
  };
});

vi.mock("react-router-dom", () => {
  return {
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/lib/emailUtils", () => {
  return {
    sanitizeEmailSubject: mockSanitizeEmailSubject,
  };
});

vi.mock("@/hooks/email/useEmailsByPartenaire", () => {
  return {
    useEmailsByPartenaire: mockUseEmailsByPartenaire,
  };
});

vi.mock("@/components/AuthProvider", () => {
  return {
    useAuth: () => stableAuth,
  };
});
vi.mock("@/contexts/AuthContext", () => {
  return {
    useAuth: () => stableAuth,
  };
});
vi.mock("@/hooks/useAuth", () => {
  return {
    useAuth: () => stableAuth,
  };
});

import { PartenaireEmails } from "./PartenaireEmails";

afterEach(() => {
  cleanup();
  mockNavigate.mockReset();
  mockSanitizeEmailSubject.mockClear();
  mockUseEmailsByPartenaire.mockReset();
});

beforeEach(() => {
  mockSanitizeEmailSubject.mockImplementation((s: string) => `san:${String(s)}`);
});

describe("PartenaireEmails", () => {
  it("affiche le chargement quand isLoading=true", () => {
    mockUseEmailsByPartenaire.mockReturnValue({ emails: [], isLoading: true });

    render(<PartenaireEmails partenaireId="p1" />);

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
    expect(screen.queryByText("Aucun email")).not.toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun email", () => {
    mockUseEmailsByPartenaire.mockReturnValue({ emails: [], isLoading: false });

    render(<PartenaireEmails partenaireId="p1" />);

    expect(screen.getByText("Aucun email")).toBeInTheDocument();
    expect(screen.getByText("Les emails associés à ce partenaire apparaîtront ici")).toBeInTheDocument();
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
    expect(mockSanitizeEmailSubject).not.toHaveBeenCalled();
  });

  it("affiche les emails, applique sanitize, gère le pluriel et navigue au clic", () => {
    mockUseEmailsByPartenaire.mockReturnValue({ emails: [...EMAILS], isLoading: false });

    render(<PartenaireEmails partenaireId="p1" />);

    expect(screen.queryByText("Chargement...")).not.toBeInTheDocument();
    expect(screen.queryByText("Aucun email")).not.toBeInTheDocument();

    expect(screen.getByText("san:Sujet <b>1</b>")).toBeInTheDocument();
    expect(screen.getByText("san:Résumé <i>1</i>")).toBeInTheDocument();

    expect(screen.getByText(new Date("2024-02-01T12:00:00.000Z").toLocaleDateString("fr-FR"))).toBeInTheDocument();
    expect(screen.getByText("1 message")).toBeInTheDocument();

    expect(screen.getByText("san:Sujet 2")).toBeInTheDocument();
    expect(screen.getByText(new Date("2024-02-02T12:00:00.000Z").toLocaleDateString("fr-FR"))).toBeInTheDocument();
    expect(screen.getByText("3 messages")).toBeInTheDocument();

    expect(mockSanitizeEmailSubject).toHaveBeenCalledWith("Sujet <b>1</b>");
    expect(mockSanitizeEmailSubject).toHaveBeenCalledWith("Résumé <i>1</i>");
    expect(mockSanitizeEmailSubject).toHaveBeenCalledWith("Sujet 2");

    const firstCard = screen.getAllByTestId("card")[0];
    fireEvent.click(firstCard);

    expect(mockNavigate).toHaveBeenCalledWith("/emails?thread=th_1");
  });
});