import React, { PropsWithChildren, useState } from 'react';
import { render, screen, fireEvent, renderHook, waitForElementToBeRemoved, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisEnhancedInput } from './JarvisEnhancedInput';

const { vibrateSelectionMock } = vi.hoisted(() => ({
  vibrateSelectionMock: vi.fn(),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: vibrateSelectionMock,
}));

vi.mock('@/components/ui/button', () => {
  type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    className?: string;
  };
  const Button: React.FC<ButtonProps> = (props) => <button {...props} />;
  return { Button };
});

vi.mock('@/components/ui/textarea', () => {
  const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
    (props, ref) => <textarea ref={ref} {...props} />
  );
  Textarea.displayName = 'Textarea';
  return { Textarea };
});

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('JarvisEnhancedInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('utilise renderHook avec QueryClientProvider (sanity)', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useState(0), { wrapper });
    expect(result.current[0]).toBe(0);
  });

  it('affiche les hints et désactive le bouton envoyer quand la valeur est vide', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const wrapper = createWrapper();
    render(
      <JarvisEnhancedInput value="" onChange={onChange} onSubmit={onSubmit} />,
      { wrapper }
    );
    expect(screen.getByText(/commandes/i)).toBeInTheDocument();
    const sendBtn = screen.getByRole('button', { name: 'Chargement' });
    expect(sendBtn).toBeDisabled();
  });

  it('soumet avec Enter et vibre quand la valeur est non vide', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const wrapper = createWrapper();
    render(
      <JarvisEnhancedInput value="hello" onChange={onChange} onSubmit={onSubmit} />,
      { wrapper }
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(vibrateSelectionMock).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Shift+Enter n'appelle pas onSubmit", () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const wrapper = createWrapper();
    render(
      <JarvisEnhancedInput value="hello" onChange={onChange} onSubmit={onSubmit} />,
      { wrapper }
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(vibrateSelectionMock).not.toHaveBeenCalled();
  });

  it('désactive les boutons en état de chargement', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const onVoiceStart = vi.fn();
    const wrapper = createWrapper();
    render(
      <JarvisEnhancedInput
        value="hello"
        onChange={onChange}
        onSubmit={onSubmit}
        onVoiceStart={onVoiceStart}
        isLoading
      />,
      { wrapper }
    );
    expect(screen.getByRole('button', { name: 'Chargement' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Micro' })).toBeDisabled();
  });

  it('palette de commandes: filtrage, navigation et sélection remplacent le texte', async () => {
    const user = userEvent.setup();
    const submitSpy = vi.fn();

    type HarnessProps = {
      initialValue?: string;
      onSubmit?: () => void;
      onVoiceStart?: () => void;
      isLoading?: boolean;
      disabled?: boolean;
      isVoiceActive?: boolean;
      placeholder?: string;
      className?: string;
    };

    const Harness: React.FC<HarnessProps> = (props) => {
      const [value, setValue] = useState(props.initialValue ?? '');
      return (
        <JarvisEnhancedInput
          value={value}
          onChange={setValue}
          onSubmit={props.onSubmit ?? vi.fn()}
          onVoiceStart={props.onVoiceStart}
          isLoading={props.isLoading}
          disabled={props.disabled}
          isVoiceActive={props.isVoiceActive}
          placeholder={props.placeholder}
          className={props.className}
        />
      );
    };

    const wrapper = createWrapper();
    render(<Harness onSubmit={submitSpy} />, { wrapper });

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '/br');
    const briefingEl = await screen.findByText('Briefing');

    // Naviguer (optionnel si une seule entrée) puis sélectionner
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitForElementToBeRemoved(briefingEl);
    await waitFor(() => {
      expect((textarea as HTMLTextAreaElement).value).toBe('Quel est mon briefing du jour ?');
    });
  });

  it('le clic sur le bouton envoyer déclenche la soumission et la vibration', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const wrapper = createWrapper();
    render(
      <JarvisEnhancedInput value="Bonjour" onChange={onChange} onSubmit={onSubmit} />,
      { wrapper }
    );
    const sendBtn = screen.getByRole('button', { name: 'Chargement' });
    await user.click(sendBtn);
    expect(vibrateSelectionMock).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('affiche le compteur de caractères pour une valeur non vide', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const wrapper = createWrapper();
    render(
      <JarvisEnhancedInput value="hello" onChange={onChange} onSubmit={onSubmit} />,
      { wrapper }
    );
    expect(screen.getByText('5/2000')).toBeInTheDocument();
  });

  it('le mode disabled empêche la soumission via Enter et via le bouton', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const wrapper = createWrapper();
    render(
      <JarvisEnhancedInput value="hello" onChange={onChange} onSubmit={onSubmit} disabled />,
      { wrapper }
    );
    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();

    const sendBtn = screen.getByRole('button', { name: 'Chargement' });
    expect(sendBtn).toBeDisabled();
    await user.click(sendBtn);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('affiche le micro si onVoiceStart est fourni et déclenche onVoiceStart au clic', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const onVoiceStart = vi.fn();
    const wrapper = createWrapper();
    render(
      <JarvisEnhancedInput
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        onVoiceStart={onVoiceStart}
      />,
      { wrapper }
    );
    const micBtn = screen.getByRole('button', { name: 'Micro' });
    expect(micBtn).toBeEnabled();
    await user.click(micBtn);
    expect(vibrateSelectionMock).toHaveBeenCalledTimes(1);
    expect(onVoiceStart).toHaveBeenCalledTimes(1);
  });
});