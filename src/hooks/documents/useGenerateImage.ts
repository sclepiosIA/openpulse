import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export type GenerateImageOptions = {
  prompt: string
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto'
  quality?: 'low' | 'medium' | 'high' | 'auto'
  n?: number
  output_format?: 'png' | 'jpeg' | 'webp'
}

export type GeneratedImage = {
  dataUrl?: string
  b64_json?: string
  url?: string
}

/**
 * Génère une ou plusieurs images via Azure gpt-image-2 (edge function `generate-image`).
 */
export function useGenerateImage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async (opts: GenerateImageOptions): Promise<GeneratedImage[]> => {
    setIsGenerating(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-image', {
        body: opts,
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      if (!data?.images) throw new Error('Aucune image renvoyée')
      return data.images as GeneratedImage[]
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur de génération'
      setError(msg)
      throw e
    } finally {
      setIsGenerating(false)
    }
  }

  return { generate, isGenerating, error }
}
