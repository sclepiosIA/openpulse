import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'

const BodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', 'auto']).optional().default('1024x1024'),
  quality: z.enum(['low', 'medium', 'high', 'auto']).optional().default('medium'),
  n: z.number().int().min(1).max(4).optional().default(1),
  output_format: z.enum(['png', 'jpeg', 'webp']).optional().default('png'),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { prompt, size, quality, n, output_format } = parsed.data

    const endpoint = Deno.env.get('AZURE_IMAGE_ENDPOINT')
    const apiKey = Deno.env.get('AZURE_IMAGE_API_KEY')
    const deployment = Deno.env.get('AZURE_IMAGE_DEPLOYMENT') ?? 'gpt-image-2'
    if (!endpoint || !apiKey) {
      return new Response(JSON.stringify({ error: 'Image service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    let azureRes: Response
    try {
      azureRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: deployment,
          prompt,
          size,
          quality,
          n,
          output_format,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (azureRes.status === 429) {
        await new Promise((r) => setTimeout(r, 1500))
        azureRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model: deployment, prompt, size, quality, n, output_format }),
        })
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err?.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Image generation timeout (120s)' }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw err
    }

    if (!azureRes.ok) {
      const text = await azureRes.text()
      console.error('Azure image error', azureRes.status, text)
      let azureError: any = null
      try {
        azureError = JSON.parse(text)
      } catch {
        /* ignore */
      }
      const azMsg: string | undefined = azureError?.error?.message
      const azCode: string | undefined = azureError?.error?.code
      const isModeration = azCode === 'moderation_blocked' || azCode === 'content_policy_violation'
      const userMessage = isModeration
        ? 'Votre demande a été bloquée par le filtre de sécurité Azure. Reformulez le prompt sans contenu sensible.'
        : (azMsg ?? "Échec de la génération d'image")
      return new Response(
        JSON.stringify({
          error: userMessage,
          code: azCode ?? null,
          upstream_status: azureRes.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await azureRes.json()
    // Normalize: return images as data URLs
    const mime =
      output_format === 'jpeg'
        ? 'image/jpeg'
        : output_format === 'webp'
          ? 'image/webp'
          : 'image/png'
    const images = (data?.data ?? []).map((d: any) => {
      if (d.b64_json) return { dataUrl: `data:${mime};base64,${d.b64_json}`, b64_json: d.b64_json }
      if (d.url) return { url: d.url }
      return d
    })

    return new Response(JSON.stringify({ images, usage: data?.usage ?? null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('generate-image error', error)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
