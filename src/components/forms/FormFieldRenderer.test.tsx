// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormFieldRenderer } from './FormFieldRenderer';

type FormFieldLike = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: unknown;
};

const {
  inputMock,
  textareaMock,
  labelMock,
  radioGroupMock,
  radioGroupItemMock,
  checkboxMock,
  selectRootMock,
  selectTriggerMock,
  selectValueMock,
  selectContentMock,
  selectItemMock,
  starMock,
} = vi.hoisted(() => ({
  inputMock: vi.fn(),
  textareaMock: vi.fn(),
  labelMock: vi.fn(),
  radioGroupMock: vi.fn(),
  radioGroupItemMock: vi.fn(),
  checkboxMock: vi.fn(),
  selectRootMock: vi.fn(),
  selectTriggerMock: vi.fn(),
  selectValueMock: vi.fn(),
  selectContentMock: vi.fn(),
  selectItemMock: vi.fn(),
  starMock: vi.fn(),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
    inputMock(props);
    return <input data-testid="input" {...props} />;
  },
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
    textareaMock(props);
    return <textarea data-testid="textarea" {...props} />;
  },
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => {
    labelMock(props);
    return <label {...props}>{children}</label>;
  },
}));

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    radioGroupMock({ value, onValueChange, disabled });
    return (
      <div
        data-testid="radio-group"
        data-value={value ?? ''}
        data-disabled={disabled ? 'true' : 'false'}
      >
        {children}
      </div>
    );
  },
  RadioGroupItem: ({
    value,
    id,
  }: {
    value: string;
    id?: string;
  }) => {
    radioGroupItemMock({ value, id });
    return (
      <button
        type="button"
        data-testid={`radio-item-${value}`}
        data-radio-id={id}
        onClick={() => {
          const last = radioGroupMock.mock.calls.at(-1)?.[0] as
            | { onValueChange?: (next: string) => void }
            | undefined;
          last?.onValueChange?.(value);
        }}
      >
        {value}
      </button>
    );
  },
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    disabled,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => {
    checkboxMock({ id, checked, disabled, onCheckedChange });
    return (
      <button
        type="button"
        data-testid={id}
        aria-pressed={checked ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
      >
        checkbox
      </button>
    );
  },
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    selectRootMock({ value, onValueChange, disabled });
    return (
      <div
        data-testid="select-root"
        data-value={value ?? ''}
        data-disabled={disabled ? 'true' : 'false'}
      >
        {children}
      </div>
    );
  },
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => {
    selectTriggerMock({});
    return <div data-testid="select-trigger">{children}</div>;
  },
  SelectValue: ({ placeholder }: { placeholder?: string }) => {
    selectValueMock({ placeholder });
    return <div data-testid="select-value">{placeholder}</div>;
  },
  SelectContent: ({ children }: { children?: React.ReactNode }) => {
    selectContentMock({});
    return <div data-testid="select-content">{children}</div>;
  },
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => {
    selectItemMock({ value });
    return (
      <button
        type="button"
        data-testid={`select-item-${value}`}
        onClick={() => {
          const last = selectRootMock.mock.calls.at(-1)?.[0] as
            | { onValueChange?: (next: string) => void }
            | undefined;
          last?.onValueChange?.(value);
        }}
      >
        {children}
      </button>
    );
  },
}));

vi.mock('lucide-react', () => ({
  Star: (props: React.SVGProps<SVGSVGElement>) => {
    starMock(props);
    return <svg data-testid="star-icon" {...props} />;
  },
}));

