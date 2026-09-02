/* @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChartInsertDialog, renderChartSvg, type ChartSpec } from './ChartInsertDialog';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    className,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
  }) => <input value={value} onChange={onChange} className={className} />,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) => {
    const items: Array<{ value: string; label: string }> = [];
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const childProps = child.props as { children?: React.ReactNode };
      React.Children.forEach(childProps.children, (nested) => {
        if (!React.isValidElement(nested)) return;
        const nestedProps = nested.props as { value?: string; children?: React.ReactNode };
        if (typeof nestedProps.value === 'string') {
          const label = typeof nestedProps.children === 'string' ? nestedProps.children : nestedProps.value;
          items.push({ value: nestedProps.value, label });
        }
      });
    });
    return (
      <select aria-label={`select-${value}`} value={value} onChange={(e) => onValueChange?.(e.target.value)}>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

describe('renderChartSvg', () => {
  it('rend un message quand aucune donnée numérique valide n’est disponible', () => {
    const spec: ChartSpec = {
      kind: 'bar',
      title: 'Vide',
      range: 'A1:B3',
      labelsFrom: 'firstCol',
      data: [{ label: 'A', value: Number.NaN }],
    };

    const svg = renderChartSvg(spec);

    expect(svg).toContain('Aucune donnée');
    expect(svg).toContain('width="640"');
    expect(svg).toContain('height="360"');
  });

  it('rend un graphique barres avec le titre et les labels', () => {
    const spec: ChartSpec = {
      kind: 'bar',
      title: 'Ventes',
      range: 'A1:B3',
      labelsFrom: 'firstCol',
      data: [
        { label: 'Jan', value: 10 },
        { label: 'Fév', value: 20 },
      ],
    };

    const svg = renderChartSvg(spec);

    expect(svg).toContain('>Ventes<');
    expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(svg).toContain('>Jan<');
    expect(svg).toContain('>Fév<');
    expect(svg).toContain('#3b82f6');
  });

  it('rend un graphique ligne avec polyline et points', () => {
    const spec: ChartSpec = {
      kind: 'line',
      title: 'Tendance',
      range: 'A1:B4',
      labelsFrom: 'firstCol',
      data: [
        { label: 'L1', value: 1 },
        { label: 'L2', value: 3 },
        { label: 'L3', value: 2 },
      ],
    };

    const svg = renderChartSvg(spec);

    expect(svg).toContain('<polyline');
    expect((svg.match(/<circle /g) ?? []).length).toBe(3);
    expect(svg).toContain('>Tendance<');
  });

  it('rend un graphique camembert avec légende', () => {
    const spec: ChartSpec = {
      kind: 'pie',
      title: 'Répartition',
      range: 'A1:B3',
      labelsFrom: 'firstCol',
      data: [
        { label: 'Oui', value: 4 },
        { label: 'Non', value: 6 },
      ],
    };

    const svg = renderChartSvg(spec);

    expect((svg.match(/<path /g) ?? []).length).toBe(2);
    expect(svg).toContain('>Oui (4)<');
    expect(svg).toContain('>Non (6)<');
  });
});

describe('ChartInsertDialog', () => {
  it('affiche le dialogue et un aperçu SVG initial basé sur la première colonne', () => {
    const getCellValue = vi.fn((key: string) => {
      const cells: Record<string, string> = {
        A1: 'Pommes',
        B1: '12',
        A2: 'Poires',
        B2: '7',
        A3: 'Cerises',
        B3: '15',
        A4: '',
        B4: '',
        A5: '',
        B5: '',
        A6: '',
        B6: '',
      };
      return cells[key] ?? '';
    });
    const onInsert = vi.fn();
    const onOpenChange = vi.fn();

    const { container } = render(
      <ChartInsertDialog open={true} onOpenChange={onOpenChange} getCellValue={getCellValue} onInsert={onInsert} />
    );

    expect(screen.getByText('Insérer un graphique')).toBeInTheDocument();
    expect(screen.getByText('Plage (A1:B10)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Graphique')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A1:B6')).toBeInTheDocument();

    const preview = container.querySelector('[dangerouslysetinnerhtml], .w-full.h-full');
    expect(preview?.innerHTML).toContain('<svg');
    expect(preview?.innerHTML).toContain('Pommes');
    expect(preview?.innerHTML).toContain('Poires');
    expect(screen.getByRole('button', { name: 'Insérer' })).not.toBeDisabled();
  });

  it('met la plage en majuscules et insère un graphique ligne avec les bonnes données', () => {
    const getCellValue = vi.fn((key: string) => {
      const cells: Record<string, string> = {
        A1: 'Jour 1',
        B1: '4',
        A2: 'Jour 2',
        B2: '9',
        A3: 'Jour 3',
        B3: '6',
      };
      return cells[key] ?? '';
    });
    const onInsert = vi.fn();
    const onOpenChange = vi.fn();

    render(<ChartInsertDialog open={true} onOpenChange={onOpenChange} getCellValue={getCellValue} onInsert={onInsert} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Courbe hebdo' } });
    fireEvent.change(inputs[1], { target: { value: 'a1:b3' } });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'line' } });

    fireEvent.click(screen.getByRole('button', { name: 'Insérer' }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    const [spec, svg] = onInsert.mock.calls[0] as [ChartSpec, string];

    expect(spec.kind).toBe('line');
    expect(spec.title).toBe('Courbe hebdo');
    expect(spec.range).toBe('A1:B3');
    expect(spec.labelsFrom).toBe('firstCol');
    expect(spec.data).toEqual([
      { label: 'Jour 1', value: 4 },
      { label: 'Jour 2', value: 9 },
      { label: 'Jour 3', value: 6 },
    ]);
    expect(svg).toContain('<polyline');
    expect(svg).toContain('>Courbe hebdo<');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('utilise les étiquettes de la première ligne pour un camembert', () => {
    const getCellValue = vi.fn((key: string) => {
      const cells: Record<string, string> = {
        A1: 'Q1',
        B1: 'Q2',
        C1: 'Q3',
        A2: '10',
        B2: '20',
        C2: '30',
      };
      return cells[key] ?? '';
    });
    const onInsert = vi.fn();
    const onOpenChange = vi.fn();

    const { container } = render(
      <ChartInsertDialog open={true} onOpenChange={onOpenChange} getCellValue={getCellValue} onInsert={onInsert} />
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'A1:C2' } });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'pie' } });
    fireEvent.change(selects[1], { target: { value: 'firstRow' } });

    const preview = container.querySelector('.w-full.h-full');
    expect(preview?.innerHTML).toContain('Q1 (10)');
    expect(preview?.innerHTML).toContain('Q2 (20)');
    expect(preview?.innerHTML).toContain('Q3 (30)');

    fireEvent.click(screen.getByRole('button', { name: 'Insérer' }));

    const [spec, svg] = onInsert.mock.calls[0] as [ChartSpec, string];
    expect(spec.data).toEqual([
      { label: 'Q1', value: 10 },
      { label: 'Q2', value: 20 },
      { label: 'Q3', value: 30 },
    ]);
    expect(svg).toContain('<path');
  });

  it('désactive le bouton Insérer si la plage est invalide ou sans données', () => {
    const getCellValue = vi.fn(() => '');
    const onInsert = vi.fn();
    const onOpenChange = vi.fn();

    render(<ChartInsertDialog open={true} onOpenChange={onOpenChange} getCellValue={getCellValue} onInsert={onInsert} />);

    const insertButton = screen.getByRole('button', { name: 'Insérer' });
    expect(insertButton).toBeDisabled();

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'ZZ' } });

    expect(insertButton).toBeDisabled();
    fireEvent.click(insertButton);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('ferme le dialogue au clic sur Annuler', () => {
    const getCellValue = vi.fn(() => '');
    const onInsert = vi.fn();
    const onOpenChange = vi.fn();

    render(<ChartInsertDialog open={true} onOpenChange={onOpenChange} getCellValue={getCellValue} onInsert={onInsert} />);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('ne rend rien quand open=false', () => {
    render(
      <ChartInsertDialog
        open={false}
        onOpenChange={vi.fn()}
        getCellValue={vi.fn(() => '')}
        onInsert={vi.fn()}
      />
    );

    expect(screen.queryByText('Insérer un graphique')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
  });

  it('ignore les cellules non numériques et garde la première valeur valide par ligne', () => {
    const getCellValue = vi.fn((key: string) => {
      const cells: Record<string, string> = {
        A1: 'Alpha',
        B1: 'x',
        C1: '11',
        A2: 'Beta',
        B2: '5',
        C2: '99',
      };
      return cells[key] ?? '';
    });
    const onInsert = vi.fn();

    render(
      <ChartInsertDialog
        open={true}
        onOpenChange={vi.fn()}
        getCellValue={getCellValue}
        onInsert={onInsert}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'A1:C2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insérer' }));

    const [spec] = onInsert.mock.calls[0] as [ChartSpec, string];
    expect(spec.data).toEqual([
      { label: 'Alpha', value: 11 },
      { label: 'Beta', value: 5 },
    ]);
  });
});