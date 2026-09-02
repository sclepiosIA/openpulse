-- ===========================================================================
-- Tableau blanc collaboratif (module « Notes »)
--
-- POURQUOI CE FICHIER EXISTE
-- Le module Notes de la distribution etait fige a l'instantane d'extraction du
-- 2026-08-17 : une page de pense-betes. Le tableau blanc — canevas, portees
-- personnelle / equipe / entreprise, commentaires, versions, bibliotheque et
-- mode presentation — a ete construit en amont les 28 et 30 aout, donc apres.
-- Ce fichier consolide les six migrations amont qui le portent, dans leur
-- ordre chronologique, et les rend rejouables : l'installateur applique les
-- schemas en sequence et s'arrete a la premiere erreur, donc une politique
-- deja posee ferait echouer toute l'installation.
--
-- SIX TABLES, TOUTES AVEC SECURITE AU NIVEAU LIGNE ET POLITIQUES :
--   whiteboards               les tableaux, avec leur portee et leur scene
--   whiteboard_shares         les partages nominatifs
--   whiteboard_comments       les fils de commentaires ancres
--   whiteboard_comment_replies  les reponses
--   whiteboard_versions       l'historique des versions
--   whiteboard_library_items  la bibliotheque d'elements reutilisables
--
-- Depend de `public.update_updated_at_column()`, definie dans le schema de
-- base, et de `public.user_roles` pour les tableaux d'equipe.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Origine amont : supabase/migrations/20260724105501_29737d59-7b11-4801-bb7a-f4ce46aa6532.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whiteboards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nouveau tableau',
  scene jsonb NOT NULL DEFAULT '{"elements":[],"appState":{},"files":{}}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whiteboards_owner ON public.whiteboards(owner_id);
CREATE INDEX IF NOT EXISTS idx_whiteboards_shared ON public.whiteboards(is_shared) WHERE is_shared = true;

