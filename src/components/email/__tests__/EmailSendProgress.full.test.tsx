import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EmailSendProgress } from '../EmailSendProgress';

describe('EmailSendProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when not sending', () => {
    const { container } = render(<EmailSendProgress isSending={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows preparing stage initially', () => {
    render(<EmailSendProgress isSending={true} />);
    // Initially visible even at 0%
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('progresses through stages', () => {
    render(<EmailSendProgress isSending={true} />);

    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Préparation du message...')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText('Envoi en cours...')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.getByText('Finalisation...')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('calls onComplete when done', () => {
    const onComplete = vi.fn();
    render(<EmailSendProgress isSending={true} onComplete={onComplete} />);

    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.getByText('Email envoyé avec succès !')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
