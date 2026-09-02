import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { VoiceDictationButton } from '../VoiceDictationButton';

describe('VoiceDictationButton', () => {
  const wrap = (ui: React.ReactElement) => <TooltipProvider>{ui}</TooltipProvider>;

  it('renders idle state', () => {
    render(wrap(<VoiceDictationButton isRecording={false} isProcessing={false} audioLevel={0} onClick={vi.fn()} />));
    expect(screen.getByLabelText('Dictée vocale')).toBeInTheDocument();
  });

  it('renders recording state', () => {
    render(wrap(<VoiceDictationButton isRecording={true} isProcessing={false} audioLevel={0.5} onClick={vi.fn()} />));
    expect(screen.getByLabelText('Arrêter la dictée')).toBeInTheDocument();
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(wrap(<VoiceDictationButton isRecording={false} isProcessing={false} audioLevel={0} onClick={onClick} />));
    fireEvent.click(screen.getByLabelText('Dictée vocale'));
    expect(onClick).toHaveBeenCalled();
  });

  it('disables when processing', () => {
    render(wrap(<VoiceDictationButton isRecording={false} isProcessing={true} audioLevel={0} onClick={vi.fn()} />));
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
