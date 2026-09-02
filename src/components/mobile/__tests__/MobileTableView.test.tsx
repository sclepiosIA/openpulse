import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileTableView } from '../MobileTableView';

describe('MobileTableView', () => {
  it('renders empty message when no data', () => {
    render(
      <MobileTableView
        data={[]}
        keyExtractor={(item: any) => item.id}
        renderCard={(item: any) => <div>{item.name}</div>}
      />
    );
    expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    render(
      <MobileTableView
        data={[]}
        keyExtractor={(item: any) => item.id}
        renderCard={(item: any) => <div>{item.name}</div>}
        emptyMessage="Rien à afficher"
      />
    );
    expect(screen.getByText('Rien à afficher')).toBeInTheDocument();
  });

  it('renders cards for data items', () => {
    const data = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];
    render(
      <MobileTableView
        data={data}
        keyExtractor={(item) => item.id}
        renderCard={(item) => <div>{item.name}</div>}
      />
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});