CREATE TABLE IF NOT EXISTS public.whiteboard_shares (
  whiteboard_id uuid NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'edit' CHECK (permission IN ('view','edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (whiteboard_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_whiteboard_shares_user ON public.whiteboard_shares(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboards TO authenticated;
GRANT ALL ON public.whiteboards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_shares TO authenticated;
GRANT ALL ON public.whiteboard_shares TO service_role;

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_shares ENABLE ROW LEVEL SECURITY;

-- Whiteboards policies
DROP POLICY IF EXISTS "Owner full access" ON public.whiteboards;
CREATE POLICY "Owner full access" ON public.whiteboards
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Shared users can view" ON public.whiteboards;
CREATE POLICY "Shared users can view" ON public.whiteboards
  FOR SELECT USING (
    is_shared = true
    OR EXISTS (
      SELECT 1 FROM public.whiteboard_shares s
      WHERE s.whiteboard_id = whiteboards.id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Shared editors can update" ON public.whiteboards;
CREATE POLICY "Shared editors can update" ON public.whiteboards
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.whiteboard_shares s
      WHERE s.whiteboard_id = whiteboards.id AND s.user_id = auth.uid() AND s.permission = 'edit'
    )
  );

-- Whiteboard shares policies
DROP POLICY IF EXISTS "Owner manages shares" ON public.whiteboard_shares;
CREATE POLICY "Owner manages shares" ON public.whiteboard_shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.whiteboards w WHERE w.id = whiteboard_id AND w.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.whiteboards w WHERE w.id = whiteboard_id AND w.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users see their own shares" ON public.whiteboard_shares;
CREATE POLICY "Users see their own shares" ON public.whiteboard_shares
  FOR SELECT USING (user_id = auth.uid());

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_whiteboards_updated_at ON public.whiteboards;
CREATE TRIGGER trg_whiteboards_updated_at
  BEFORE UPDATE ON public.whiteboards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Origine amont : supabase/migrations/20260724193223_246d9bea-7fce-44c3-9899-e052be9c0df3.sql
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_whiteboard_owner(_wid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.whiteboards WHERE id = _wid AND owner_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_whiteboard_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_whiteboard_owner(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Owner manages shares" ON public.whiteboard_shares;
DROP POLICY IF EXISTS "Owner manages shares" ON public.whiteboard_shares;
CREATE POLICY "Owner manages shares" ON public.whiteboard_shares
  FOR ALL TO authenticated
  USING (public.is_whiteboard_owner(whiteboard_id))
  WITH CHECK (public.is_whiteboard_owner(whiteboard_id));

-- ---------------------------------------------------------------------------
-- Origine amont : supabase/migrations/20260725165243_ae139373-ad7e-46e8-842f-2552e5b403c5.sql
-- ---------------------------------------------------------------------------
ALTER TABLE public.whiteboards
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS team_role text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'board';

DO $$ BEGIN
  ALTER TABLE public.whiteboards ADD CONSTRAINT whiteboards_scope_chk CHECK (scope IN ('personal','team','company'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.whiteboards ADD CONSTRAINT whiteboards_kind_chk CHECK (kind IN ('board','presentation'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Les anciens tableaux "is_shared" deviennent des tableaux d'entreprise
UPDATE public.whiteboards SET scope = 'company' WHERE is_shared = true AND scope = 'personal';

CREATE INDEX IF NOT EXISTS idx_whiteboards_scope ON public.whiteboards(scope, team_role, kind);

-- Accès : membre de l'équipe correspondante, ou admin/direction
CREATE OR REPLACE FUNCTION public.can_access_team_whiteboard(_team text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT _team IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (ur.role::text = _team OR ur.role::text IN ('admin','direction'))
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_team_whiteboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_team_whiteboard(text) TO authenticated;

DROP POLICY IF EXISTS "Company whiteboards readable by all" ON public.whiteboards;
DROP POLICY IF EXISTS "Company whiteboards readable by all" ON public.whiteboards;
CREATE POLICY "Company whiteboards readable by all" ON public.whiteboards
  FOR SELECT TO authenticated
  USING (scope = 'company' OR (scope = 'team' AND public.can_access_team_whiteboard(team_role)));

DROP POLICY IF EXISTS "Company whiteboards writable by all" ON public.whiteboards;
DROP POLICY IF EXISTS "Company whiteboards writable by all" ON public.whiteboards;
CREATE POLICY "Company whiteboards writable by all" ON public.whiteboards
  FOR UPDATE TO authenticated
  USING (scope = 'company' OR (scope = 'team' AND public.can_access_team_whiteboard(team_role)))
  WITH CHECK (scope = 'company' OR (scope = 'team' AND public.can_access_team_whiteboard(team_role)));

DROP POLICY IF EXISTS "Company whiteboards insertable by all" ON public.whiteboards;
DROP POLICY IF EXISTS "Company whiteboards insertable by all" ON public.whiteboards;
CREATE POLICY "Company whiteboards insertable by all" ON public.whiteboards
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (scope = 'company' OR (scope = 'team' AND public.can_access_team_whiteboard(team_role)))
  );

-- ---------------------------------------------------------------------------
-- Origine amont : supabase/migrations/20260828135526_5764ae52-9de1-4a00-8f68-a6c47b98f892.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whiteboard_library_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'perso',
  source text NOT NULL DEFAULT 'user',
  elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  files jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_data text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_library_items TO authenticated;
GRANT ALL ON public.whiteboard_library_items TO service_role;

ALTER TABLE public.whiteboard_library_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own whiteboard library items" ON public.whiteboard_library_items;
CREATE POLICY "Users manage their own whiteboard library items" ON public.whiteboard_library_items FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_whiteboard_library_items_user ON public.whiteboard_library_items (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_whiteboard_library_items_updated_at ON public.whiteboard_library_items;
CREATE TRIGGER update_whiteboard_library_items_updated_at
  BEFORE UPDATE ON public.whiteboard_library_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Origine amont : supabase/migrations/20260830131931_23e37b8e-f22a-4867-904a-ad7966ec8466.sql
-- ---------------------------------------------------------------------------
-- 1. Colonnes d'organisation sur whiteboards
ALTER TABLE public.whiteboards
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE INDEX IF NOT EXISTS idx_whiteboards_scope_team ON public.whiteboards(scope, team_role, kind);
CREATE INDEX IF NOT EXISTS idx_whiteboards_owner ON public.whiteboards(owner_id);

-- 2. Helper d'accès centralisé
CREATE OR REPLACE FUNCTION public.can_access_whiteboard(_wb_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.whiteboards w
    WHERE w.id = _wb_id
      AND (
        w.owner_id = auth.uid()
        OR w.scope = 'company'
        OR (w.scope = 'team' AND public.can_access_team_whiteboard(w.team_role))
        OR (w.is_shared = true)
        OR EXISTS (SELECT 1 FROM public.whiteboard_shares s WHERE s.whiteboard_id = w.id AND s.user_id = auth.uid())
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_whiteboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_whiteboard(uuid) TO authenticated, service_role;

-- 3. Politiques manquantes (suppression équipe/entreprise, édition équipe)
DROP POLICY IF EXISTS "Team whiteboards writable by team" ON public.whiteboards;
DROP POLICY IF EXISTS "Team whiteboards writable by team" ON public.whiteboards;
CREATE POLICY "Team whiteboards writable by team" ON public.whiteboards FOR UPDATE TO authenticated
  USING (scope = 'team' AND public.can_access_team_whiteboard(team_role))
  WITH CHECK (scope = 'team' AND public.can_access_team_whiteboard(team_role));

DROP POLICY IF EXISTS "Team whiteboards insertable by team" ON public.whiteboards;
DROP POLICY IF EXISTS "Team whiteboards insertable by team" ON public.whiteboards;
CREATE POLICY "Team whiteboards insertable by team" ON public.whiteboards FOR INSERT TO authenticated
  WITH CHECK (scope = 'team' AND public.can_access_team_whiteboard(team_role) AND owner_id = auth.uid());

DROP POLICY IF EXISTS "Shared boards deletable by direction" ON public.whiteboards;
DROP POLICY IF EXISTS "Shared boards deletable by direction" ON public.whiteboards;
CREATE POLICY "Shared boards deletable by direction" ON public.whiteboards FOR DELETE TO authenticated
  USING (
    scope IN ('team','company')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction'))
  );

-- 4. Historique des versions
CREATE TABLE IF NOT EXISTS public.whiteboard_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id uuid NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  scene jsonb NOT NULL DEFAULT '{}'::jsonb,
  element_count integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'auto',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wb_versions_board ON public.whiteboard_versions(whiteboard_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.whiteboard_versions TO authenticated;
GRANT ALL ON public.whiteboard_versions TO service_role;

ALTER TABLE public.whiteboard_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Versions readable by board members" ON public.whiteboard_versions;
DROP POLICY IF EXISTS "Versions readable by board members" ON public.whiteboard_versions;
CREATE POLICY "Versions readable by board members" ON public.whiteboard_versions FOR SELECT TO authenticated
  USING (public.can_access_whiteboard(whiteboard_id));

DROP POLICY IF EXISTS "Versions insertable by board members" ON public.whiteboard_versions;
DROP POLICY IF EXISTS "Versions insertable by board members" ON public.whiteboard_versions;
CREATE POLICY "Versions insertable by board members" ON public.whiteboard_versions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_whiteboard(whiteboard_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Versions deletable by owner or admin" ON public.whiteboard_versions;
DROP POLICY IF EXISTS "Versions deletable by owner or admin" ON public.whiteboard_versions;
CREATE POLICY "Versions deletable by owner or admin" ON public.whiteboard_versions FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.whiteboards w WHERE w.id = whiteboard_id AND w.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction')
  );

-- 5. Commentaires contextuels
CREATE TABLE IF NOT EXISTS public.whiteboard_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id uuid NOT NULL REFERENCES public.whiteboards(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  element_id text,
  mentions uuid[] NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wb_comments_board ON public.whiteboard_comments(whiteboard_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.whiteboard_comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.whiteboard_comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wb_comment_replies ON public.whiteboard_comment_replies(comment_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_comments TO authenticated;
GRANT ALL ON public.whiteboard_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_comment_replies TO authenticated;
GRANT ALL ON public.whiteboard_comment_replies TO service_role;

ALTER TABLE public.whiteboard_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_comment_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments readable by board members" ON public.whiteboard_comments;
DROP POLICY IF EXISTS "Comments readable by board members" ON public.whiteboard_comments;
CREATE POLICY "Comments readable by board members" ON public.whiteboard_comments FOR SELECT TO authenticated
  USING (public.can_access_whiteboard(whiteboard_id));

DROP POLICY IF EXISTS "Comments insertable by board members" ON public.whiteboard_comments;
DROP POLICY IF EXISTS "Comments insertable by board members" ON public.whiteboard_comments;
CREATE POLICY "Comments insertable by board members" ON public.whiteboard_comments FOR INSERT TO authenticated
  WITH CHECK (public.can_access_whiteboard(whiteboard_id) AND author_id = auth.uid());

DROP POLICY IF EXISTS "Comments updatable by members" ON public.whiteboard_comments;
DROP POLICY IF EXISTS "Comments updatable by members" ON public.whiteboard_comments;
CREATE POLICY "Comments updatable by members" ON public.whiteboard_comments FOR UPDATE TO authenticated
  USING (public.can_access_whiteboard(whiteboard_id))
  WITH CHECK (public.can_access_whiteboard(whiteboard_id));

DROP POLICY IF EXISTS "Comments deletable by author" ON public.whiteboard_comments;
DROP POLICY IF EXISTS "Comments deletable by author" ON public.whiteboard_comments;
CREATE POLICY "Comments deletable by author" ON public.whiteboard_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Replies readable by board members" ON public.whiteboard_comment_replies;
DROP POLICY IF EXISTS "Replies readable by board members" ON public.whiteboard_comment_replies;
CREATE POLICY "Replies readable by board members" ON public.whiteboard_comment_replies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whiteboard_comments c WHERE c.id = comment_id AND public.can_access_whiteboard(c.whiteboard_id)));

DROP POLICY IF EXISTS "Replies insertable by board members" ON public.whiteboard_comment_replies;
DROP POLICY IF EXISTS "Replies insertable by board members" ON public.whiteboard_comment_replies;
CREATE POLICY "Replies insertable by board members" ON public.whiteboard_comment_replies FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.whiteboard_comments c WHERE c.id = comment_id AND public.can_access_whiteboard(c.whiteboard_id))
  );

DROP POLICY IF EXISTS "Replies editable by author" ON public.whiteboard_comment_replies;
DROP POLICY IF EXISTS "Replies editable by author" ON public.whiteboard_comment_replies;
CREATE POLICY "Replies editable by author" ON public.whiteboard_comment_replies FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Replies deletable by author" ON public.whiteboard_comment_replies;
DROP POLICY IF EXISTS "Replies deletable by author" ON public.whiteboard_comment_replies;
CREATE POLICY "Replies deletable by author" ON public.whiteboard_comment_replies FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_wb_comments_updated_at ON public.whiteboard_comments;
CREATE TRIGGER trg_wb_comments_updated_at
  BEFORE UPDATE ON public.whiteboard_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_wb_comment_replies_updated_at ON public.whiteboard_comment_replies;
CREATE TRIGGER trg_wb_comment_replies_updated_at
  BEFORE UPDATE ON public.whiteboard_comment_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Bibliothèque partageable
ALTER TABLE public.whiteboard_library_items
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS team_role text;

DROP POLICY IF EXISTS "Shared library items readable" ON public.whiteboard_library_items;
DROP POLICY IF EXISTS "Shared library items readable" ON public.whiteboard_library_items;
CREATE POLICY "Shared library items readable" ON public.whiteboard_library_items FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR scope = 'company'
    OR (scope = 'team' AND public.can_access_team_whiteboard(team_role))
  );

-- 7. Purge quotidienne des versions (30 max par tableau)
CREATE OR REPLACE FUNCTION public.purge_whiteboard_versions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  deleted integer;
BEGIN
  WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY whiteboard_id ORDER BY created_at DESC) rn
    FROM public.whiteboard_versions
  )
  DELETE FROM public.whiteboard_versions v
  USING ranked r
  WHERE v.id = r.id AND r.rn > 30;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_whiteboard_versions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_whiteboard_versions() TO service_role;

SELECT cron.unschedule('purge-whiteboard-versions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-whiteboard-versions');

SELECT cron.schedule(
  'purge-whiteboard-versions',
  '20 3 * * *',
  $$SELECT public.purge_whiteboard_versions();$$
);

-- ---------------------------------------------------------------------------
-- Origine amont : supabase/migrations/20260830132953_5fb4242b-4790-4e6b-9446-13a1c1c5c7e0.sql
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whiteboard_comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_comments';
  END IF;
END $$;

ALTER TABLE public.whiteboard_comments REPLICA IDENTITY FULL;
