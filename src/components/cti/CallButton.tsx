import { Phone } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useCallContext } from '@/contexts/CallContext';
import type { CallTarget } from '@/types/calls';
import { cn } from '@/lib/utils';

interface CallButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  phoneNumber?: string | null;
  displayName?: string;
  contactId?: string;
  etablissementId?: string;
  prospectId?: string;
  label?: string;
  iconOnly?: boolean;
}

export function CallButton({
  phoneNumber, displayName, contactId, etablissementId, prospectId,
  label = 'Appeler', iconOnly = false, className, variant = 'outline', size = 'sm',
  ...rest
}: CallButtonProps) {
  const { startCall } = useCallContext();
  const disabled = !phoneNumber || rest.disabled;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!phoneNumber) return;
    const target: CallTarget = { phoneNumber, displayName, contactId, etablissementId, prospectId };
    startCall(target);
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={handleClick}
      className={cn(iconOnly && 'h-8 w-8 p-0', className)}
      title={phoneNumber ? `${label} ${phoneNumber}` : 'Numéro indisponible'}
      {...rest}
    >
      <Phone className={cn('h-4 w-4', !iconOnly && 'mr-2')} />
      {!iconOnly && label}
    </Button>
  );
}
