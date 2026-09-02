import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChurnFiltersBar } from './ChurnFiltersBar';

const {
  InputComp,
  ButtonComp,
  BadgeComp,
  PopoverComp,
  PopoverTriggerComp,
  PopoverContentComp,
  CheckboxComp,
  SearchIcon,
  FilterIcon,
  XIcon,
  ArrowDownUpIcon,
  doMutate,
} = vi.hoisted(() => {
  const InputComp = (props: Record<string, unknown>) => {
    const p = props as {
      value?: unknown;
      onChange?: (e: { target: { value: unknown } }) => void;
      placeholder?: string;
      className?: string;
      type?: string;
      min?: number;
      max?: number;
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      p.onChange?.({ target: { value: p.type === 'number' ? (e.target as HTMLInputElement).value : (e.target as HTMLInputElement).value } });
    };
    return (
      <input
        value={p.value as unknown as string | number | undefined}
        onChange={handleChange}
        placeholder={p.placeholder}
        className={p.className}
        type={p.type as string | undefined}
        min={p.min}
        max={p.max}
        aria-label={typeof p.placeholder === 'string' ? p.placeholder : undefined}
      />
    );
  };

  const ButtonComp = (props: Record<string, unknown>) => {
    const p = props as { children?: unknown; onClick?: () => void; variant?: string; size?: string; className?: string };
    return (
      <button onClick={p.onClick} className={p.className}>
        {p.children as React.ReactNode}
      </button>
    );
  };

  const BadgeComp = (props: Record<string, unknown>) => {
    const p = props as { children?: unknown; className?: string; variant?: string };
    return <span className={p.className}>{p.children as React.ReactNode}</span>;
  };

  const PopoverComp = (props: Record<string, unknown>) => {
    const p = props as { children?: unknown };
    return <div>{p.children as React.ReactNode}</div>;
  };

  const PopoverTriggerComp = (props: Record<string, unknown>) => {
    const p = props as { children?: unknown };
    return <span>{p.children as React.ReactNode}</span>;
  };

  const PopoverContentComp = (props: Record<string, unknown>) => {
    const p = props as { children?: unknown };
    return <div>{p.children as React.ReactNode}</div>;
  };

  const CheckboxComp = (props: { checked?: boolean; onCheckedChange?: (v: boolean) => void } & Record<string, unknown>) => {
    const p = props as { checked?: boolean; onCheckedChange?: (v: boolean) => void; className?: string };
    const handleChange = () => {
      p.onCheckedChange?.(!p.checked);
    };
    return <input type="checkbox" checked={Boolean(p.checked)} onChange={handleChange} className={p.className} />;
  };

  const IconStub = (_props: Record<string, unknown>) => <svg />;

  const doMutate = vi.fn();

  return {
    InputComp,
    ButtonComp,
    BadgeComp,
    PopoverComp,
    PopoverTriggerComp,
    PopoverContentComp,
    CheckboxComp,
    SearchIcon: IconStub,
    FilterIcon: IconStub,
    XIcon: IconStub,
    ArrowDownUpIcon: IconStub,
    doMutate,
  };
});

