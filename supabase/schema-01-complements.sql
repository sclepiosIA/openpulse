-- =====================================================================
-- Compléments de schéma déduits de l'instantané de production.
--
-- Le corpus de migrations ne crée pas ces colonnes : elles ont été ajoutées
-- directement en production, hors migration. Leur absence ne se voit qu'à
-- l'usage, quand une fonction les référence — c'est ce qui faisait échouer
-- toute création de compte.
--
-- Généré par tools/openrelease/schema/combler-depuis-types.py.
-- Toutes les colonnes sont nullables : le type TypeScript ne porte ni
-- contrainte, ni valeur par défaut, ni clé étrangère. Une colonne en trop est
-- inerte, une colonne manquante casse une fonction.
-- =====================================================================

-- customer_health_metrics
ALTER TABLE public.customer_health_metrics ADD COLUMN IF NOT EXISTS "nombre_avis_specialise" numeric;
ALTER TABLE public.customer_health_metrics ADD COLUMN IF NOT EXISTS "nombre_ccmu_2_plus" numeric;
ALTER TABLE public.customer_health_metrics ADD COLUMN IF NOT EXISTS "nombre_ccmu_3_plus" numeric;
ALTER TABLE public.customer_health_metrics ADD COLUMN IF NOT EXISTS "roi_annuel" numeric;
ALTER TABLE public.customer_health_metrics ADD COLUMN IF NOT EXISTS "taux_completion_dossier" numeric;
ALTER TABLE public.customer_health_metrics ADD COLUMN IF NOT EXISTS "taux_uhcd_mono_rum" numeric;
ALTER TABLE public.customer_health_metrics ADD COLUMN IF NOT EXISTS "taux_utilisation_cotation" numeric;

-- email_threads
ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS "last_message_is_sent" boolean;

-- profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "is_sandbox" boolean;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "locale" text;

-- quiz_results
ALTER TABLE public.quiz_results ADD COLUMN IF NOT EXISTS "created_by" text;

-- visio_transcription_sessions
ALTER TABLE public.visio_transcription_sessions ADD COLUMN IF NOT EXISTS "audio_duration_seconds" numeric;
ALTER TABLE public.visio_transcription_sessions ADD COLUMN IF NOT EXISTS "audio_mime_type" text;
ALTER TABLE public.visio_transcription_sessions ADD COLUMN IF NOT EXISTS "audio_path" text;
ALTER TABLE public.visio_transcription_sessions ADD COLUMN IF NOT EXISTS "audio_size_bytes" numeric;
ALTER TABLE public.visio_transcription_sessions ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
ALTER TABLE public.visio_transcription_sessions ADD COLUMN IF NOT EXISTS "is_internal" boolean;

