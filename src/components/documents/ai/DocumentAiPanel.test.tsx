/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentAiPanel } from './DocumentAiPanel';

const { mockCallDocumentAiAssist, toastSuccess, toastError } = vi.hoisted(() => ({
  mockCallDocumentAiAssist: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/documents/documentAiAssist', () => ({
  callDocumentAiAssist: mockCallDocumentAiAssist,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

const DOC_HTML = '<p>Compte-rendu : Alice enverra le devis avant le 15 juillet.</p>';

function renderPanel(overrides: Partial<React.ComponentProps<typeof DocumentAiPanel>> = {}) {
  const props: React.ComponentProps<typeof DocumentAiPanel> = {
    getDocumentContent: () => DOC_HTML,
    documentName: 'CR réunion',
    ...overrides,
  };
  return render(<DocumentAiPanel {...props} />);
}

describe('DocumentAiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les quatre actions IA avec leurs libellés français', () => {
    renderPanel();

    expect(screen.getByText('Résumer')).toBeInTheDocument();
    expect(screen.getByText('Reformuler')).toBeInTheDocument();
    expect(screen.getByText('Classifier DPO/RSSI')).toBeInTheDocument();
    expect(screen.getByText('Extraire les actions')).toBeInTheDocument();
  });

  it('lance un résumé avec le contenu du document et affiche le résultat', async () => {
    mockCallDocumentAiAssist.mockResolvedValue({
      status: 'ok',
      action: 'summarize',
      result: 'Alice enverra le devis avant le 15 juillet.',
      model: 'gpt-5.4',
    });

    renderPanel();
    fireEvent.click(screen.getByTestId('ai-action-summarize'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-result')).toBeInTheDocument();
    });

    expect(mockCallDocumentAiAssist).toHaveBeenCalledWith({
      action: 'summarize',
      content: DOC_HTML,
      documentName: 'CR réunion',
      tone: undefined,
    });
    expect(screen.getByText('Alice enverra le devis avant le 15 juillet.')).toBeInTheDocument();
    expect(screen.getByText(/Modèle : gpt-5.4/)).toBeInTheDocument();
  });

  it('transmet le ton sélectionné pour la reformulation', async () => {
    mockCallDocumentAiAssist.mockResolvedValue({
      status: 'ok',
      action: 'rewrite',
      result: 'Version reformulée.',
    });

    renderPanel();
    fireEvent.click(screen.getByTestId('ai-action-rewrite'));

    await waitFor(() => {
      expect(mockCallDocumentAiAssist).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'rewrite', tone: 'formal' }),
      );
    });
  });

  it('affiche les badges DPO et RSSI après classification', async () => {
    mockCallDocumentAiAssist.mockResolvedValue({
      status: 'ok',
      action: 'classify',
      classification: {
        dpo_level: 'donnees_sante',
        rssi_level: 'critique',
        rationale: 'Document contenant des données patients.',
        recommendations: ['Chiffrer le fichier'],
      },
    });

    renderPanel();
    fireEvent.click(screen.getByTestId('ai-action-classify'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-classification')).toBeInTheDocument();
    });

    expect(screen.getByText('DPO : Données de santé')).toBeInTheDocument();
    expect(screen.getByText('RSSI : Critique')).toBeInTheDocument();
    expect(screen.getByText('Document contenant des données patients.')).toBeInTheDocument();
    expect(screen.getByText('Chiffrer le fichier')).toBeInTheDocument();
  });

  it('liste les actions extraites avec responsable et échéance', async () => {
    mockCallDocumentAiAssist.mockResolvedValue({
      status: 'ok',
      action: 'extract_actions',
      actions: [
        { action: 'Envoyer le devis', owner: 'Alice', due_date: '15 juillet' },
        { action: 'Relancer le client' },
      ],
    });

    renderPanel();
    fireEvent.click(screen.getByTestId('ai-action-extract_actions'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-actions-list')).toBeInTheDocument();
    });

    expect(screen.getByText('Envoyer le devis')).toBeInTheDocument();
    expect(screen.getByText(/Alice · échéance : 15 juillet/)).toBeInTheDocument();
    expect(screen.getByText('Relancer le client')).toBeInTheDocument();
  });

  it("affiche l'état non configuré et désactive les actions (mode dégradé)", async () => {
    mockCallDocumentAiAssist.mockResolvedValue({
      status: 'unconfigured',
      message: "L'assistant IA documents n'est pas configuré sur ce déploiement.",
    });

    renderPanel();
    fireEvent.click(screen.getByTestId('ai-action-summarize'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-unconfigured')).toBeInTheDocument();
    });

    expect(screen.getByText('Assistant IA non configuré')).toBeInTheDocument();
    expect(screen.getByText(/n'est pas configuré sur ce déploiement/)).toBeInTheDocument();
    // Toutes les actions sont désactivées en mode non configuré
    expect(screen.getByTestId('ai-action-summarize')).toBeDisabled();
    expect(screen.getByTestId('ai-action-rewrite')).toBeDisabled();
    expect(screen.getByTestId('ai-action-classify')).toBeDisabled();
    expect(screen.getByTestId('ai-action-extract_actions')).toBeDisabled();
    // Pas de toast d'erreur : ce n'est pas un échec, c'est un état
    expect(toastError).not.toHaveBeenCalled();
  });

  it('toaste les erreurs serveur sans casser le panneau', async () => {
    mockCallDocumentAiAssist.mockResolvedValue({
      status: 'error',
      message: 'Erreur Azure: 500',
    });

    renderPanel();
    fireEvent.click(screen.getByTestId('ai-action-summarize'));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Erreur Azure: 500');
    });

    // Les actions restent utilisables après une erreur ponctuelle
    expect(screen.getByTestId('ai-action-summarize')).not.toBeDisabled();
  });

  it("refuse d'analyser un document vide sans appeler le backend", () => {
    renderPanel({ getDocumentContent: () => '<p>   </p>' });

    fireEvent.click(screen.getByTestId('ai-action-summarize'));

    expect(mockCallDocumentAiAssist).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('Le document est vide : rien à analyser.');
  });

  it("insère le résultat dans l'éditeur via onInsertContent", async () => {
    const onInsertContent = vi.fn();
    mockCallDocumentAiAssist.mockResolvedValue({
      status: 'ok',
      action: 'summarize',
      result: 'Résumé à insérer.',
    });

    renderPanel({ onInsertContent });
    fireEvent.click(screen.getByTestId('ai-action-summarize'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-insert-result')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ai-insert-result'));
    expect(onInsertContent).toHaveBeenCalledWith('Résumé à insérer.');
  });

  it('convertit les actions extraites en HTML lors de l’insertion', async () => {
    const onInsertContent = vi.fn();
    mockCallDocumentAiAssist.mockResolvedValue({
      status: 'ok',
      action: 'extract_actions',
      actions: [{ action: 'Envoyer le devis', owner: 'Alice', due_date: '15 juillet' }],
    });

    renderPanel({ onInsertContent });
    fireEvent.click(screen.getByTestId('ai-action-extract_actions'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-insert-result')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('ai-insert-result'));
    const inserted = onInsertContent.mock.calls[0][0] as string;
    expect(inserted).toContain('<h3>Actions extraites</h3>');
    expect(inserted).toContain('Envoyer le devis');
    expect(inserted).toContain('<strong>Alice</strong>');
    expect(inserted).toContain('échéance : 15 juillet');
  });

  it('appelle onClose depuis le bouton de fermeture', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Fermer le panneau IA' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
