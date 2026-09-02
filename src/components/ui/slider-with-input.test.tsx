import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SliderWithInput } from './slider-with-input';

const {
  sliderPropsSpy,
  inputPropsSpy,
  cnSpy,
} = vi.hoisted(() => ({
  sliderPropsSpy: vi.fn(),
  inputPropsSpy: vi.fn(),
  cnSpy: vi.fn((...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ')
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: (props: {
    value: number[];
    onValueChange: (value: number[]) => void;
    min: number;
    max: number;
    step?: number;
    className?: string;
  }) => {
    sliderPropsSpy(props);
    return (
      <button
        type="button"
        data-testid="mock-slider"
        data-value={props.value[0]}
        data-min={props.min}
        data-max={props.max}
        data-step={props.step}
        data-class={props.className}
        onClick={() => props.onValueChange([props.value[0] + (props.step ?? 1)])}
      >
        slider
      </button>
    );
  },
}));

vi.mock('@/components/ui/input', async () => {
  const ReactModule = await import('react');
  return {
    Input: ReactModule.forwardRef<
      HTMLInputElement,
      React.InputHTMLAttributes<HTMLInputElement>
    >(function MockInput(props, ref) {
      inputPropsSpy(props);
      return <input ref={ref} data-testid="mock-input" {...props} />;
    }),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: cnSpy,
}));

describe('SliderWithInput', () => {
  beforeEach(() => {
    sliderPropsSpy.mockClear();
    inputPropsSpy.mockClear();
    cnSpy.mockClear();
  });

  it('affiche la valeur formatée, les bornes et transmet les props au slider', () => {
    const onChange = vi.fn();

    render(
      <SliderWithInput
        value={12.5}
        onChange={onChange}
        min={0}
        max={100}
        step={0.5}
        unit="%"
        variant="primary"
        size="sm"
        className="custom-class"
      />
    );

    expect(screen.getByRole('button', { name: '12.5%' })).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    const slider = screen.getByTestId('mock-slider');
    expect(slider).toHaveAttribute('data-value', '12.5');
    expect(slider).toHaveAttribute('data-min', '0');
    expect(slider).toHaveAttribute('data-max', '100');
    expect(slider).toHaveAttribute('data-step', '0.5');

    expect(sliderPropsSpy).toHaveBeenCalled();
    const lastCall = sliderPropsSpy.mock.calls.at(-1);
    expect(lastCall?.[0].value).toEqual([12.5]);
    expect(lastCall?.[0].min).toBe(0);
    expect(lastCall?.[0].max).toBe(100);
    expect(lastCall?.[0].step).toBe(0.5);
    expect(String(lastCall?.[0].className)).toContain('[&_[role=slider]]:h-3');
    expect(String(lastCall?.[0].className)).toContain('border-primary');
  });

  it('déclenche onChange depuis le slider avec la nouvelle valeur', () => {
    const onChange = vi.fn();

    render(
      <SliderWithInput
        value={10}
        onChange={onChange}
        min={0}
        max={20}
        step={2}
      />
    );

    fireEvent.click(screen.getByTestId('mock-slider'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('permet d’éditer la valeur principale et valide avec Enter en supportant la virgule', async () => {
    const onChange = vi.fn();

    render(
      <SliderWithInput
        value={10}
        onChange={onChange}
        min={0}
        max={100}
        unit="%"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '10%' }));

    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: '12,5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(12.5);
    });

    expect(screen.queryByTestId('mock-input')).not.toBeInTheDocument();
  });

  it('clamp la valeur saisie au maximum puis réaffiche la valeur bornée après rerender', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SliderWithInput
        value={10}
        onChange={onChange}
        min={0}
        max={50}
        unit="%"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '10%' }));
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(50);
    });

    rerender(
      <SliderWithInput
        value={50}
        onChange={onChange}
        min={0}
        max={50}
        unit="%"
      />
    );

    expect(screen.getByRole('button', { name: '50%' })).toBeInTheDocument();
  });

  it('annule l’édition principale avec Escape sans appeler onChange', () => {
    const onChange = vi.fn();

    render(
      <SliderWithInput
        value={33}
        onChange={onChange}
        min={0}
        max={100}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '33%' }));
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '33%' })).toBeInTheDocument();
  });

  it('réinitialise la valeur invalide sur blur sans appeler onChange', () => {
    const onChange = vi.fn();

    render(
      <SliderWithInput
        value={42}
        onChange={onChange}
        min={0}
        max={100}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '42%' }));
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '42%' })).toBeInTheDocument();
  });

  it('affiche la valeur secondaire en lecture seule si aucun callback de modification n’est fourni', () => {
    render(
      <SliderWithInput
        value={20}
        onChange={vi.fn()}
        min={0}
        max={100}
        secondaryValue="1500 UHCD"
      />
    );

    expect(screen.getByText('1500 UHCD')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1500 UHCD' })).not.toBeInTheDocument();
  });

  it('permet d’éditer la valeur secondaire et appelle onSecondaryValueChange avec la valeur parsée par défaut', async () => {
    const onSecondaryValueChange = vi.fn();

    render(
      <SliderWithInput
        value={20}
        onChange={vi.fn()}
        min={0}
        max={100}
        secondaryValue="1 500 UHCD"
        onSecondaryValueChange={onSecondaryValueChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '1 500 UHCD' }));

    const input = screen.getByTestId('mock-input');
    expect(input).toHaveValue('1500');

    fireEvent.change(input, { target: { value: '2200' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onSecondaryValueChange).toHaveBeenCalledWith(2200);
    });
  });

  it('utilise secondaryValueParser quand il est fourni', async () => {
    const onSecondaryValueChange = vi.fn();
    const secondaryValueParser = vi.fn((value: string) => Number(value.replace('pts', '').trim()));

    render(
      <SliderWithInput
        value={20}
        onChange={vi.fn()}
        min={0}
        max={100}
        secondaryValue="345 pts"
        onSecondaryValueChange={onSecondaryValueChange}
        secondaryValueParser={secondaryValueParser}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '345 pts' }));

    await waitFor(() => {
      expect(secondaryValueParser).toHaveBeenCalledWith('345 pts');
    });

    const input = screen.getByTestId('mock-input');
    expect(input).toHaveValue('345');

    fireEvent.change(input, { target: { value: '400' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onSecondaryValueChange).toHaveBeenCalledWith(400);
    });
  });

  it('ignore une valeur secondaire invalide ou négative et ferme l’édition', () => {
    const onSecondaryValueChange = vi.fn();

    render(
      <SliderWithInput
        value={20}
        onChange={vi.fn()}
        min={0}
        max={100}
        secondaryValue="100 UHCD"
        onSecondaryValueChange={onSecondaryValueChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '100 UHCD' }));
    let input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSecondaryValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '100 UHCD' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '100 UHCD' }));
    input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: 'texte' } });
    fireEvent.blur(input);

    expect(onSecondaryValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '100 UHCD' })).toBeInTheDocument();
  });

  it('annule l’édition secondaire avec Escape', () => {
    const onSecondaryValueChange = vi.fn();

    render(
      <SliderWithInput
        value={20}
        onChange={vi.fn()}
        min={0}
        max={100}
        secondaryValue="250 UHCD"
        onSecondaryValueChange={onSecondaryValueChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '250 UHCD' }));
    const input = screen.getByTestId('mock-input');
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onSecondaryValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '250 UHCD' })).toBeInTheDocument();
  });
});