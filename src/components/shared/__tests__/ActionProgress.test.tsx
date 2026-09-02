import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { ActionProgress, useActionProgress } from '@/components/shared/ActionProgress';

describe('ActionProgress', () => {
  it('should return null when idle', () => {
    const { container } = render(<ActionProgress status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it('should show loading state with message', () => {
    render(<ActionProgress status="loading" message="Traitement..." />);
    expect(screen.getByText('Traitement...')).toBeInTheDocument();
  });

  it('should show default loading message', () => {
    render(<ActionProgress status="loading" />);
    expect(screen.getByText('Chargement en cours...')).toBeInTheDocument();
  });

  it('should show progress bar when loading with progress', () => {
    render(<ActionProgress status="loading" progress={50} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should show success state', () => {
    render(<ActionProgress status="success" successMessage="Terminé !" />);
    expect(screen.getByText('Terminé !')).toBeInTheDocument();
  });

  it('should show default success message', () => {
    render(<ActionProgress status="success" />);
    expect(screen.getByText('Opération terminée')).toBeInTheDocument();
  });

  it('should show error state', () => {
    render(<ActionProgress status="error" errorMessage="Échec" />);
    expect(screen.getByText('Échec')).toBeInTheDocument();
  });

  it('should show default error message', () => {
    render(<ActionProgress status="error" />);
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
  });

  it('should have role="status" and aria-live', () => {
    render(<ActionProgress status="loading" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('should hide progress bar when showProgress is false', () => {
    render(<ActionProgress status="loading" progress={50} showProgress={false} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
});

describe('useActionProgress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useActionProgress());
    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
  });

  it('should start loading', () => {
    const { result } = renderHook(() => useActionProgress());
    act(() => result.current.start('Loading...'));
    expect(result.current.status).toBe('loading');
    expect(result.current.message).toBe('Loading...');
  });

  it('should update progress', () => {
    const { result } = renderHook(() => useActionProgress());
    act(() => result.current.start());
    act(() => result.current.updateProgress(75, 'Almost done'));
    expect(result.current.progress).toBe(75);
    expect(result.current.message).toBe('Almost done');
  });

  it('should complete and auto-reset after 3s', () => {
    const { result } = renderHook(() => useActionProgress());
    act(() => result.current.start());
    act(() => result.current.complete());
    expect(result.current.status).toBe('success');
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.status).toBe('idle');
  });

  it('should fail and auto-reset after 5s', () => {
    const { result } = renderHook(() => useActionProgress());
    act(() => result.current.start());
    act(() => result.current.fail('Error'));
    expect(result.current.status).toBe('error');
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.status).toBe('idle');
  });

  it('should reset manually', () => {
    const { result } = renderHook(() => useActionProgress());
    act(() => result.current.start('test'));
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBe(0);
    expect(result.current.message).toBe('');
  });
});
