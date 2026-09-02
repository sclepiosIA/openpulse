import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { sanitizeErrorForClient } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version;

// Forum public anonyme : utilisé par des utilisateurs externes (post-émargement)
// non authentifiés Supabase. On ne peut donc pas exiger de JWT.
// Mitigations : limites strictes de taille + validation stricte des thèmes.
const MAX_TITRE = 200;
const MAX_CONTENU = 5000;
const MAX_AUTHOR_FIELD = 100;
const ALLOWED_THEMES = new Set([
  'pmsi', 'smr', 'urgences', 'completion_dossier', 'dictee_vocale',
  'astuces', 'bugs', 'support', 'autre'
]);

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body as { action: string };

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (action === 'create_post') {
      const titre = clean(body.titre, MAX_TITRE);
      const contenu = clean(body.contenu, MAX_CONTENU);
      const theme = typeof body.theme === 'string' && ALLOWED_THEMES.has(body.theme) ? body.theme : 'autre';

      if (!titre || !contenu) {
        return new Response(JSON.stringify({ error: 'titre et contenu requis' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await serviceClient.from('forum_posts').insert({
        titre,
        contenu,
        theme,
        visibilite: 'publique',
        author_nom: clean(body.author_nom, MAX_AUTHOR_FIELD),
        author_prenom: clean(body.author_prenom, MAX_AUTHOR_FIELD),
        author_etablissement_nom: clean(body.author_etablissement_nom, MAX_AUTHOR_FIELD),
        upvotes: 0,
        nombre_commentaires: 0,
      }).select('id').single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'create_comment') {
      const post_id = typeof body.post_id === 'string' ? body.post_id : null;
      const contenu = clean(body.contenu, MAX_CONTENU);

      if (!post_id || !contenu) {
        return new Response(JSON.stringify({ error: 'post_id et contenu requis' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error: commentError } = await serviceClient.from('forum_comments').insert({
        post_id,
        contenu,
        author_nom: clean(body.author_nom, MAX_AUTHOR_FIELD),
        author_prenom: clean(body.author_prenom, MAX_AUTHOR_FIELD),
        author_etablissement_nom: clean(body.author_etablissement_nom, MAX_AUTHOR_FIELD),
        upvotes: 0,
      });

      if (commentError) throw commentError;

      const { data: post } = await serviceClient
        .from('forum_posts')
        .select('nombre_commentaires')
        .eq('id', post_id)
        .single();

      await serviceClient
        .from('forum_posts')
        .update({ nombre_commentaires: (post?.nombre_commentaires || 0) + 1 })
        .eq('id', post_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'upvote_post') {
      const post_id = typeof body.post_id === 'string' ? body.post_id : null;
      if (!post_id) {
        return new Response(JSON.stringify({ error: 'post_id requis' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: post } = await serviceClient.from('forum_posts').select('upvotes').eq('id', post_id).single();
      await serviceClient.from('forum_posts').update({ upvotes: (post?.upvotes || 0) + 1 }).eq('id', post_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'upvote_comment') {
      const comment_id = typeof body.comment_id === 'string' ? body.comment_id : null;
      if (!comment_id) {
        return new Response(JSON.stringify({ error: 'comment_id requis' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: comment } = await serviceClient.from('forum_comments').select('upvotes').eq('id', comment_id).single();
      await serviceClient.from('forum_comments').update({ upvotes: (comment?.upvotes || 0) + 1 }).eq('id', comment_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: `Action inconnue: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('forum-actions error:', error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
