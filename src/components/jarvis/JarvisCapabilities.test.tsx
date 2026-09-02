import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const { mockVibrateSelection } = vi.hoisted(() => ({
  mockVibrateSelection: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: mockVibrateSelection,
}));

vi.mock('framer-motion', () => {
  const ReactActual = require('react');
  const MotionMock: React.FC<React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>> = (props) =>
    ReactActual.createElement('div', props);
  const MotionButtonMock: React.FC<React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>> = (props) =>
    ReactActual.createElement('button', props);
  return {
    motion: {
      div: MotionMock,
      button: MotionButtonMock,
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('lucide-react', () => {
  const ReactActual = require('react');
  const IconMock: React.FC<{ className?: string }> = ({ className }) =>
    ReactActual.createElement('svg', { 'data-testid': 'icon', className });
  return {
    Mail: IconMock,
    Calendar: IconMock,
    BarChart2: IconMock,
    Users: IconMock,
    Zap: IconMock,
    Brain: IconMock,
    MessageCircle: IconMock,
    CheckCircle2: IconMock,
    Search: IconMock,
    Sparkles: IconMock,
    ChevronRight: IconMock,
    Layers: IconMock,
  };
});

import { JarvisCapabilities } from './JarvisCapabilities';

describe('JarvisCapabilities', () => {
  beforeEach(() => {
    mockVibrateSelection.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('affiche l’état initial avec le message de sélection de catégorie', () => {
    render(<JarvisCapabilities />);

    expect(
      screen.getByText('Sélectionnez une catégorie pour voir les capacités')
    ).toBeInTheDocument();

    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('CRM & Commercial')).toBeInTheDocument();
    expect(screen.getByText('Productivité')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('permet de sélectionner une catégorie et affiche ses capacités', () => {
    render(<JarvisCapabilities />);

    const communicationTab = screen.getByText('Communication');
    fireEvent.click(communicationTab);

    expect(mockVibrateSelection).toHaveBeenCalled();

    expect(screen.getByText('Gestion des emails')).toBeInTheDocument();
    expect(screen.getByText('Calendrier')).toBeInTheDocument();

    expect(
      screen.queryByText('Sélectionnez une catégorie pour voir les capacités')
    ).not.toBeInTheDocument();
  });

  it('permet de replier une catégorie en la re-cliquant', () => {
    render(<JarvisCapabilities />);

    const communicationTab = screen.getByText('Communication');
    fireEvent.click(communicationTab);
    expect(screen.getByText('Gestion des emails')).toBeInTheDocument();

    fireEvent.click(communicationTab);

    expect(
      screen.queryByText('Gestion des emails')
    ).not.toBeInTheDocument();

    expect(
      screen.getByText('Sélectionnez une catégorie pour voir les capacités')
    ).toBeInTheDocument();
  });

  it('déplie une capacité et affiche les exemples', () => {
    render(<JarvisCapabilities />);

    const communicationTab = screen.getByText('Communication');
    fireEvent.click(communicationTab);

    const capabilityCard = screen.getByText('Gestion des emails');
    fireEvent.click(capabilityCard);

    expect(
      screen.getByText('Exemples')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Résume mes emails non lus')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Rédige un email de relance pour...')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Quels emails sont urgents ?')
    ).toBeInTheDocument();
  });

  it('appelle onSelectExample et vibre lors du clic sur un exemple dans la vue détaillée', () => {
    const handleSelectExample = vi.fn();
    render(<JarvisCapabilities onSelectExample={handleSelectExample} />);

    const communicationTab = screen.getByText('Communication');
    fireEvent.click(communicationTab);

    const capabilityCard = screen.getByText('Gestion des emails');
    fireEvent.click(capabilityCard);

    const exampleButton = screen.getByText('Résume mes emails non lus');
    fireEvent.click(exampleButton);

    expect(mockVibrateSelection).toHaveBeenCalled();
    expect(handleSelectExample).toHaveBeenCalledWith('Résume mes emails non lus');
  });

  it('stoppe la propagation du clic sur un exemple pour ne pas replier la capacité', () => {
    const handleSelectExample = vi.fn();
    render(<JarvisCapabilities onSelectExample={handleSelectExample} />);

    const communicationTab = screen.getByText('Communication');
    fireEvent.click(communicationTab);

    const capabilityCard = screen.getByText('Gestion des emails');
    fireEvent.click(capabilityCard);

    const exampleButton = screen.getByText('Résume mes emails non lus');
    fireEvent.click(exampleButton);

    expect(screen.getByText('Exemples')).toBeInTheDocument();
  });

  it('applique la vue compacte et déclenche le premier exemple de chaque capacité', () => {
    const handleSelectExample = vi.fn();
    render(<JarvisCapabilities compact onSelectExample={handleSelectExample} />);

    const buttons = screen.getAllByRole('button');

    expect(buttons.length).toBeGreaterThanOrEqual(8);

    const communicationEmailsTitle = 'Gestion des emails';
    const communicationCalendarTitle = 'Calendrier';
    const crmPipelineTitle = 'Pipeline commercial';
    const crmClientsTitle = 'Gestion clients';
    const prodTasksTitle = 'Tâches';
    const prodBriefingTitle = 'Briefings';
    const analyticsAnalysisTitle = 'Analyses';
    const analyticsSearchTitle = 'Recherche';

    const iconButtonsWithTitles = buttons.filter((btn) => btn.getAttribute('title'));

    const titles = iconButtonsWithTitles.map((btn) => btn.getAttribute('title'));

    expect(titles).toContain(communicationEmailsTitle);
    expect(titles).toContain(communicationCalendarTitle);
    expect(titles).toContain(crmPipelineTitle);
    expect(titles).toContain(crmClientsTitle);
    expect(titles).toContain(prodTasksTitle);
    expect(titles).toContain(prodBriefingTitle);
    expect(titles).toContain(analyticsAnalysisTitle);
    expect(titles).toContain(analyticsSearchTitle);

    const emailsButton = iconButtonsWithTitles.find(
      (btn) => btn.getAttribute('title') === communicationEmailsTitle
    );
    expect(emailsButton).toBeDefined();

    if (emailsButton) {
      fireEvent.click(emailsButton);
    }

    expect(mockVibrateSelection).toHaveBeenCalled();
    expect(handleSelectExample).toHaveBeenCalledWith('Résume mes emails non lus');
  });

  it('appelle vibrateSelection lors du clic sur un onglet de catégorie et sur une carte de capacité', () => {
    render(<JarvisCapabilities />);

    const communicationTab = screen.getByText('Communication');
    fireEvent.click(communicationTab);

    const capabilityCard = screen.getByText('Gestion des emails');
    fireEvent.click(capabilityCard);

    expect(mockVibrateSelection).toHaveBeenCalledTimes(2);
  });
})