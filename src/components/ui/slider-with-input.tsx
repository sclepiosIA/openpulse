import { useState, useRef, useCallback, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SliderWithInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  secondaryValue?: string;
  /** Si fourni, permet de cliquer sur la valeur secondaire pour la modifier directement */
  onSecondaryValueChange?: (absoluteValue: number) => void;
  /** Permet d'extraire la valeur numérique depuis secondaryValue pour l'édition */
  secondaryValueParser?: (secondaryValue: string) => number;
  variant?: 'default' | 'primary';
  size?: 'sm' | 'md';
  className?: string;
}

export function SliderWithInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '%',
  secondaryValue,
  onSecondaryValueChange,
  secondaryValueParser,
  variant = 'default',
  size = 'md',
  className,
}: SliderWithInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  
  // État pour l'édition de la valeur secondaire (UHCD)
  const [isEditingSecondary, setIsEditingSecondary] = useState(false);
  const [secondaryInputValue, setSecondaryInputValue] = useState('');
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  // Sync input value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString());
    }
  }, [value, isEditing]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setInputValue(value.toString());
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  }, [value]);

  const clampValue = useCallback((val: number) => {
    return Math.min(max, Math.max(min, val));
  }, [min, max]);

  const commitValue = useCallback(() => {
    // Support French comma decimal separator
    const normalized = inputValue.replace(',', '.');
    const parsed = parseFloat(normalized);
    
    if (!isNaN(parsed)) {
      const clamped = clampValue(parsed);
      onChange(clamped);
      setInputValue(clamped.toString());
    } else {
      // Reset to current value if invalid
      setInputValue(value.toString());
    }
    setIsEditing(false);
  }, [inputValue, clampValue, onChange, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue(value.toString());
      setIsEditing(false);
    }
  }, [commitValue, value]);

  const handleSliderChange = useCallback(([v]: number[]) => {
    onChange(v);
  }, [onChange]);

  const formatDisplayValue = (val: number) => {
    // Show one decimal if the value has decimals
    if (val % 1 !== 0) {
      return val.toFixed(1);
    }
    return val.toString();
  };

  // Handlers pour édition de la valeur secondaire (UHCD absolu)
  const handleStartEditSecondary = useCallback(() => {
    if (!onSecondaryValueChange || !secondaryValue) return;
    
    // Extraire la valeur numérique
    const numericValue = secondaryValueParser 
      ? secondaryValueParser(secondaryValue)
      : parseInt(secondaryValue.replace(/[^\d]/g, ''), 10);
    
    setSecondaryInputValue(numericValue.toString());
    setIsEditingSecondary(true);
    setTimeout(() => {
      secondaryInputRef.current?.select();
    }, 0);
  }, [onSecondaryValueChange, secondaryValue, secondaryValueParser]);

  const commitSecondaryValue = useCallback(() => {
    const normalized = secondaryInputValue.replace(',', '.').replace(/\s/g, '');
    const parsed = parseInt(normalized, 10);
    
    if (!isNaN(parsed) && parsed >= 0 && onSecondaryValueChange) {
      onSecondaryValueChange(parsed);
    }
    setIsEditingSecondary(false);
  }, [secondaryInputValue, onSecondaryValueChange]);

  const handleSecondaryKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitSecondaryValue();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingSecondary(false);
    }
  }, [commitSecondaryValue]);

  const sliderClassName = cn(
    size === 'sm' 
      ? '[&_[role=slider]]:h-3 [&_[role=slider]]:w-3' 
      : '[&_[role=slider]]:h-4 [&_[role=slider]]:w-4',
    variant === 'primary' && '[&_[role=slider]]:border-primary [&_[role=slider]]:bg-primary'
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* Editable value badge */}
      <div className="flex items-center justify-center">
        {isEditing ? (
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitValue}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-20 h-8 text-center font-semibold tabular-nums',
              variant === 'primary' && 'border-primary focus-visible:ring-primary'
            )}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={handleStartEdit}
            className={cn(
              'px-3 py-1 rounded-md font-semibold tabular-nums transition-all cursor-text',
              'hover:ring-2 hover:ring-offset-1',
              size === 'sm' ? 'text-sm' : 'text-base',
              variant === 'primary' 
                ? 'bg-primary/10 text-primary hover:ring-primary/50' 
                : 'bg-muted hover:ring-muted-foreground/30'
            )}
          >
            {formatDisplayValue(value)}{unit}
          </button>
        )}
      </div>

      {/* Slider */}
      <Slider
        value={[value]}
        onValueChange={handleSliderChange}
        min={min}
        max={max}
        step={step}
        className={sliderClassName}
      />

      {/* Range labels + secondary value */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}{unit}</span>
        {secondaryValue && (
          isEditingSecondary ? (
            <Input
              ref={secondaryInputRef}
              type="text"
              value={secondaryInputValue}
              onChange={(e) => setSecondaryInputValue(e.target.value)}
              onBlur={commitSecondaryValue}
              onKeyDown={handleSecondaryKeyDown}
              className="w-24 h-6 text-center text-xs font-medium border-primary"
              autoFocus
            />
          ) : onSecondaryValueChange ? (
            <button
              type="button"
              onClick={handleStartEditSecondary}
              className="font-medium text-foreground/70 hover:text-primary hover:underline cursor-text transition-colors"
            >
              {secondaryValue}
            </button>
          ) : (
            <span className="font-medium text-foreground/70">{secondaryValue}</span>
          )
        )}
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
