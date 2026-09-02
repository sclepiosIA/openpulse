import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: vi.fn().mockReturnValue({ select: vi.fn() }) },
}));
vi.mock('@/hooks/knowledge/useTutorielProgress', () => ({
  useTutorielProgress: () => ({
    percentComplete: 0, isCompleted: false,
    markSectionRead: vi.fn(), completedSections: [],
  }),
}));
vi.mock('@/lib/tutoriel-content', () => ({
  getModuleById: (id: string) => id === 'prise-en-main' ? {
    id: 'prise-en-main', title: 'Prise en main', description: 'Desc', icon: 'BookOpen',
    sections: [{ id: 's1', title: 'Intro', content: 'Contenu' }],
  } : undefined,
  tutorielModules: [],
}));
vi.mock('@/components/tutoriel/TutorielLayout', () => ({
  TutorielLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/tutoriel/TutorielSection', () => ({
  TutorielSection: ({ section }: any) => <div>{section.title}</div>,
}));
vi.mock('@/components/tutoriel/TutorielProgress', () => ({
  TutorielProgress: () => null,
}));
vi.mock('@/components/tutoriel/TutorielSearch', () => ({
  TutorielSearch: () => null,
}));

import TutorielModule from '../TutorielModule';
import { supabase } from '@/integrations/supabase/client';

describe('TutorielModule page', () => {
  it('renders 404 for unknown module', () => {
    render(
      <MemoryRouter initialEntries={['/tutoriels/unknown']}>
        <Routes>
          <Route path="/tutoriels/:moduleId" element={<TutorielModule />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Module non trouvé')).toBeInTheDocument();
  });
});
