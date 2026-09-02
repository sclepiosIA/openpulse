import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamMemberCard } from '../TeamMemberCard';

const mockProfile = {
  id: 'u1',
  prenom: 'Marie',
  nom: 'Dupont',
  email: 'marie@test.com',
  role: 'admin',
  actif: true,
  fonction: 'Directrice',
  avatar_url: null,
  linkedin_url: 'https://linkedin.com/in/marie',
};

const mockStats = {
  profileId: 'u1',
  totalTasks: 20,
  tasksCompleted: 15,
  tasksInProgress: 3,
  tasksOverdue: 2,
  completionRate: 75,
  workload: 'medium' as const,
  totalProjects: 3,
  projectsByStatus: { production: 1, deploiement: 1, contractuel: 1 },
  avgCompletionTime: 5,
  lastActivity: new Date(),
};

const mockProjects = [
  { id: 'e1', nom: 'CHU Paris', ville: 'Paris', statut: 'production' },
  { id: 'e2', nom: 'CHR Lyon', ville: 'Lyon', statut: 'deploiement' },
  { id: 'e3', nom: 'CHU Bordeaux', ville: 'Bordeaux', statut: 'contractuel' },
];

describe('TeamMemberCard', () => {
  it('renders member name', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={vi.fn()} />);
    expect(screen.getByText('Marie Dupont')).toBeInTheDocument();
  });

  it('renders email', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={vi.fn()} />);
    expect(screen.getByText('marie@test.com')).toBeInTheDocument();
  });

  it('renders role badge', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={vi.fn()} />);
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
  });

  it('renders fonction', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={vi.fn()} />);
    expect(screen.getByText('Directrice')).toBeInTheDocument();
  });

  it('renders completion rate', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={vi.fn()} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders overdue tasks badge', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={vi.fn()} />);
    expect(screen.getByText('2 en retard')).toBeInTheDocument();
  });

  it('renders stats grid', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={vi.fn()} />);
    expect(screen.getByText('Projets')).toBeInTheDocument();
    expect(screen.getByText('Tâches')).toBeInTheDocument();
    expect(screen.getByText('Terminées')).toBeInTheDocument();
  });

  it('renders assigned projects (max 2)', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={mockProjects} onViewDetails={vi.fn()} />);
    expect(screen.getByText('CHU Paris')).toBeInTheDocument();
    expect(screen.getByText('CHR Lyon')).toBeInTheDocument();
    expect(screen.getByText('Et 1 autre(s)...')).toBeInTheDocument();
  });

  it('renders LinkedIn link', () => {
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={vi.fn()} />);
    expect(screen.getByTitle('Voir le profil LinkedIn')).toHaveAttribute('href', 'https://linkedin.com/in/marie');
  });

  it('calls onViewDetails when button clicked', () => {
    const onViewDetails = vi.fn();
    render(<TeamMemberCard profile={mockProfile} stats={mockStats} assignedProjects={[]} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByText('Voir les détails'));
    expect(onViewDetails).toHaveBeenCalled();
  });
});
