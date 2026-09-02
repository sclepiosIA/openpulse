// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariablesHelper } from './VariablesHelper';

const { toastSuccess, writeTextMock } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Copy: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="copy-icon" {...props} />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: vi.fn(),
  },
}));

describe('VariablesHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
    });
  });

  it('affiche la variable par défaut et le titre sans triggerType', () => {
    render(<VariablesHelper />);

    expect(screen.getByText('Variables disponibles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /etablissement_id/i })).toBeInTheDocument();
    expect(screen.getByText('{{trigger.champ}}')).toBeInTheDocument();
    expect(screen.getByText('{{ai.cle}}')).toBeInTheDocument();
    expect(screen.getByText('{{vars.nom}}')).toBeInTheDocument();
  });

  it('affiche les variables métier réelles du trigger email.received', () => {
    render(<VariablesHelper triggerType="email.received" />);

    expect(screen.getByText('Variables disponibles (email.received)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email_id/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sender_email/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sender_name/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subject/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /body/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thread_id/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /etablissement_id/i })).toBeInTheDocument();
  });

  it('appelle onInsert avec le token formaté quand fourni', () => {
    const onInsert = vi.fn();

    render(<VariablesHelper triggerType="task.completed" onInsert={onInsert} />);

    fireEvent.click(screen.getByRole('button', { name: /completed_by/i }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith('{{trigger.completed_by}}');
    expect(writeTextMock).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('copie dans le presse-papiers et toast le token quand onInsert est absent', () => {
    render(<VariablesHelper triggerType="manual" />);

    fireEvent.click(screen.getByRole('button', { name: /triggered_by/i }));

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith('{{trigger.triggered_by}}');
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Copié : {{trigger.triggered_by}}');
  });

  it('retire le texte entre parenthèses dans le libellé pour former le token', () => {
    render(<VariablesHelper triggerType="webhook" />);

    fireEvent.click(screen.getByRole('button', { name: /payload \(objet libre\)/i }));

    expect(writeTextMock).toHaveBeenCalledWith('{{trigger.payload}}');
    expect(toastSuccess).toHaveBeenCalledWith('Copié : {{trigger.payload}}');
  });

  it('gère un autre trigger métier avec ses variables spécifiques', () => {
    render(<VariablesHelper triggerType="calendar.event_starts_in" />);

    expect(screen.getByRole('button', { name: /event_id/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start_time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /minutes_until/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /etablissement_id/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /minutes_until/i }));

    expect(writeTextMock).toHaveBeenCalledWith('{{trigger.minutes_until}}');
    expect(toastSuccess).toHaveBeenCalledWith('Copié : {{trigger.minutes_until}}');
  });
});