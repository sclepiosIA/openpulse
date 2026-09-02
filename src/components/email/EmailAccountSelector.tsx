import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { fromExtended } from "@/lib/supabaseTyped";
import { useCurrentProfile } from "@/hooks/profile/useProfiles";
import type { UserEmailAccountSafeRow } from "@/types/supabase-extensions";

interface EmailAccountSelectorProps {
  value: string;
  onChange: (accountId: string) => void;
}

export function EmailAccountSelector({ value, onChange }: EmailAccountSelectorProps) {
  const { data: profile } = useCurrentProfile();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['user-email-accounts', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await fromExtended('user_email_accounts_safe')
        .select('id, email_address, is_active, profile_id, is_shared')
        .eq('is_active', true)
        .or(`profile_id.eq.${profile.id},is_shared.eq.true`)
        .order('email_address');

      if (error) throw error;
      return (data as unknown) as UserEmailAccountSafeRow[];
    },
    enabled: !!profile?.id,
  });

  if (isLoading || !accounts || accounts.length === 0) {
    return null;
  }

  if (accounts.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0 max-w-[40vw] sm:max-w-[320px]">
        <Mail className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{accounts[0].email_address}</span>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px] sm:w-[280px] min-w-0">
        <SelectValue placeholder="Sélectionner un compte" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account: { id: string; email_address: string }) => (
          <SelectItem key={account.id} value={account.id}>
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{account.email_address}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
