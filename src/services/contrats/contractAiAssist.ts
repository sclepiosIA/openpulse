import { supabase } from '@/integrations/supabase/client';

export interface ContractAiAssistParams {
  action: string;
  content: string;
  sectionTitle?: string;
  customPrompt?: string;
}

export interface ContractAiAssistResult {
  result?: string;
  error?: string;
}

export async function callContractAiAssist(
  params: ContractAiAssistParams,
): Promise<ContractAiAssistResult> {
  const { data, error } = await supabase.functions.invoke('contract-ai-assist', {
    body: params,
  });
  if (error) throw error;
  return (data ?? {}) as ContractAiAssistResult;
}
