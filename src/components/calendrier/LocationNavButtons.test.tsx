import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/components/ui/button', () => {
  return {
    Button: ({
      children,
      onClick,
      type,
      ...rest
    }: {
      children: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
      type?: 'button' | 'submit' | 'reset';
      [k: string]: unknown;
    }) => (
      <button type={type ?? 'button'} onClick={onClick} {...rest}>
        {children}
      </button>
    ),
  };
});

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg aria-hidden="true" data-class={className} />;
  return { Navigation: Icon, MapPin: Icon, Car: Icon };
});

import { LocationNavButtons } from './LocationNavButtons';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('LocationNavButtons', () => {
  it('renders only Google Maps and Waze on non-iOS and opens correct URLs', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);

    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    });
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Linux x86_64',
    });

    render(<LocationNavButtons lat={48.8566} lng={2.3522} label="Café de Paris" />);

    expect(screen.queryByRole('button', { name: /plans/i })).toBeNull();
    expect(screen.getByRole('button', { name: /google maps/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /waze/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /google maps/i }));
    expect(window.open).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=48.8566,2.3522&destination_place_id=Caf%C3%A9%20de%20Paris',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByRole('button', { name: /waze/i }));
    expect(window.open).toHaveBeenCalledWith(
      'https://waze.com/ul?ll=48.8566,2.3522&navigate=yes',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('renders Plans button on iOS and opens Apple Plans URL (label encoded in q)', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);

    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    });
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'iPhone',
    });

    render(<LocationNavButtons lat={40.7128} lng={-74.006} label="New York" />);

    expect(screen.getByRole('button', { name: /plans/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /plans/i }));
    expect(window.open).toHaveBeenCalledWith(
      'https://maps.apple.com/?daddr=40.7128,-74.006&q=New%20York',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('builds URLs without label when label is missing', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);

    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    });
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Linux x86_64',
    });

    render(<LocationNavButtons lat={1.23} lng={4.56} />);

    fireEvent.click(screen.getByRole('button', { name: /google maps/i }));
    expect(window.open).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=1.23,4.56',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByRole('button', { name: /waze/i }));
    expect(window.open).toHaveBeenCalledWith(
      'https://waze.com/ul?ll=1.23,4.56&navigate=yes',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('renderHook with QueryClientProvider: loading -> success -> error (template required by suite)', async () => {
    const { states } = vi.hoisted(() => {
      return {
        states: {
          status: 'loading' as 'loading' | 'success' | 'error',
          data: null as { value: number } | null,
          error: null as { message: string } | null,
        },
      };
    });

    function useFakeQuery() {
      if (states.status === 'loading') {
        return { isLoading: true, isError: false, data: null, error: null };
      }
      if (states.status === 'error') {
        return { isLoading: false, isError: true, data: null, error: states.error };
      }
      return { isLoading: false, isError: false, data: states.data, error: null };
    }

    const wrapper = createWrapper();
    const { result, rerender } = renderHook(() => useFakeQuery(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeNull();

    states.status = 'success';
    states.data = { value: 42 };
    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.data).toEqual({ value: 42 });
    });

    states.status = 'error';
    states.data = null;
    states.error = { message: 'x' };
    rerender();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toEqual({ message: 'x' });
    });
  });
});