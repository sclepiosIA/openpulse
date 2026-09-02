import '@testing-library/jest-dom/vitest';
import type { ChangeEvent, ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_PAGE_SETUP, PageSetupDialog, pageSetupToStyle, type PageSetup } from './PageSetupDialog';

vi.mock('@/components/ui/dialog', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  type DialogProps = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: ReactNode;
  };

  const Dialog = ({ open = true, children }: DialogProps) =>
    open ? React.createElement('div', { role: 'dialog', 'aria-modal': 'true' }, children) : null;

  const DialogContent = React.forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
    ({ children, ...props }, ref) => React.createElement('div', { ...props, ref }, children),
  );

  const DialogHeader = ({ children, ...props }: ComponentPropsWithoutRef<'div'>) =>
    React.createElement('div', props, children);

  const DialogFooter = ({ children, ...props }: ComponentPropsWithoutRef<'div'>) =>
    React.createElement('div', props, children);

  const DialogTitle = React.forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<'h2'>>(
    ({ children, ...props }, ref) => React.createElement('h2', { ...props, ref }, children),
  );

  const DialogDescription = React.forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<'p'>>(
    ({ children, ...props }, ref) => React.createElement('p', { ...props, ref }, children),
  );

  const DialogPortal = ({ children }: { children?: ReactNode }) => React.createElement(React.Fragment, null, children);
  const DialogOverlay = React.forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>((props, ref) =>
    React.createElement('div', { ...props, ref }),
  );
  const DialogTrigger = React.forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
    ({ children, ...props }, ref) => React.createElement('button', { ...props, ref }, children),
  );
  const DialogClose = DialogTrigger;

  return {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
  };
});

vi.mock('@/components/ui/button', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  type ButtonProps = ComponentPropsWithoutRef<'button'> & {
    variant?: string;
    asChild?: boolean;
  };

  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
    const { children, variant, asChild, ...buttonProps } = props;
    void variant;
    void asChild;

    return React.createElement('button', { ...buttonProps, ref }, children);
  });

  return {
    Button,
    buttonVariants: () => '',
  };
});

vi.mock('@/components/ui/label', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  const Label = React.forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<'label'>>(
    ({ children, ...props }, ref) => React.createElement('label', { ...props, ref }, children),
  );

  return { Label };
});

vi.mock('@/components/ui/input', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  const Input = React.forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>((props, ref) =>
    React.createElement('input', { ...props, ref }),
  );

  return { Input };
});

vi.mock('@/components/ui/select', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  type SelectProps = {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: ReactNode;
  };

  type SelectItemProps = {
    value: string;
    children?: ReactNode;
  };

  const Select = ({ value, onValueChange, children }: SelectProps) => {
    const ariaLabel = value === 'portrait' || value === 'landscape' ? 'Orientation' : 'Format';

    return React.createElement(
      'select',
      {
        'aria-label': ariaLabel,
        value,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => onValueChange?.(event.currentTarget.value),
      },
      children,
    );
  };

  const FragmentWrapper = ({ children }: { children?: ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  const SelectTrigger = () => null;
  const SelectValue = () => null;
  const SelectContent = FragmentWrapper;
  const SelectGroup = FragmentWrapper;
  const SelectLabel = FragmentWrapper;
  const SelectScrollUpButton = () => null;
  const SelectScrollDownButton = () => null;
  const SelectSeparator = () => null;

  const SelectItem = ({ value, children }: SelectItemProps) => React.createElement('option', { value }, children);

  return {
    Select,
    SelectGroup,
    SelectValue,
    SelectTrigger,
    SelectScrollUpButton,
    SelectScrollDownButton,
    SelectContent,
    SelectLabel,
    SelectItem,
    SelectSeparator,
  };
});

type PageSetupDialogProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  value: PageSetup;
  onChange: (setup: PageSetup) => void;
};

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function renderDialog(overrides: Partial<PageSetupDialogProps> = {}) {
  const props: PageSetupDialogProps = {
    open: true,
    onOpenChange: vi.fn<(value: boolean) => void>(),
    value: DEFAULT_PAGE_SETUP,
    onChange: vi.fn<(setup: PageSetup) => void>(),
    ...overrides,
  };

  return {
    ...renderWithProviders(<PageSetupDialog {...props} />),
    props,
  };
}