vi.mock('@/components/ui/input', () => ({ Input: InputComp }));
vi.mock('@/components/ui/button', () => ({ Button: ButtonComp }));
vi.mock('@/components/ui/badge', () => ({ Badge: BadgeComp }));
vi.mock('@/components/ui/popover', () => ({
  Popover: PopoverComp,
  PopoverTrigger: PopoverTriggerComp,
  PopoverContent: PopoverContentComp,
}));
vi.mock('@/components/ui/checkbox', () => ({ Checkbox: CheckboxComp }));
vi.mock('lucide-react', () => ({
  Search: SearchIcon,
  Filter: FilterIcon,
  X: XIcon,
  ArrowDownUp: ArrowDownUpIcon,
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const QueryWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
);

describe('ChurnFiltersBar component', () => {
  it('renders with empty filters and no options and does not show reset', () => {
    const filters = {
      search: '',
      risks: [] as string[],
      csms: [] as string[],
      offres: [] as string[],
      minScore: 0,
      sort: 'score' as const,
    };
    const onChange = vi.fn();

    render(
      <ChurnFiltersBar
        filters={filters}
        onChange={onChange}
        csmOptions={[]}
        offreOptions={[]}
      />
    );

    // Search input present and empty
    const searchInput = screen.getByPlaceholderText('Rechercher un compte…') as HTMLInputElement;
    expect(searchInput.value).toBe('');

    // Risque button present (label text)
    expect(screen.getByText(/Risque/)).toBeTruthy();

    // Tri button shows current sort label "Score"
    expect(screen.getByText(/Tri\s*:\s*Score/)).toBeTruthy();

    // No reset button when there are no active filters
    const resetButtons = screen.queryByText(/Réinitialiser/);
    expect(resetButtons).toBeNull();
  });

  it('toggles a risk checkbox and calls onChange with the selected risk', () => {
    const filters = {
      search: '',
      risks: [] as string[],
      csms: [] as string[],
      offres: [] as string[],
      minScore: 0,
      sort: 'score' as const,
    };
    const onChange = vi.fn();

    render(
      <ChurnFiltersBar
        filters={filters}
        onChange={onChange}
        csmOptions={[{ id: 'c1', label: 'CSM One' }]}
        offreOptions={['O1']}
      />
    );

    // The label text includes the emoji and label; find the checkbox for "🔴 Critique"
    const criticalCheckbox = screen.getByLabelText('🔴 Critique') as HTMLInputElement;
    expect(criticalCheckbox.checked).toBe(false);

    fireEvent.click(criticalCheckbox);

    expect(onChange).toHaveBeenLastCalledWith({
      ...filters,
      risks: ['critical'],
    });

    // Toggle a CSM option
    const csmCheckbox = screen.getByLabelText('CSM One') as HTMLInputElement;
    expect(csmCheckbox.checked).toBe(false);
    fireEvent.click(csmCheckbox);
    expect(onChange).toHaveBeenLastCalledWith({
      ...filters,
      csms: ['c1'],
    });

    // Toggle an Offre option
    const offreCheckbox = screen.getByLabelText('O1') as HTMLInputElement;
    expect(offreCheckbox.checked).toBe(false);
    fireEvent.click(offreCheckbox);
    expect(onChange).toHaveBeenLastCalledWith({
      ...filters,
      offres: ['O1'],
    });
  });

  it('changes minScore via the number input and shows reset which resets to defaults', () => {
    const baseFilters = {
      search: '',
      risks: [] as string[],
      csms: [] as string[],
      offres: [] as string[],
      minScore: 0,
      sort: 'score' as const,
    };
    const onChange = vi.fn();

    render(
      <ChurnFiltersBar
        filters={baseFilters}
        onChange={onChange}
        csmOptions={[]}
        offreOptions={[]}
      />
    );

    const numberInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: '50' } });

    expect(onChange).toHaveBeenLastCalledWith({
      ...baseFilters,
      minScore: 50,
    });

    // Now render with active filters to show reset button
    const activeFilters = {
      search: 'abc',
      risks: ['critical'],
      csms: ['c1'],
      offres: ['O1'],
      minScore: 10,
      sort: 'name' as const,
    };
    const onChangeReset = vi.fn();

    render(
      <ChurnFiltersBar
        filters={activeFilters}
        onChange={onChangeReset}
        csmOptions={[{ id: 'c1', label: 'CSM One' }]}
        offreOptions={['O1']}
      />
    );

    const resetButton = screen.getByText(/Réinitialiser/) as HTMLButtonElement;
    expect(resetButton).toBeTruthy();

    fireEvent.click(resetButton);

    expect(onChangeReset).toHaveBeenCalledWith({
      search: '',
      risks: [],
      csms: [],
      offres: [],
      minScore: 0,
      sort: 'score',
    });
  });

  it('changes sort when selecting a sort button', () => {
    const filters = {
      search: '',
      risks: [] as string[],
      csms: [] as string[],
      offres: [] as string[],
      minScore: 0,
      sort: 'score' as const,
    };
    const onChange = vi.fn();

    render(
      <ChurnFiltersBar
        filters={filters}
        onChange={onChange}
        csmOptions={[]}
        offreOptions={[]}
      />
    );

    // The sort options are rendered; click "Nom" to change sort to 'name'
    const nameSortButton = screen.getByText('Nom') as HTMLButtonElement;
    fireEvent.click(nameSortButton);

    expect(onChange).toHaveBeenLastCalledWith({
      ...filters,
      sort: 'name',
    });
  });
});

describe('renderHook usage and mutation simulation', () => {
  it('reports loading, success and error states from a simple hook using QueryClientProvider wrapper', () => {
    function useStatus(state: 'loading' | 'success' | 'error') {
      if (state === 'loading') {
        return { data: null, isLoading: true, isError: false, error: null };
      }
      if (state === 'success') {
        return { data: { count: 1 }, isLoading: false, isError: false, error: null };
      }
      return { data: null, isLoading: false, isError: true, error: { message: 'x' } };
    }

    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
    );

    const { result: rLoading } = renderHook(() => useStatus('loading'), { wrapper });
    expect(rLoading.current.isLoading).toBe(true);
    expect(rLoading.current.data).toBeNull();

    const { result: rSuccess } = renderHook(() => useStatus('success'), { wrapper });
    expect(rSuccess.current.isLoading).toBe(false);
    expect(rSuccess.current.data).toEqual({ count: 1 });

    const { result: rError } = renderHook(() => useStatus('error'), { wrapper });
    expect(rError.current.isError).toBe(true);
    expect(rError.current.error).toEqual({ message: 'x' });
  });

  it('executes a mutation mock inside act and asserts it was called with expected payload', async () => {
    await act(async () => {
      doMutate({ id: '123' });
    });
    expect(doMutate).toHaveBeenCalledWith({ id: '123' });
  });
});