import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { EmailSendProgress } from '@/components/email/EmailSendProgress';

describe('EmailSendProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not render when not sending', () => {
    const { container } = render(React.createElement(EmailSendProgress, { isSending: false }));
    expect(container.firstChild).toBeNull();
  });

  it('should show preparing stage initially', () => {
    render(React.createElement(EmailSendProgress, { isSending: true }));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByText('Préparation du message...')).toBeInTheDocument();
  });

  it('should progress through stages', () => {
    render(React.createElement(EmailSendProgress, { isSending: true }));
    
    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText('Envoi en cours...')).toBeInTheDocument();
    
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.getByText('Finalisation...')).toBeInTheDocument();
  });

  it('should call onComplete when done', () => {
    const onComplete = vi.fn();
    render(React.createElement(EmailSendProgress, { isSending: true, onComplete }));
    
    act(() => { vi.advanceTimersByTime(2100); });
    expect(onComplete).toHaveBeenCalled();
    expect(screen.getByText('Email envoyé avec succès !')).toBeInTheDocument();
  });

  it('should show progress percentage', () => {
    render(React.createElement(EmailSendProgress, { isSending: true }));
    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByText('60%')).toBeInTheDocument();
  });
});