function numericCssValue(value: string | number | undefined) {
  if (typeof value !== 'string') {
    throw new Error('Expected a CSS string value');
  }

  return Number(value.replace('px', ''));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('pageSetupToStyle', () => {
  it('converts the default A4 portrait setup to CSS dimensions and millimeter padding', () => {
    const style = pageSetupToStyle(DEFAULT_PAGE_SETUP);

    expect(DEFAULT_PAGE_SETUP).toEqual({
      format: 'A4',
      orientation: 'portrait',
      marginTop: 20,
      marginRight: 20,
      marginBottom: 20,
      marginLeft: 20,
    });
    expect(numericCssValue(style.width)).toBeCloseTo(793.8, 6);
    expect(numericCssValue(style.minHeight)).toBeCloseTo(1122.66, 6);
    expect(style.padding).toBe('20mm 20mm 20mm 20mm');
  });

  it('swaps width and height for landscape orientation and preserves individual margins', () => {
    const style = pageSetupToStyle({
      format: 'A3',
      orientation: 'landscape',
      marginTop: 5,
      marginRight: 10,
      marginBottom: 15,
      marginLeft: 25,
    });

    expect(numericCssValue(style.width)).toBeCloseTo(1587.6, 6);
    expect(numericCssValue(style.minHeight)).toBeCloseTo(1122.66, 6);
    expect(style.padding).toBe('5mm 10mm 15mm 25mm');
  });

  it('uses the expected Legal page dimensions in portrait mode', () => {
    const style = pageSetupToStyle({
      format: 'Legal',
      orientation: 'portrait',
      marginTop: 0,
      marginRight: 1,
      marginBottom: 2,
      marginLeft: 3,
    });

    expect(numericCssValue(style.width)).toBeCloseTo(816.48, 6);
    expect(numericCssValue(style.minHeight)).toBeCloseTo(1345.68, 6);
    expect(style.padding).toBe('0mm 1mm 2mm 3mm');
  });
});

describe('PageSetupDialog', () => {
  it('renders the open dialog with the current setup values', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mise en page' })).toBeInTheDocument();
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Orientation')).toBeInTheDocument();
    expect(screen.getByText('Marges (mm)')).toBeInTheDocument();

    expect(screen.getByRole('combobox', { name: 'Format' })).toHaveValue('A4');
    expect(screen.getByRole('combobox', { name: 'Orientation' })).toHaveValue('portrait');

    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
    expect(screen.getByText('Bottom')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();

    const marginInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(marginInputs).toHaveLength(4);
    expect(marginInputs.map((input) => input.value)).toEqual(['20', '20', '20', '20']);
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Appliquer' })).toBeInTheDocument();
  });

  it('does not render dialog content when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mise en page' })).not.toBeInTheDocument();
  });

  it('applies edited values and closes the dialog', () => {
    const onChange = vi.fn<(setup: PageSetup) => void>();
    const onOpenChange = vi.fn<(value: boolean) => void>();

    renderDialog({
      onChange,
      onOpenChange,
      value: {
        format: 'Letter',
        orientation: 'portrait',
        marginTop: 30,
        marginRight: 35,
        marginBottom: 40,
        marginLeft: 45,
      },
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Format' }), { target: { value: 'Legal' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Orientation' }), { target: { value: 'landscape' } });

    const marginInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    const [topInput, rightInput, bottomInput, leftInput] = marginInputs;

    if (topInput === undefined || rightInput === undefined || bottomInput === undefined || leftInput === undefined) {
      throw new Error('Expected four margin inputs');
    }

    fireEvent.change(topInput, { target: { value: '5' } });
    fireEvent.change(rightInput, { target: { value: '10' } });
    fireEvent.change(bottomInput, { target: { value: '15' } });
    fireEvent.change(leftInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      format: 'Legal',
      orientation: 'landscape',
      marginTop: 5,
      marginRight: 10,
      marginBottom: 15,
      marginLeft: 0,
    });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes without applying changes when cancelling', () => {
    const onChange = vi.fn<(setup: PageSetup) => void>();
    const onOpenChange = vi.fn<(value: boolean) => void>();

    renderDialog({ onChange, onOpenChange });

    fireEvent.change(screen.getByRole('combobox', { name: 'Format' }), { target: { value: 'A3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});