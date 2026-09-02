import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('lucide-react', () => ({
  Settings2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-settings2" {...props} />,
  Inbox: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-inbox" {...props} />,
}));

import { NoSourceState, NoDataState } from './WidgetEmptyState';

describe('WidgetEmptyState', () => {
  it('NoSourceState affiche le texte et l’icône', () => {
    render(<NoSourceState />);

    expect(screen.getByText('Configurer une source dans le panneau de droite')).toBeInTheDocument();
    expect(screen.getByTestId('icon-settings2')).toBeInTheDocument();
  });

  it('NoDataState affiche le texte et l’icône', () => {
    render(<NoDataState />);

    expect(screen.getByText('Aucune donnée pour cette période')).toBeInTheDocument();
    expect(screen.getByTestId('icon-inbox')).toBeInTheDocument();
  });
});