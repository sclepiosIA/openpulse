/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityLinkAutocomplete } from './EntityLinkAutocomplete';

const {
  SEARCH_STATE,
  mockUseEntitySearch,
  mockCn,
  BUILDING,
  USER,
  USERS,
} = vi.hoisted(() => {
  const BuildingIcon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="entity-icon-building" {...props} />;
  const UserIcon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="entity-icon-user" {...props} />;
  const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="entity-icon-users" {...props} />;

  return {
    SEARCH_STATE: {
      results: {
        etablissements: [] as Array<{ id: string; type: 'etablissement'; name: string; subtitle?: string; icon: React.ElementType }>,
        taches: [] as Array<{ id: string; type: 'tache'; name: string; subtitle?: string; icon: React.ElementType }>,
        contacts: [] as Array<{ id: string; type: 'contact'; name: string; subtitle?: string; icon: React.ElementType }>,
        groupes: [] as Array<{ id: string; type: 'groupe'; name: string; subtitle?: string; icon: React.ElementType }>,
      },
      allResults: [] as Array<{ id: string; type: 'etablissement' | 'tache' | 'contact' | 'groupe' | 'evenement' | 'partenaire'; name: string; subtitle?: string; icon: React.ElementType }>,
      hasResults: false,
      isSearching: false,
    },
    mockUseEntitySearch: vi.fn(),
    mockCn: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')),
    BUILDING: BuildingIcon,
    USER: UserIcon,
    USERS: UsersIcon,
  };
});

vi.mock('@/hooks/search/useEntitySearch', () => ({
  useEntitySearch: mockUseEntitySearch,
}));

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

vi.mock('lucide-react', () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
  Building2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="group-icon-etablissement" {...props} />,
  CheckSquare: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="group-icon-tache" {...props} />,
  User: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="group-icon-contact" {...props} />,
  Users: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="group-icon-groupe" {...props} />,
  Calendar: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="group-icon-evenement" {...props} />,
  Handshake: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="group-icon-partenaire" {...props} />,
}));

