// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommercialFilterPopover } from './CommercialFilterPopover';

const { checkboxCalls } = vi.hoisted(() => ({
  checkboxCalls: [] as Array<{ checked: boolean; onCheckedChange: () => void; label?: string }>,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
  }) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked ? 'true' : 'false'}
      onClick={onCheckedChange}
    >
      checkbox
    </button>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('lucide-react', () => ({
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="users-icon" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="x-icon" {...props} />,
}));

describe('CommercialFilterPopover', () => {
  it('affiche le libellé, le compteur de sélection et les options cochées', () => {
    const onChange = vi.fn();

    render(
      <CommercialFilterPopover
        options={[
          { id: 'c1', label: 'Alice Martin' },
          { id: 'c2', label: 'Bob Durand' },
        ]}
        selected={['c1']}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Commerciaux')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('1');
    expect(screen.getByText('Filtrer')).toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Bob Durand')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toHaveAttribute('aria-checked', 'true');
    expect(checkboxes[1]).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: /effacer/i })).toBeInTheDocument();
  });

  it('ajoute un commercial non sélectionné lors du toggle', () => {
    const onChange = vi.fn();

    render(
      <CommercialFilterPopover
        options={[
          { id: 'c1', label: 'Alice Martin' },
          { id: 'c2', label: 'Bob Durand' },
        ]}
        selected={['c1']}
        onChange={onChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['c1', 'c2']);
  });

  it('retire un commercial déjà sélectionné lors du toggle', () => {
    const onChange = vi.fn();

    render(
      <CommercialFilterPopover
        options={[
          { id: 'c1', label: 'Alice Martin' },
          { id: 'c2', label: 'Bob Durand' },
        ]}
        selected={['c1', 'c2']}
        onChange={onChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['c2']);
  });

  it('efface toutes les sélections via le bouton Effacer', () => {
    const onChange = vi.fn();

    render(
      <CommercialFilterPopover
        options={[
          { id: 'c1', label: 'Alice Martin' },
          { id: 'c2', label: 'Bob Durand' },
        ]}
        selected={['c1']}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /effacer/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('n’affiche pas le badge ni le bouton Effacer quand aucune sélection n’est active', () => {
    const onChange = vi.fn();

    render(
      <CommercialFilterPopover
        options={[{ id: 'c1', label: 'Alice Martin' }]}
        selected={[]}
        onChange={onChange}
      />
    );

    expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /effacer/i })).not.toBeInTheDocument();
  });

  it('affiche le message vide quand aucun commercial n’est disponible', () => {
    const onChange = vi.fn();

    render(
      <CommercialFilterPopover
        options={[]}
        selected={[]}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Aucun commercial')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});