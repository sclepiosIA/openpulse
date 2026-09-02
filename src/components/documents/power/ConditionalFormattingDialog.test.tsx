import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionalFormattingDialog, evaluateCfRule, type CfRule } from './ConditionalFormattingDialog';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children?: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
    <input ref={ref} {...props} />
  )),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <div data-select-value={value}>
      <select aria-label="Opérateur" value={value} onChange={(e) => onValueChange(e.target.value)}>
        <option value="gt">&gt;</option>
        <option value="lt">&lt;</option>
        <option value="eq">=</option>
        <option value="between">entre</option>
        <option value="contains">contient</option>
      </select>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
  SelectTrigger: ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  SelectValue: () => <span />,
}));

vi.mock('lucide-react', () => ({
  Trash2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="trash-icon" {...props} />,
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="plus-icon" {...props} />,
}));

describe('evaluateCfRule', () => {
  const baseRule: CfRule = {
    id: 'r1',
    range: 'A1:B3',
    op: 'gt',
    a: '10',
    bgColor: '#fef3c7',
  };

  it('retourne false si la cellule est hors plage ou mal formée', () => {
    expect(evaluateCfRule(baseRule, 'C1', '20')).toBe(false);
    expect(evaluateCfRule(baseRule, 'A4', '20')).toBe(false);
    expect(evaluateCfRule(baseRule, 'bad', '20')).toBe(false);
    expect(evaluateCfRule({ ...baseRule, range: 'invalid' }, 'A1', '20')).toBe(false);
  });

  it('évalue correctement gt, lt et eq', () => {
    expect(evaluateCfRule({ ...baseRule, op: 'gt', a: '10' }, 'A1', '11')).toBe(true);
    expect(evaluateCfRule({ ...baseRule, op: 'gt', a: '10' }, 'A1', '10')).toBe(false);

    expect(evaluateCfRule({ ...baseRule, op: 'lt', a: '10' }, 'B2', '9')).toBe(true);
    expect(evaluateCfRule({ ...baseRule, op: 'lt', a: '10' }, 'B2', '10')).toBe(false);

    expect(evaluateCfRule({ ...baseRule, op: 'eq', a: '10' }, 'A2', '10')).toBe(true);
    expect(evaluateCfRule({ ...baseRule, op: 'eq', a: 'hello' }, 'A2', 'hello')).toBe(true);
    expect(evaluateCfRule({ ...baseRule, op: 'eq', a: 'hello' }, 'A2', 'Hello')).toBe(false);
  });

  it('évalue correctement between et contains, y compris colonnes multi-lettres', () => {
    const betweenRule: CfRule = {
      id: 'r2',
      range: 'Z10:AA12',
      op: 'between',
      a: '5',
      b: '8',
      bgColor: '#fef3c7',
    };
    expect(evaluateCfRule(betweenRule, 'Z10', '5')).toBe(true);
    expect(evaluateCfRule(betweenRule, 'AA12', '8')).toBe(true);
    expect(evaluateCfRule(betweenRule, 'AA11', '4.9')).toBe(false);

    const containsRule: CfRule = {
      id: 'r3',
      range: 'A1:A10',
      op: 'contains',
      a: 'foo',
      bgColor: '#fef3c7',
    };
    expect(evaluateCfRule(containsRule, 'A3', 'xxFoObarxx')).toBe(true);
    expect(evaluateCfRule(containsRule, 'A3', 'bar')).toBe(false);
  });
});

describe('ConditionalFormattingDialog', () => {
  const initialRule: CfRule = {
    id: 'r1',
    range: 'A1:A10',
    op: 'gt',
    a: '0',
    bgColor: '#fef3c7',
  };

  it('affiche le message vide quand aucune règle n’est présente', () => {
    render(
      <ConditionalFormattingDialog
        open={true}
        onOpenChange={vi.fn()}
        rules={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Formatage conditionnel')).toBeInTheDocument();
    expect(screen.getByText(/Aucune règle/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajouter/i })).toBeInTheDocument();
  });

  it('permet d’ajouter une règle puis de sauvegarder les valeurs modifiées', () => {
    const onOpenChange = vi.fn();
    const onChange = vi.fn();
    const randomUUIDSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('new-rule-id');

    render(
      <ConditionalFormattingDialog
        open={true}
        onOpenChange={onOpenChange}
        rules={[initialRule]}
        onChange={onChange}
      />
    );

    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes[0]).toHaveValue('A1:A10');
    expect(textboxes[1]).toHaveValue('0');
    expect(textboxes[2]).toHaveValue('');

    fireEvent.change(textboxes[0], { target: { value: 'b2:b9' } });
    expect(textboxes[0]).toHaveValue('B2:B9');

    fireEvent.change(textboxes[1], { target: { value: '42' } });
    expect(textboxes[1]).toHaveValue('42');

    fireEvent.click(screen.getByRole('button', { name: /Ajouter/i }));

    const allTextboxesAfterAdd = screen.getAllByRole('textbox');
    expect(allTextboxesAfterAdd).toHaveLength(6);
    expect(screen.getAllByDisplayValue('A1:A10')).toHaveLength(1);
    expect(screen.getAllByDisplayValue('0')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      {
        id: 'r1',
        range: 'B2:B9',
        op: 'gt',
        a: '42',
        bgColor: '#fef3c7',
      },
      {
        id: 'new-rule-id',
        range: 'A1:A10',
        op: 'gt',
        a: '0',
        bgColor: '#fef3c7',
      },
    ]);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    randomUUIDSpy.mockRestore();
  });

  it('active le second champ uniquement pour "between", permet de supprimer puis annuler', () => {
    const onOpenChange = vi.fn();
    const onChange = vi.fn();

    render(
      <ConditionalFormattingDialog
        open={true}
        onOpenChange={onOpenChange}
        rules={[initialRule]}
        onChange={onChange}
      />
    );

    const textboxesBefore = screen.getAllByRole('textbox');
    expect(textboxesBefore[2]).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Opérateur'), { target: { value: 'between' } });

    const textboxesAfterSelect = screen.getAllByRole('textbox');
    expect(textboxesAfterSelect[2]).not.toBeDisabled();

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(screen.getByText(/Aucune règle/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});