describe('EntityLinkAutocomplete', () => {
  beforeEach(() => {
    SEARCH_STATE.results = {
      etablissements: [],
      taches: [],
      contacts: [],
      groupes: [],
    };
    SEARCH_STATE.allResults = [];
    SEARCH_STATE.hasResults = false;
    SEARCH_STATE.isSearching = false;

    mockUseEntitySearch.mockReset();
    mockUseEntitySearch.mockImplementation(() => SEARCH_STATE);
    mockCn.mockClear();
  });

  it('ne rend rien quand visible est false', () => {
    const { container } = render(
      <EntityLinkAutocomplete
        query="ac"
        position={{ top: 10, left: 20 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        visible={false}
      />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Lier une entité')).not.toBeInTheDocument();
  });

  it('affiche le placeholder et le loader pendant la recherche', () => {
    SEARCH_STATE.isSearching = true;

    render(
      <EntityLinkAutocomplete
        query="a"
        position={{ top: 12, left: 34 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        visible
      />
    );

    expect(screen.getByText('Lier une entité')).toBeInTheDocument();
    expect(screen.getByText('Tapez au moins 2 caractères pour rechercher...')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.getByText('naviguer')).toBeInTheDocument();
    expect(screen.getByText('sélectionner')).toBeInTheDocument();
  });

  it('affiche les résultats groupés et appelle onSelect au clic', () => {
    const onSelect = vi.fn();

    const etablissement = {
      id: 'e1',
      type: 'etablissement' as const,
      name: 'Clinique du Lac',
      subtitle: 'Lyon',
      icon: BUILDING,
    };
    const contact = {
      id: 'c1',
      type: 'contact' as const,
      name: 'Marie Martin',
      subtitle: 'Directrice',
      icon: USER,
    };
    const groupe = {
      id: 'g1',
      type: 'groupe' as const,
      name: 'Équipe Nord',
      subtitle: '12 membres',
      icon: USERS,
    };

    SEARCH_STATE.results = {
      etablissements: [etablissement],
      taches: [],
      contacts: [contact],
      groupes: [groupe],
    };
    SEARCH_STATE.allResults = [etablissement, contact, groupe];
    SEARCH_STATE.hasResults = true;

    render(
      <EntityLinkAutocomplete
        query="ma"
        position={{ top: 50, left: 80 }}
        onSelect={onSelect}
        onClose={vi.fn()}
        visible
      />
    );

    expect(screen.getByText('Établissements')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('Groupes')).toBeInTheDocument();
    expect(screen.getByText('Clinique du Lac')).toBeInTheDocument();
    expect(screen.getByText('Marie Martin')).toBeInTheDocument();
    expect(screen.getByText('Équipe Nord')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Marie Martin/i }));
    expect(onSelect).toHaveBeenCalledWith(contact);
  });

  it('affiche le message aucun résultat avec le texte fragmenté', () => {
    render(
      <EntityLinkAutocomplete
        query="zzz"
        position={{ top: 10, left: 10 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        visible
      />
    );

    expect(screen.getByText((content) => content.includes('Aucun résultat pour'))).toBeInTheDocument();
    expect(screen.getByText('zzz')).toBeInTheDocument();
  });

  it('filtre les résultats par type', () => {
    const etablissement = {
      id: 'e1',
      type: 'etablissement' as const,
      name: 'Centre Méridien',
      subtitle: 'Paris',
      icon: BUILDING,
    };
    const contact = {
      id: 'c1',
      type: 'contact' as const,
      name: 'Jean Dupont',
      subtitle: 'Référent',
      icon: USER,
    };

    SEARCH_STATE.results = {
      etablissements: [etablissement],
      taches: [],
      contacts: [contact],
      groupes: [],
    };
    SEARCH_STATE.allResults = [etablissement, contact];
    SEARCH_STATE.hasResults = true;

    render(
      <EntityLinkAutocomplete
        query="je"
        position={{ top: 0, left: 0 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        visible
        filter="contact"
      />
    );

    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.queryByText('Établissements')).not.toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.queryByText('Centre Méridien')).not.toBeInTheDocument();
  });

  it('gère la navigation clavier, la sélection et la fermeture', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const first = {
      id: 'c1',
      type: 'contact' as const,
      name: 'Alice Bernard',
      subtitle: 'RH',
      icon: USER,
    };
    const second = {
      id: 'c2',
      type: 'contact' as const,
      name: 'Bruno Caron',
      subtitle: 'Finance',
      icon: USER,
    };

    SEARCH_STATE.results = {
      etablissements: [],
      taches: [],
      contacts: [first, second],
      groupes: [],
    };
    SEARCH_STATE.allResults = [first, second];
    SEARCH_STATE.hasResults = true;

    render(
      <EntityLinkAutocomplete
        query="br"
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
        onClose={onClose}
        visible
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(second);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ferme au clic extérieur', () => {
    const onClose = vi.fn();

    const contact = {
      id: 'c1',
      type: 'contact' as const,
      name: 'Lucie Petit',
      subtitle: 'Support',
      icon: USER,
    };

    SEARCH_STATE.results = {
      etablissements: [],
      taches: [],
      contacts: [contact],
      groupes: [],
    };
    SEARCH_STATE.allResults = [contact];
    SEARCH_STATE.hasResults = true;

    render(
      <div>
        <EntityLinkAutocomplete
          query="lu"
          position={{ top: 0, left: 0 }}
          onSelect={vi.fn()}
          onClose={onClose}
          visible
        />
        <button data-testid="outside">outside</button>
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('réinitialise la sélection quand la query change', () => {
    const onSelect = vi.fn();

    const first = {
      id: 'c1',
      type: 'contact' as const,
      name: 'Alice Bernard',
      subtitle: 'RH',
      icon: USER,
    };
    const second = {
      id: 'c2',
      type: 'contact' as const,
      name: 'Bruno Caron',
      subtitle: 'Finance',
      icon: USER,
    };

    SEARCH_STATE.results = {
      etablissements: [],
      taches: [],
      contacts: [first, second],
      groupes: [],
    };
    SEARCH_STATE.allResults = [first, second];
    SEARCH_STATE.hasResults = true;

    const { rerender } = render(
      <EntityLinkAutocomplete
        query="al"
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
        onClose={vi.fn()}
        visible
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowDown' });

    rerender(
      <EntityLinkAutocomplete
        query="ali"
        position={{ top: 0, left: 0 }}
        onSelect={onSelect}
        onClose={vi.fn()}
        visible
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(first);
  });
});