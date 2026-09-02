import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationAutocomplete, type LocationValue } from './LocationAutocomplete';

const { hookState, inputPropsRef, popoverState, cnMock } = vi.hoisted(() => ({
  hookState: {
    suggestions: [] as Array<{ place_id: string; display_name: string; lat: string; lon: string }>,
    loading: false,
    error: null as null | { message: string },
  },
  inputPropsRef: {
    current: null as null | Record<string, unknown>,
  },
  popoverState: {
    open: false,
    onOpenChange: undefined as undefined | ((open: boolean) => void),
  },
  cnMock: vi.fn((...classes: Array<string | undefined>) => classes.filter(Boolean).join(' ')),
}));

vi.mock('@/hooks/search/useAddressSearch', () => ({
  useAddressSearch: vi.fn(() => ({
    suggestions: hookState.suggestions,
    loading: hookState.loading,
    error: hookState.error,
    isError: Boolean(hookState.error),
  })),
}));

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
    inputPropsRef.current = props as unknown as Record<string, unknown>;
    return <input ref={ref} data-testid="location-input" {...props} />;
  }),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => {
    popoverState.open = open;
    popoverState.onOpenChange = onOpenChange;
    return <div data-testid="popover-root" data-open={String(open)}>{children}</div>;
  },
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  MapPin: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="map-pin-icon" {...props} />,
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="search-icon" {...props} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: cnMock,
}));

describe('LocationAutocomplete', () => {
  beforeEach(() => {
    hookState.suggestions = [];
    hookState.loading = false;
    hookState.error = null;
    inputPropsRef.current = null;
    popoverState.open = false;
    popoverState.onOpenChange = undefined;
    cnMock.mockClear();
  });

  it('affiche la valeur initiale et le placeholder personnalisé', () => {
    const onChange = vi.fn();
    const value: LocationValue = {
      address: '10 rue de Paris',
      coords: { lat: 48.8566, lng: 2.3522 },
    };

    render(
      <LocationAutocomplete
        value={value}
        onChange={onChange}
        placeholder="Rechercher une adresse"
        className="custom-class"
      />,
    );

    const input = screen.getByTestId('location-input');
    expect(input).toHaveValue('10 rue de Paris');
    expect(input).toHaveAttribute('placeholder', 'Rechercher une adresse');
    expect(cnMock).toHaveBeenCalledWith('relative', 'custom-class');
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('gère le chargement puis affiche les suggestions et permet une sélection', () => {
    const onChange = vi.fn();
    const value: LocationValue = {
      address: '',
      coords: null,
    };

    const { rerender } = render(
      <LocationAutocomplete
        value={value}
        onChange={onChange}
      />,
    );

    const input = screen.getByTestId('location-input');

    hookState.loading = true;
    fireEvent.change(input, { target: { value: 'Par' } });

    expect(onChange).toHaveBeenCalledWith({ address: 'Par', coords: null });
    expect(screen.getAllByTestId('loader-icon').length).toBeGreaterThan(0);
    expect(screen.getByText("Recherche d'adresses…")).toBeInTheDocument();

    hookState.loading = false;
    hookState.suggestions = [
      {
        place_id: '1',
        display_name: 'Paris, France',
        lat: '48.8566',
        lon: '2.3522',
      },
      {
        place_id: '2',
        display_name: 'Paris 15e, France',
        lat: '48.8414',
        lon: '2.2923',
      },
    ];

    rerender(
      <LocationAutocomplete
        value={value}
        onChange={onChange}
      />,
    );

    const firstSuggestion = screen.getByRole('button', { name: /Paris, France/i });
    expect(firstSuggestion).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paris 15e, France/i })).toBeInTheDocument();

    fireEvent.click(firstSuggestion);

    expect(onChange).toHaveBeenLastCalledWith({
      address: 'Paris, France',
      coords: { lat: 48.8566, lng: 2.3522 },
    });
  });

  it("affiche l'état vide quand aucune adresse n'est trouvée", () => {
    const onChange = vi.fn();
    const value: LocationValue = {
      address: '',
      coords: null,
    };

    render(<LocationAutocomplete value={value} onChange={onChange} />);

    const input = screen.getByTestId('location-input');
    fireEvent.change(input, { target: { value: 'Lyo' } });

    expect(screen.getByText('Aucune adresse trouvée. Vous pouvez saisir un lieu libre.')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({ address: 'Lyo', coords: null });
  });

  it('ne supprime pas les coordonnées si la saisie est identique à la valeur courante', () => {
    const onChange = vi.fn();
    const value: LocationValue = {
      address: 'Marseille',
      coords: { lat: 43.2965, lng: 5.3698 },
    };

    render(<LocationAutocomplete value={value} onChange={onChange} />);

    const input = screen.getByTestId('location-input');
    fireEvent.change(input, { target: { value: 'Marseille' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ouvre au focus si la requête contient déjà au moins 3 caractères", () => {
    const onChange = vi.fn();
    const value: LocationValue = {
      address: 'Nic',
      coords: null,
    };

    render(<LocationAutocomplete value={value} onChange={onChange} />);

    const input = screen.getByTestId('location-input');
    fireEvent.focus(input);

    expect(screen.getByText('Aucune adresse trouvée. Vous pouvez saisir un lieu libre.')).toBeInTheDocument();
  });

  it("reflète un état d'erreur du hook sans bloquer l'affichage de l'état vide", () => {
    const onChange = vi.fn();
    const value: LocationValue = {
      address: '',
      coords: null,
    };

    hookState.error = { message: 'x' };
    hookState.loading = false;
    hookState.suggestions = [];

    render(<LocationAutocomplete value={value} onChange={onChange} />);

    const input = screen.getByTestId('location-input');
    fireEvent.change(input, { target: { value: 'Bor' } });

    expect(screen.getByText('Aucune adresse trouvée. Vous pouvez saisir un lieu libre.')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({ address: 'Bor', coords: null });
  });
});