import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDeleteRecurringDialog } from './EventDeleteRecurringDialog';

const { ICON_COMPONENT } = vi.hoisted(() => ({
  ICON_COMPONENT: () => null,
}));

vi.mock('lucide-react', () => ({
  Repeat: ICON_COMPONENT,
}));

const {
  MockAlertDialog,
  MockAlertDialogContent,
  MockAlertDialogHeader,
  MockAlertDialogTitle,
  MockAlertDialogDescription,
  MockAlertDialogFooter,
  MockAlertDialogAction,
  MockAlertDialogCancel,
} = vi.hoisted(() => {
  const MockAlertDialog = ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div data-testid="alert-dialog-root" data-open={open} onClick={() => onOpenChange(open)}>
      {children}
    </div>
  );
  const MockAlertDialogContent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  );
  const MockAlertDialogHeader = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-header">{children}</div>
  );
  const MockAlertDialogTitle = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <h1 data-testid="alert-dialog-title" data-class={className}>
      {children}
    </h1>
  );
  const MockAlertDialogDescription = ({ children }: { children: React.ReactNode }) => (
    <p data-testid="alert-dialog-description">{children}</p>
  );
  const MockAlertDialogFooter = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="alert-dialog-footer" data-class={className}>
      {children}
    </div>
  );
  const MockAlertDialogAction = ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button data-testid="alert-dialog-action" data-class={className} onClick={onClick}>
      {children}
    </button>
  );
  const MockAlertDialogCancel = ({ children }: { children: React.ReactNode }) => (
    <button data-testid="alert-dialog-cancel">{children}</button>
  );

  return {
    MockAlertDialog,
    MockAlertDialogContent,
    MockAlertDialogHeader,
    MockAlertDialogTitle,
    MockAlertDialogDescription,
    MockAlertDialogFooter,
    MockAlertDialogAction,
    MockAlertDialogCancel,
  };
});

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: MockAlertDialog,
  AlertDialogContent: MockAlertDialogContent,
  AlertDialogHeader: MockAlertDialogHeader,
  AlertDialogTitle: MockAlertDialogTitle,
  AlertDialogDescription: MockAlertDialogDescription,
  AlertDialogFooter: MockAlertDialogFooter,
  AlertDialogAction: MockAlertDialogAction,
  AlertDialogCancel: MockAlertDialogCancel,
}));

describe('EventDeleteRecurringDialog', () => {
  it('affiche le contenu correct lorsque open=true', () => {
    const onOpenChange = vi.fn();
    const onDeleteSingle = vi.fn();
    const onDeleteAll = vi.fn();

    render(
      <EventDeleteRecurringDialog
        open={true}
        onOpenChange={onOpenChange}
        onDeleteSingle={onDeleteSingle}
        onDeleteAll={onDeleteAll}
      />,
    );

    const root = screen.getByTestId('alert-dialog-root');
    expect(root.getAttribute('data-open')).toBe('true');

    expect(screen.getByText('Supprimer un événement récurrent')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cet événement fait partie d'une série récurrente. Que souhaitez-vous supprimer ?",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Annuler')).toBeInTheDocument();
    expect(screen.getByText('Cette occurrence uniquement')).toBeInTheDocument();
    expect(screen.getByText('Toute la série')).toBeInTheDocument();

    const title = screen.getByTestId('alert-dialog-title');
    expect(title.getAttribute('data-class')).toContain('flex');
    expect(title.getAttribute('data-class')).toContain('items-center');

    const footer = screen.getByTestId('alert-dialog-footer');
    expect(footer.getAttribute('data-class')).toContain('flex-col');
  });

  it('passe correctement la prop open et déclenche onOpenChange via le wrapper', () => {
    const onOpenChange = vi.fn();
    const onDeleteSingle = vi.fn();
    const onDeleteAll = vi.fn();

    render(
      <EventDeleteRecurringDialog
        open={false}
        onOpenChange={onOpenChange}
        onDeleteSingle={onDeleteSingle}
        onDeleteAll={onDeleteAll}
      />,
    );

    const root = screen.getByTestId('alert-dialog-root');
    expect(root.getAttribute('data-open')).toBe('false');

    fireEvent.click(root);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('appelle onDeleteSingle quand on clique sur "Cette occurrence uniquement"', () => {
    const onOpenChange = vi.fn();
    const onDeleteSingle = vi.fn();
    const onDeleteAll = vi.fn();

    render(
      <EventDeleteRecurringDialog
        open={true}
        onOpenChange={onOpenChange}
        onDeleteSingle={onDeleteSingle}
        onDeleteAll={onDeleteAll}
      />,
    );

    const buttonSingle = screen.getByText('Cette occurrence uniquement');
    fireEvent.click(buttonSingle);

    expect(onDeleteSingle).toHaveBeenCalledTimes(1);
    expect(onDeleteAll).not.toHaveBeenCalled();
  });

  it('appelle onDeleteAll quand on clique sur "Toute la série"', () => {
    const onOpenChange = vi.fn();
    const onDeleteSingle = vi.fn();
    const onDeleteAll = vi.fn();

    render(
      <EventDeleteRecurringDialog
        open={true}
        onOpenChange={onOpenChange}
        onDeleteSingle={onDeleteSingle}
        onDeleteAll={onDeleteAll}
      />,
    );

    const buttonAll = screen.getByText('Toute la série');
    fireEvent.click(buttonAll);

    expect(onDeleteAll).toHaveBeenCalledTimes(1);
    expect(onDeleteSingle).not.toHaveBeenCalled();
  });

  it("n'appelle pas les callbacks de suppression quand on clique sur Annuler", () => {
    const onOpenChange = vi.fn();
    const onDeleteSingle = vi.fn();
    const onDeleteAll = vi.fn();

    render(
      <EventDeleteRecurringDialog
        open={true}
        onOpenChange={onOpenChange}
        onDeleteSingle={onDeleteSingle}
        onDeleteAll={onDeleteAll}
      />,
    );

    const cancelButton = screen.getByText('Annuler');
    fireEvent.click(cancelButton);

    expect(onDeleteSingle).not.toHaveBeenCalled();
    expect(onDeleteAll).not.toHaveBeenCalled();
  });
});