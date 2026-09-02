import { supabase } from '@/integrations/supabase/client';

export async function fetchIsAdminForAuthUser(authUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();
  return data?.role === 'admin';
}
