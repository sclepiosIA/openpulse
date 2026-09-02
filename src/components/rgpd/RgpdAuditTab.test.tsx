/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { format, parseISO } from 'date-fns';
import { RgpdAuditTab } from './RgpdAuditTab';

const {
  cardMocks,
  tableMocks,
  badgeMocks,
  scrollAreaMocks,
  iconMocks,
  AUDIT_LOGS,
} = vi.hoisted(() => ({
  cardMocks: {
    Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="card" {...props}>{children}</div>,
    CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="card-header" {...props}>{children}</div>,
    CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 data-testid="card-title" {...props}>{children}</h2>,
    CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p data-testid="card-description" {...props}>{children}</p>,
    CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="card-content" {...props}>{children}</div>,
  },
  tableMocks: {
    Table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => <table data-testid="table" {...props}>{children}</table>,
    TableHeader: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => <thead data-testid="table-header" {...props}>{children}</thead>,
    TableBody: ({ children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody data-testid="table-body" {...props}>{children}</tbody>,
    TableRow: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr data-testid="table-row" {...props}>{children}</tr>,
    TableHead: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...props}>{children}</th>,
    TableCell: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { colSpan?: number }) => <td {...props}>{children}</td>,
  },
  badgeMocks: {
    Badge: ({ children, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => (
      <span data-testid="badge" data-variant={variant} {...props}>{children}</span>
    ),
  },
  scrollAreaMocks: {
    ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="scroll-area" {...props}>{children}</div>,
  },
  iconMocks: {
    History: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="history-icon" {...props} />,
  },
  AUDIT_LOGS: [
    {
      id: 'log-1',
      created_at: '2024-01-15T10:20:30.000Z',
      user_email: 'alice@example.com',
      user_id: 'user-1',
      action: 'READ',
      table_name: 'profiles',
      record_id: 'abcdefgh12345678',
    },
    {
      id: 'log-2',
      created_at: '2024-02-20T08:09:10.000Z',
      user_email: null,
      user_id: 'user-2',
      action: 'UPDATE',
      table_name: 'consents',
      record_id: null,
    },
    {
      id: 'log-3',
      created_at: '2024-03-05T16:17:18.000Z',
      user_email: null,
      user_id: null,
      action: 'DELETE',
      table_name: 'requests',
      record_id: 'zxywvu9876543210',
    },
  ],
}));

vi.mock('@/components/ui/card', () => cardMocks);
vi.mock('@/components/ui/table', () => tableMocks);
vi.mock('@/components/ui/badge', () => badgeMocks);
vi.mock('@/components/ui/scroll-area', () => scrollAreaMocks);
vi.mock('lucide-react', () => iconMocks);

describe('RgpdAuditTab', () => {
  it('affiche le titre, la description, les en-têtes et les logs formatés', () => {
    render(<RgpdAuditTab auditLogs={AUDIT_LOGS} />);

    expect(screen.getByText("Journal d'audit")).toBeInTheDocument();
    expect(
      screen.getByText('Historique des accès et modifications sur les données RGPD')
    ).toBeInTheDocument();

    expect(screen.getByTestId('history-icon')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Utilisateur')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();

    for (const log of AUDIT_LOGS) {
      expect(screen.getByText(format(parseISO(log.created_at), 'dd/MM/yyyy HH:mm:ss'))).toBeInTheDocument();
    }

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('user-2')).toBeInTheDocument();

    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(3);
    expect(screen.getByText('READ')).toBeInTheDocument();
    expect(screen.getByText('UPDATE')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();
    expect(badges[0]).toHaveAttribute('data-variant', 'outline');

    expect(screen.getByText('profiles')).toBeInTheDocument();
    expect(screen.getByText('consents')).toBeInTheDocument();
    expect(screen.getByText('requests')).toBeInTheDocument();

    expect(screen.getByText('abcdefgh')).toBeInTheDocument();
    expect(screen.getAllByText('-')).toHaveLength(2);
    expect(screen.getByText('zxywvu98')).toBeInTheDocument();
  });

  it("affiche l'état vide quand auditLogs est undefined", () => {
    render(<RgpdAuditTab auditLogs={undefined} />);

    expect(screen.getByText("Aucun log d'audit")).toBeInTheDocument();

    const body = screen.getByTestId('table-body');
    const rows = within(body).getAllByTestId('table-row');
    expect(rows).toHaveLength(1);
  });

  it("affiche l'état vide quand auditLogs est un tableau vide", () => {
    render(<RgpdAuditTab auditLogs={[]} />);

    expect(screen.getByText("Aucun log d'audit")).toBeInTheDocument();
    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
  });

  it('utilise user_id ou "-" selon les données disponibles', () => {
    render(<RgpdAuditTab auditLogs={AUDIT_LOGS} />);

    const table = screen.getByRole('table');
    expect(within(table).getByText('user-2')).toBeInTheDocument();

    const dashes = within(table).getAllByText('-');
    expect(dashes).toHaveLength(2);
  });
});