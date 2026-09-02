import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeSupabaseError } from "@/lib/supabaseErrorSanitizer";
import {
  createApplicationError,
  type ResetPasswordData,
  type ResetPasswordResult,
} from "@/types/admin";

export function useAdminResetPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ResetPasswordData): Promise<ResetPasswordResult> => {
      const { data: result, error } = await supabase.functions.invoke<ResetPasswordResult>(
        'admin-reset-user-password', 
        {
          body: {
            userId: data.userId,
            newPassword: data.newPassword,
          },
        }
      );

      if (error) {
        throw error;
      }
      
      if (result && !result.success && result.error) {
        throw createApplicationError(result.error, result.details);
      }

      return result!;
    },
    onSuccess: (data) => {
      toast.success("Mot de passe réinitialisé", {
        description: data.message,
      });
      
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profilesWithRoles'] });
    },
    onError: (error: Error) => {
      toast.error(sanitizeSupabaseError(error));
    },
  });
}

const UINT32_RANGE = 0x1_0000_0000;
const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;

function secureRandomIndex(size: number): number {
  const values = new Uint32Array(1);
  const unbiasedLimit = Math.floor(UINT32_RANGE / size) * size;

  do {
    globalThis.crypto.getRandomValues(values);
  } while (values[0] >= unbiasedLimit);

  return values[0] % size;
}

// Générateur de mot de passe sécurisé
export function generateSecurePassword(length: number = 12): string {
  const uppercaseChars = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghjkmnpqrstuvwxyz';
  const numberChars = '23456789';
  const specialChars = '!@#$%&*';
  const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
  const targetLength = Math.floor(length);
  if (
    !Number.isFinite(length) ||
    targetLength < MIN_PASSWORD_LENGTH ||
    targetLength > MAX_PASSWORD_LENGTH
  ) {
    throw new RangeError(
      `La longueur du mot de passe doit être comprise entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH}.`
    );
  }
  const pick = (chars: string) => chars.charAt(secureRandomIndex(chars.length));

  const password = [
    pick(uppercaseChars),
    pick(lowercaseChars),
    pick(numberChars),
    pick(specialChars),
  ];

  while (password.length < targetLength) {
    password.push(pick(allChars));
  }

  // Fisher-Yates avec CSPRNG pour éviter le biais de sort(() => random - 0.5).
  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }

  return password.join('');
}