describe('FormFieldRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('render heading and paragraph field types', () => {
    const headingField: FormFieldLike = {
      id: 'f1',
      type: 'heading',
      label: 'Section principale',
    };

    const paragraphField: FormFieldLike = {
      id: 'f2',
      type: 'paragraph',
      label: 'Merci de compléter le formulaire',
    };

    const { rerender } = render(
      <FormFieldRenderer
        field={headingField}
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Section principale' }),
    ).toBeInTheDocument();

    rerender(
      <FormFieldRenderer
        field={paragraphField}
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Merci de compléter le formulaire'),
    ).toBeInTheDocument();
  });

  it('render text/email/phone inputs with business props and propagates changes', () => {
    const onChange = vi.fn();
    const field: FormFieldLike = {
      id: 'txt-1',
      type: 'email',
      label: 'Courriel',
      required: true,
      description: 'Adresse utilisée pour le suivi',
      placeholder: 'nom@site.fr',
    };

    render(
      <FormFieldRenderer
        field={field}
        value="old@site.fr"
        onChange={onChange}
        disabled
      />,
    );

    expect(screen.getByText('Courriel')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Adresse utilisée pour le suivi')).toBeInTheDocument();

    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', 'nom@site.fr');
    expect(input).toHaveValue('old@site.fr');
    expect(input).toBeDisabled();
    expect(input).toBeRequired();

    fireEvent.change(input, { target: { value: 'new@site.fr' } });
    expect(onChange).toHaveBeenCalledWith('new@site.fr');
  });

  it('render number input', () => {
    const field: FormFieldLike = {
      id: 'num-1',
      type: 'number',
      label: 'Âge',
      placeholder: '18',
      required: true,
    };

    render(
      <FormFieldRenderer
        field={field}
        value="27"
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveValue(27);
    expect(input).toBeRequired();
  });

  it('render textarea with rows and propagates value changes', () => {
    const onChange = vi.fn();
    const field: FormFieldLike = {
      id: 'ta-1',
      type: 'textarea',
      label: 'Commentaire',
      placeholder: 'Votre message',
    };

    render(
      <FormFieldRenderer
        field={field}
        value="Bonjour"
        onChange={onChange}
      />,
    );

    const textarea = screen.getByTestId('textarea');
    expect(textarea).toHaveAttribute('placeholder', 'Votre message');
    expect(textarea).toHaveValue('Bonjour');
    expect(textarea).toHaveAttribute('rows', '4');

    fireEvent.change(textarea, { target: { value: 'Bonsoir' } });
    expect(onChange).toHaveBeenCalledWith('Bonsoir');
  });

  it('render date input', () => {
    const field: FormFieldLike = {
      id: 'date-1',
      type: 'date',
      label: 'Date de naissance',
      required: true,
    };

    render(
      <FormFieldRenderer
        field={field}
        value="2024-02-10"
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2024-02-10');
    expect(input).toBeRequired();
  });

  it('render select with options array and uses placeholder fallback/custom placeholder', () => {
    const onChange = vi.fn();
    const field: FormFieldLike = {
      id: 'sel-1',
      type: 'select',
      label: 'Pays',
      placeholder: 'Choisir un pays',
      options: ['France', 'Belgique', 'Suisse'],
    };

    render(
      <FormFieldRenderer
        field={field}
        value=""
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId('select-root')).toHaveAttribute('data-value', '');
    expect(screen.getByTestId('select-value')).toHaveTextContent('Choisir un pays');
    expect(screen.getByTestId('select-item-France')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-Belgique')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-Suisse')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('select-item-Belgique'));
    expect(onChange).toHaveBeenCalledWith('Belgique');
  });

  it('render radio group options and propagates selected option', () => {
    const onChange = vi.fn();
    const field: FormFieldLike = {
      id: 'rad-1',
      type: 'radio',
      label: 'Taille',
      options: ['S', 'M', 'L'],
    };

    render(
      <FormFieldRenderer
        field={field}
        value="M"
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId('radio-group')).toHaveAttribute('data-value', 'M');
    expect(screen.getByTestId('radio-item-S')).toBeInTheDocument();
    expect(screen.getByTestId('radio-item-M')).toBeInTheDocument();
    expect(screen.getByTestId('radio-item-L')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('radio-item-L'));
    expect(onChange).toHaveBeenCalledWith('L');
  });

  it('render checkbox group from comma-separated value and adds/removes values correctly', () => {
    const onChange = vi.fn();
    const field: FormFieldLike = {
      id: 'chk-1',
      type: 'checkbox',
      label: 'Services',
      options: ['Audit', 'Conseil', 'Support'],
    };

    const { rerender } = render(
      <FormFieldRenderer
        field={field}
        value="Audit,Support"
        onChange={onChange}
      />,
    );

    expect(screen.getByTestId('chk-1-0')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('chk-1-1')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('chk-1-2')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('chk-1-1'));
    expect(onChange).toHaveBeenCalledWith('Audit,Support,Conseil');

    rerender(
      <FormFieldRenderer
        field={field}
        value="Audit,Support"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId('chk-1-0'));
    expect(onChange).toHaveBeenCalledWith('Support');
  });

  it('render rating stars, marks current rating, and updates on click', () => {
    const onChange = vi.fn();
    const field: FormFieldLike = {
      id: 'rate-1',
      type: 'rating',
      label: 'Satisfaction',
      required: true,
    };

    render(
      <FormFieldRenderer
        field={field}
        value="3"
        onChange={onChange}
      />,
    );

    const buttons = [
      screen.getByRole('button', { name: 'Note 1 sur 5' }),
      screen.getByRole('button', { name: 'Note 2 sur 5' }),
      screen.getByRole('button', { name: 'Note 3 sur 5' }),
      screen.getByRole('button', { name: 'Note 4 sur 5' }),
      screen.getByRole('button', { name: 'Note 5 sur 5' }),
    ];

    expect(buttons[2]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[1]).toHaveAttribute('title', '2/5');
    expect(buttons[4]).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(buttons[4]);
    expect(onChange).toHaveBeenCalledWith('5');

    expect(starMock).toHaveBeenCalledTimes(5);
    const classes = starMock.mock.calls.map((call) => (call[0] as { className?: string }).className ?? '');
    expect(classes[0]).toContain('fill-yellow-400');
    expect(classes[1]).toContain('fill-yellow-400');
    expect(classes[2]).toContain('fill-yellow-400');
    expect(classes[3]).toContain('text-muted-foreground/30');
    expect(classes[4]).toContain('text-muted-foreground/30');
  });

  it('fallback to default input for unknown field type', () => {
    const onChange = vi.fn();
    const field: FormFieldLike = {
      id: 'unk-1',
      type: 'custom-unknown',
      label: 'Champ libre',
      placeholder: 'Entrer une valeur',
    };

    render(
      <FormFieldRenderer
        field={field}
        value="abc"
        onChange={onChange}
      />,
    );

    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('placeholder', 'Entrer une valeur');
    expect(input).toHaveValue('abc');

    fireEvent.change(input, { target: { value: 'xyz' } });
    expect(onChange).toHaveBeenCalledWith('xyz');
  });

  it('ignores non-array options for select/radio/checkbox', () => {
    const selectField: FormFieldLike = {
      id: 'sel-2',
      type: 'select',
      label: 'Ville',
      options: { invalid: true },
    };

    const radioField: FormFieldLike = {
      id: 'rad-2',
      type: 'radio',
      label: 'Canal',
      options: 'email',
    };

    const checkboxField: FormFieldLike = {
      id: 'chk-2',
      type: 'checkbox',
      label: 'Préférences',
      options: null,
    };

    const { rerender } = render(
      <FormFieldRenderer
        field={selectField}
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(/^select-item-/)).not.toBeInTheDocument();

    rerender(
      <FormFieldRenderer
        field={radioField}
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(/^radio-item-/)).not.toBeInTheDocument();

    rerender(
      <FormFieldRenderer
        field={checkboxField}
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(/^chk-2-/)).not.toBeInTheDocument();
  });
});