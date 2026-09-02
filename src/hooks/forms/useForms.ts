import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/shared/use-toast';

import type { Json } from '@/integrations/supabase/types';

export interface FormField {
  id: string;
  form_id: string;
  type: string;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  options: Json;
  validation_rules: Json;
  position: number;
  created_at: string;
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  created_by?: string;
  etablissement_id?: string;
  status: 'draft' | 'published' | 'closed';
  settings: Json;
  slug?: string;
  theme_color: string;
  cover_image_url?: string;
  success_message: string;
  requires_auth: boolean;
  max_responses?: number;
  closes_at?: string;
  created_at: string;
  updated_at: string;
}

export interface FormWithFields extends Form {
  form_fields: FormField[];
}

export interface FormResponse {
  id: string;
  form_id: string;
  respondent_user_id?: string;
  respondent_email?: string;
  respondent_name?: string;
  submitted_at: string;
}

export interface FormFieldValue {
  id: string;
  response_id: string;
  field_id: string;
  value?: string;
}

export interface FormResponseWithValues extends FormResponse {
  form_field_values: FormFieldValue[];
}

export function useForms() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formsQuery = useQuery({
    queryKey: ['forms', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('id, title, description, created_by, etablissement_id, status, settings, slug, theme_color, cover_image_url, success_message, requires_auth, max_responses, closes_at, created_at, updated_at')
        .eq('created_by', user!.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Form[];
    },
    enabled: !!user,
  });

  const createForm = useMutation({
    mutationFn: async (params: { title: string; description?: string; etablissement_id?: string }) => {
      const { data, error } = await supabase
        .from('forms')
        .insert({
          title: params.title,
          description: params.description || null,
          etablissement_id: params.etablissement_id || null,
          created_by: user!.id,
        })
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data as Form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast({ title: 'Formulaire créé' });
    },
    onError: () => {
      toast({ title: 'Erreur', description: 'Impossible de créer le formulaire', variant: 'destructive' });
    },
  });

  const updateForm = useMutation({
    mutationFn: async (params: { id: string } & Partial<Record<string, unknown>>) => {
      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from('forms')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data as Form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('forms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast({ title: 'Formulaire supprimé' });
    },
  });

  return {
    forms: formsQuery.data || [],
    isLoading: formsQuery.isLoading,
    isError: formsQuery.isError,
    refetch: formsQuery.refetch,
    createForm,
    updateForm,
    deleteForm,
  };
}

export function useFormDetail(formId: string | undefined) {
  return useQuery({
    queryKey: ['form', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('*, form_fields(*)')
        .eq('id', formId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const form = data as FormWithFields;
      form.form_fields = (form.form_fields || []).sort((a, b) => a.position - b.position);
      return form;
    },
    enabled: !!formId,
  });
}

export function useFormBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['form-slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('*, form_fields(*)')
        .eq('slug', slug!)
        .eq('status', 'published')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const form = data as FormWithFields;
      form.form_fields = (form.form_fields || []).sort((a, b) => a.position - b.position);
      return form;
    },
    enabled: !!slug,
  });
}

export function useFormFields(formId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addField = useMutation({
    mutationFn: async (params: { form_id: string; type: string; label: string; required: boolean; options: Json; validation_rules: Json; position: number; description?: string; placeholder?: string }) => {
      const { data, error } = await supabase
        .from('form_fields')
        .insert(params)
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data as FormField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
  });

  const updateField = useMutation({
    mutationFn: async (params: { id: string } & Partial<Record<string, unknown>>) => {
      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from('form_fields')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single(); // safe: guaranteed-row
      if (error) throw error;
      return data as FormField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
  });

  const deleteField = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase.from('form_fields').delete().eq('id', fieldId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
  });

  const reorderFields = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('form_fields').update({ position: index }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
  });

  return { addField, updateField, deleteField, reorderFields };
}

export function useFormResponses(formId: string | undefined) {
  return useQuery({
    queryKey: ['form-responses', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_responses')
        .select('*, form_field_values(*)')
        .eq('form_id', formId!)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data as FormResponseWithValues[];
    },
    enabled: !!formId,
  });
}

export function useSubmitFormResponse() {
  return useMutation({
    mutationFn: async (params: {
      form_id: string;
      respondent_email?: string;
      respondent_name?: string;
      values: { field_id: string; value: string }[];
    }) => {
      // Create the response
      const { data: response, error: responseError } = await supabase
        .from('form_responses')
        .insert({
          form_id: params.form_id,
          respondent_email: params.respondent_email || null,
          respondent_name: params.respondent_name || null,
        })
        .select()
        .single(); // safe: guaranteed-row
      if (responseError) throw responseError;

      // Insert all field values
      if (params.values.length > 0) {
        const fieldValues = params.values.map(v => ({
          response_id: response.id,
          field_id: v.field_id,
          value: v.value,
        }));
        const { error: valuesError } = await supabase
          .from('form_field_values')
          .insert(fieldValues);
        if (valuesError) throw valuesError;
      }

      return response;
    },
  });
}
