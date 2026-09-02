import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/tutoriel/TutorielSearch', () => ({
  TutorielSearch: () => <div data-testid="tutoriel-search" />,
}));
vi.mock('@/types/tutoriel', () => ({
  TUTORIEL_CATEGORIES: [],
}));
vi.mock('@/lib/tutoriel-content', () => ({
  tutorielModules: [
    {
      id: 'mod1',
      title: 'Démarrage',
      description: 'Guide de démarrage',
      icon: 'Rocket',
      category: 'general',
      lessons: [],
      sections: [
        { id: 's1', title: 'Intro', lessons: [], steps: [{ id: 'step1' }] },
      ],
    },
  ],
  getModuleById: () => null,
}));

import Tutoriels from '../Tutoriels';

describe('Tutoriels page', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <Tutoriels />
      </MemoryRouter>
    );
    expect(container.firstElementChild).toBeTruthy();
  });
});
