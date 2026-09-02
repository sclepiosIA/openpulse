import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderCard } from '../FolderCard';

const folder = { id: 'f1', name: 'Contrats', color: null, parent_id: null, created_by: 'u1', created_at: '', updated_at: '' } as any;

describe('FolderCard', () => {
  it('renders folder name in grid mode', () => {
    render(<FolderCard folder={folder} onClick={vi.fn()} />);
    expect(screen.getByText('Contrats')).toBeInTheDocument();
  });

  it('renders folder name in list mode', () => {
    render(<FolderCard folder={folder} onClick={vi.fn()} viewMode="list" />);
    expect(screen.getByText('Contrats')).toBeInTheDocument();
    expect(screen.getByText('Dossier')).toBeInTheDocument();
  });

  it('calls onClick on click', () => {
    const onClick = vi.fn();
    render(<FolderCard folder={folder} onClick={onClick} />);
    fireEvent.click(screen.getByText('Contrats'));
    expect(onClick).toHaveBeenCalled();
  });
});
