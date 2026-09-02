-- =====================================================================
-- Tables absentes du corpus de migrations.
--
-- Elles ont ete creees hors migration sur la plateforme hebergee : aucun
-- fichier SQL du depot ne les porte, et le rejeu du corpus ne les produira
-- jamais. Elles sont reconstituees ici depuis l'instantane de production
-- versionne dans le depot.
--
-- Genere par tools/openrelease/schema/generer-tables-absentes.py.
--
-- LIMITES ASSUMEES, a completer table par table selon l'usage :
--   - aucune cle etrangere : un type TypeScript n'en porte pas ;
--   - aucune contrainte d'unicite autre que la cle primaire ;
--   - aucune valeur par defaut, aucun index ;
--   - securite au niveau ligne ACTIVEE et AUCUNE policy : la table est donc
--     fermee. C'est deliberé — une table ouverte par erreur est un incident,
--     une table fermee est un ticket.
-- =====================================================================

-- admin_impersonation_actions (8 colonnes)
CREATE TABLE IF NOT EXISTS public.admin_impersonation_actions (
  "action_type" text NOT NULL,
  "admin_user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "details" jsonb,
  "id" numeric PRIMARY KEY,
  "impersonation_id" numeric NOT NULL,
  "path" text,
  "target_user_id" uuid NOT NULL
);
ALTER TABLE public.admin_impersonation_actions ENABLE ROW LEVEL SECURITY;

-- admin_impersonations (8 colonnes)
CREATE TABLE IF NOT EXISTS public.admin_impersonations (
  "admin_user_id" uuid NOT NULL,
  "ended_at" timestamptz,
  "id" numeric PRIMARY KEY,
  "ip_address" text,
  "reason" text,
  "started_at" timestamptz NOT NULL,
  "target_user_id" uuid NOT NULL,
  "user_agent" text
);
ALTER TABLE public.admin_impersonations ENABLE ROW LEVEL SECURITY;

-- app_feedback (8 colonnes)
CREATE TABLE IF NOT EXISTS public.app_feedback (
  "category" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "message" text NOT NULL,
  "page_url" text,
  "status" text NOT NULL,
  "user_agent" text,
  "user_id" uuid NOT NULL
);
ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

-- candidate_documents (12 colonnes)
CREATE TABLE IF NOT EXISTS public.candidate_documents (
  "candidate_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "is_primary" boolean,
  "mime_type" text,
  "nom" text NOT NULL,
  "parsed_content" jsonb,
  "storage_bucket" text,
  "storage_path" text NOT NULL,
  "taille_bytes" numeric,
  "type" text NOT NULL,
  "uploaded_by" text
);
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

-- candidate_evaluations (13 colonnes)
CREATE TABLE IF NOT EXISTS public.candidate_evaluations (
  "candidate_id" uuid NOT NULL,
  "commentaire_general" text,
  "created_at" timestamptz NOT NULL,
  "criteres" jsonb NOT NULL,
  "evaluator_id" uuid NOT NULL,
  "id" uuid PRIMARY KEY,
  "interview_id" uuid,
  "is_decision_maker" boolean,
  "note_globale" numeric,
  "points_amelioration" text[],
  "points_forts" text[],
  "recommandation" text,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.candidate_evaluations ENABLE ROW LEVEL SECURITY;

-- candidate_history (8 colonnes)
CREATE TABLE IF NOT EXISTS public.candidate_history (
  "action_type" text NOT NULL,
  "candidate_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "description" text,
  "id" uuid PRIMARY KEY,
  "new_value" jsonb,
  "old_value" jsonb,
  "performed_by" text
);
ALTER TABLE public.candidate_history ENABLE ROW LEVEL SECURITY;

-- candidate_interviews (21 colonnes)
CREATE TABLE IF NOT EXISTS public.candidate_interviews (
  "calendar_event_id" uuid,
  "candidate_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "date_heure" text NOT NULL,
  "description" text,
  "duree_minutes" numeric,
  "feedback" text,
  "id" uuid PRIMARY KEY,
  "interviewers" text[],
  "lieu" text,
  "note" numeric,
  "points_amelioration" text[],
  "points_forts" text[],
  "rappel_envoye" boolean,
  "recommandation" text,
  "statut" text NOT NULL,
  "titre" text NOT NULL,
  "type" text NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "visio_url" text
);
ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;

-- candidates (34 colonnes)
CREATE TABLE IF NOT EXISTS public.candidates (
  "annees_experience" numeric,
  "assignee_id" uuid,
  "competences" text[],
  "cooptation_par" text,
  "created_at" timestamptz NOT NULL,
  "cv_url" text,
  "date_candidature" text NOT NULL,
  "date_derniere_action" text,
  "date_disponibilite" text,
  "date_embauche" text,
  "disponibilite" text,
  "email" text NOT NULL,
  "extra_form_data" jsonb,
  "id" uuid PRIMARY KEY,
  "is_public_application" boolean NOT NULL,
  "job_offer_id" uuid NOT NULL,
  "langues" jsonb,
  "lettre_motivation" text,
  "linkedin_url" text,
  "metadata" jsonb,
  "nom" text NOT NULL,
  "note_globale" numeric,
  "notes" text,
  "portfolio_url" text,
  "prenom" text NOT NULL,
  "profile_id" uuid,
  "resume_parsed" jsonb,
  "salaire_souhaite" numeric,
  "source" text,
  "source_detail" text,
  "statut" jsonb NOT NULL,
  "tags" text[],
  "telephone" text,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- client_portal_user_secrets (5 colonnes)
CREATE TABLE IF NOT EXISTS public.client_portal_user_secrets (
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "password_hash" text NOT NULL,
  "portal_user_id" uuid NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.client_portal_user_secrets ENABLE ROW LEVEL SECURITY;

-- crok_revenue_reconciliation (17 colonnes)
CREATE TABLE IF NOT EXISTS public.crok_revenue_reconciliation (
  "charges_count" integer,
  "charges_gross_eur" numeric,
  "created_at" timestamptz NOT NULL,
  "discrepancy_eur" numeric,
  "id" uuid PRIMARY KEY,
  "match_status" text NOT NULL,
  "matched_at" timestamptz,
  "matched_by" text,
  "notes" text,
  "payout_amount_eur" numeric NOT NULL,
  "payout_arrival_date" timestamptz NOT NULL,
  "payout_status" text,
  "qonto_operation_id" uuid,
  "stripe_fees_eur" numeric,
  "stripe_payout_id" uuid NOT NULL,
  "tresorerie_revenu_id" uuid,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.crok_revenue_reconciliation ENABLE ROW LEVEL SECURITY;

-- cron_health (8 colonnes)
CREATE TABLE IF NOT EXISTS public.cron_health (
  "duration_ms" numeric,
  "error_message" text,
  "finished_at" timestamptz,
  "id" numeric PRIMARY KEY,
  "job_name" text NOT NULL,
  "metadata" jsonb,
  "started_at" timestamptz NOT NULL,
  "status" text NOT NULL
);
ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

-- document_embeddings (9 colonnes)
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  "chunk_index" numeric NOT NULL,
  "chunk_text" text NOT NULL,
  "chunk_tokens" numeric,
  "created_at" timestamptz,
  "document_id" uuid,
  "embedding" text,
  "id" uuid PRIMARY KEY,
  "metadata" jsonb,
  "storage_path" text NOT NULL
);
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- evaluation_templates (9 colonnes)
CREATE TABLE IF NOT EXISTS public.evaluation_templates (
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "criteres" jsonb NOT NULL,
  "description" text,
  "est_actif" boolean,
  "id" uuid PRIMARY KEY,
  "nom" text NOT NULL,
  "type_entretien" text,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.evaluation_templates ENABLE ROW LEVEL SECURITY;

-- feature_flags (8 colonnes)
CREATE TABLE IF NOT EXISTS public.feature_flags (
  "description" text,
  "enabled" boolean NOT NULL,
  "key" text NOT NULL,
  "rollout_percentage" numeric NOT NULL,
  "target_roles" jsonb,
  "target_user_ids" text[],
  "updated_at" timestamptz NOT NULL,
  "updated_by" text
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- job_offers (32 colonnes)
CREATE TABLE IF NOT EXISTS public.job_offers (
  "apply_form_extra_fields" jsonb NOT NULL,
  "avantages" text[],
  "competences_requises" text[],
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "date_cloture" text,
  "date_publication" text,
  "departement" text,
  "description" text,
  "description_html" text,
  "diffusion_externe" boolean,
  "experience_minimum" numeric,
  "id" uuid PRIMARY KEY,
  "localisation" text,
  "metadata" jsonb,
  "niveau_etudes" text,
  "nombre_postes" numeric,
  "postes_pourvus" numeric,
  "priorite" text,
  "public_listing_enabled" boolean NOT NULL,
  "public_short_pitch" text,
  "responsable_id" uuid,
  "salaire_max" numeric,
  "salaire_min" numeric,
  "seo_description" text,
  "seo_title" text,
  "slug" text,
  "statut" jsonb NOT NULL,
  "titre" text NOT NULL,
  "type_contrat" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "url_externe" text
);
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;

-- mobile_payout_reconciliation (17 colonnes)
CREATE TABLE IF NOT EXISTS public.mobile_payout_reconciliation (
  "charges_count" integer,
  "charges_gross_eur" numeric,
  "created_at" timestamptz NOT NULL,
  "discrepancy_eur" numeric,
  "id" uuid PRIMARY KEY,
  "match_status" text NOT NULL,
  "matched_at" timestamptz,
  "matched_by" text,
  "notes" text,
  "payout_amount_eur" numeric NOT NULL,
  "payout_arrival_date" timestamptz NOT NULL,
  "payout_status" text,
  "qonto_operation_id" uuid,
  "stripe_fees_eur" numeric,
  "stripe_payout_id" uuid NOT NULL,
  "tresorerie_revenu_id" uuid,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.mobile_payout_reconciliation ENABLE ROW LEVEL SECURITY;

-- mobile_revenue_reconciliation (10 colonnes)
CREATE TABLE IF NOT EXISTS public.mobile_revenue_reconciliation (
  "bridge_revenue_eur" numeric NOT NULL,
  "created_at" timestamptz NOT NULL,
  "delta_eur" numeric,
  "id" uuid PRIMARY KEY,
  "month" text NOT NULL,
  "notes" text,
  "pushed_to_tresorerie_at" timestamptz,
  "qonto_amount_eur" numeric,
  "tresorerie_amount_eur" numeric,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.mobile_revenue_reconciliation ENABLE ROW LEVEL SECURITY;

-- monitor_alert_notifications (7 colonnes)
CREATE TABLE IF NOT EXISTS public.monitor_alert_notifications (
  "alert_id" uuid NOT NULL,
  "channel" text NOT NULL,
  "error" text,
  "id" uuid PRIMARY KEY,
  "payload" jsonb NOT NULL,
  "sent_at" timestamptz NOT NULL,
  "success" boolean NOT NULL
);
ALTER TABLE public.monitor_alert_notifications ENABLE ROW LEVEL SECURITY;

-- monitor_alert_rules (14 colonnes)
CREATE TABLE IF NOT EXISTS public.monitor_alert_rules (
  "config" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL,
  "dedup_minutes" numeric NOT NULL,
  "description" text,
  "enabled" boolean NOT NULL,
  "escalate_after" numeric NOT NULL,
  "id" uuid PRIMARY KEY,
  "label" text NOT NULL,
  "rule_key" text NOT NULL,
  "severity_min" text NOT NULL,
  "source" text NOT NULL,
  "threshold_count" integer NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "window_minutes" numeric NOT NULL
);
ALTER TABLE public.monitor_alert_rules ENABLE ROW LEVEL SECURITY;

-- monitor_alerts (20 colonnes)
CREATE TABLE IF NOT EXISTS public.monitor_alerts (
  "acknowledged_at" timestamptz,
  "acknowledged_by" text,
  "created_at" timestamptz NOT NULL,
  "escalated" boolean NOT NULL,
  "fingerprint" text NOT NULL,
  "first_seen_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "last_notified_at" timestamptz,
  "last_seen_at" timestamptz NOT NULL,
  "message" text,
  "metadata" jsonb NOT NULL,
  "occurrences" numeric NOT NULL,
  "resolved_at" timestamptz,
  "resolved_by" text,
  "rule_key" text NOT NULL,
  "severity" text NOT NULL,
  "source" text NOT NULL,
  "status" text NOT NULL,
  "title" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.monitor_alerts ENABLE ROW LEVEL SECURITY;

-- native_device_tokens (10 colonnes)
CREATE TABLE IF NOT EXISTS public.native_device_tokens (
  "app_scope" text,
  "app_version" text,
  "created_at" timestamptz NOT NULL,
  "device_model" text,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "last_active_at" timestamptz NOT NULL,
  "platform" text NOT NULL,
  "token" text NOT NULL,
  "user_id" uuid NOT NULL
);
ALTER TABLE public.native_device_tokens ENABLE ROW LEVEL SECURITY;

-- profiles_sensitive (10 colonnes)
CREATE TABLE IF NOT EXISTS public.profiles_sensitive (
  "bic" text,
  "created_at" timestamptz NOT NULL,
  "date_naissance" text,
  "iban" text,
  "id" uuid PRIMARY KEY,
  "lieu_naissance" text,
  "numero_securite_sociale" text,
  "profile_id" uuid NOT NULL,
  "salaire_brut" numeric,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.profiles_sensitive ENABLE ROW LEVEL SECURITY;

-- rate_limits (6 colonnes)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  "bucket" text NOT NULL,
  "count" numeric NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "id" numeric PRIMARY KEY,
  "key" text NOT NULL,
  "window_start" text NOT NULL
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- recruitment_assessment_tests (6 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_assessment_tests (
  "assessment_id" uuid NOT NULL,
  "duration_override_minutes" numeric,
  "id" uuid PRIMARY KEY,
  "order_index" numeric NOT NULL,
  "test_template_id" uuid NOT NULL,
  "weight" numeric NOT NULL
);
ALTER TABLE public.recruitment_assessment_tests ENABLE ROW LEVEL SECURITY;

-- recruitment_assessments (29 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_assessments (
  "allow_pause" boolean NOT NULL,
  "branding_theme_id" uuid,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "deadline" text,
  "default_locale" text,
  "description" text,
  "detect_tab_switch" boolean NOT NULL,
  "disable_copy_paste" boolean NOT NULL,
  "id" uuid PRIMARY KEY,
  "intro_message" text,
  "is_active" boolean NOT NULL,
  "job_offer_id" uuid,
  "max_pauses" numeric NOT NULL,
  "max_tab_switches" numeric NOT NULL,
  "outro_message" text,
  "public_signup_count" integer NOT NULL,
  "public_signup_enabled" boolean NOT NULL,
  "public_signup_max_candidates" numeric,
  "public_signup_message" text,
  "public_signup_slug" text,
  "require_fullscreen" boolean NOT NULL,
  "require_webcam" boolean NOT NULL,
  "show_score_to_candidate" boolean NOT NULL,
  "shuffle_questions" boolean NOT NULL,
  "single_attempt" boolean NOT NULL,
  "title" text NOT NULL,
  "total_duration_minutes" numeric,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_assessments ENABLE ROW LEVEL SECURITY;

-- recruitment_branding_themes (19 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_branding_themes (
  "accent_color" text,
  "background_color" text,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "custom_css" text,
  "font_family" text,
  "id" uuid PRIMARY KEY,
  "is_default" boolean NOT NULL,
  "logo_url" text,
  "name" text NOT NULL,
  "primary_color" text,
  "text_color" text,
  "thanks_message_en" text,
  "thanks_message_es" text,
  "thanks_message_fr" text,
  "updated_at" timestamptz NOT NULL,
  "welcome_message_en" text,
  "welcome_message_es" text,
  "welcome_message_fr" text
);
ALTER TABLE public.recruitment_branding_themes ENABLE ROW LEVEL SECURITY;

-- recruitment_bulk_invitations (10 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_bulk_invitations (
  "assessment_id" uuid NOT NULL,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL,
  "created_by" text NOT NULL,
  "errors" jsonb NOT NULL,
  "failure_count" integer NOT NULL,
  "id" uuid PRIMARY KEY,
  "status" text NOT NULL,
  "success_count" integer NOT NULL,
  "total_count" integer NOT NULL
);
ALTER TABLE public.recruitment_bulk_invitations ENABLE ROW LEVEL SECURITY;

-- recruitment_candidate_answers (17 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_candidate_answers (
  "ai_evaluation" jsonb,
  "ai_feedback" text,
  "ai_score" integer,
  "ai_scored_at" timestamptz,
  "answer" jsonb,
  "audio_response_url" text,
  "cefr_level" text,
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "is_correct" boolean,
  "points_earned" numeric,
  "question_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "time_spent_seconds" numeric,
  "transcription" text,
  "updated_at" timestamptz NOT NULL,
  "video_response_url" text
);
ALTER TABLE public.recruitment_candidate_answers ENABLE ROW LEVEL SECURITY;

-- recruitment_candidate_sessions (36 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_candidate_sessions (
  "ai_text_detection_score" integer,
  "assessment_id" uuid NOT NULL,
  "candidate_email" text NOT NULL,
  "candidate_id" uuid,
  "candidate_name" text NOT NULL,
  "completed_at" timestamptz,
  "composite_grade" text,
  "composite_score" integer,
  "created_at" timestamptz NOT NULL,
  "current_question_index" numeric NOT NULL,
  "device_fingerprint" text,
  "disqualification_reason" text,
  "face_detection_score" integer,
  "flag_reasons" jsonb,
  "global_score_percentile" numeric,
  "id" uuid PRIMARY KEY,
  "integrity_score" integer,
  "ip_address" text,
  "is_disqualified" boolean NOT NULL,
  "is_flagged" boolean NOT NULL,
  "last_resumed_at" timestamptz,
  "locale" text,
  "pause_count" integer NOT NULL,
  "paused_at" timestamptz,
  "proctoring_events" jsonb,
  "qualifying_snapshot" jsonb,
  "questions_snapshot" jsonb,
  "snapshot_taken_at" timestamptz,
  "started_at" timestamptz,
  "status" jsonb NOT NULL,
  "tab_switch_count" integer NOT NULL,
  "time_remaining_seconds" numeric,
  "token" text NOT NULL,
  "total_paused_seconds" numeric NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "user_agent" text
);
ALTER TABLE public.recruitment_candidate_sessions ENABLE ROW LEVEL SECURITY;

-- recruitment_candidate_sources (9 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_candidate_sources (
  "attributed_at" timestamptz NOT NULL,
  "candidate_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "referrer_user_id" uuid,
  "source_id" uuid NOT NULL,
  "utm_campaign" text,
  "utm_medium" text,
  "utm_source" text
);
ALTER TABLE public.recruitment_candidate_sources ENABLE ROW LEVEL SECURITY;

-- recruitment_code_test_cases (9 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_code_test_cases (
  "created_at" timestamptz NOT NULL,
  "expected_stdout" text NOT NULL,
  "id" uuid PRIMARY KEY,
  "is_hidden" boolean NOT NULL,
  "label" text NOT NULL,
  "question_id" uuid NOT NULL,
  "sort_order" numeric NOT NULL,
  "stdin" text,
  "weight" numeric NOT NULL
);
ALTER TABLE public.recruitment_code_test_cases ENABLE ROW LEVEL SECURITY;

-- recruitment_culture_profiles (7 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_culture_profiles (
  "behaviors" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "id" uuid PRIMARY KEY,
  "title" text NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "values" jsonb NOT NULL
);
ALTER TABLE public.recruitment_culture_profiles ENABLE ROW LEVEL SECURITY;

-- recruitment_custom_questions (7 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_custom_questions (
  "assessment_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "order_index" numeric NOT NULL,
  "question_text" text NOT NULL,
  "question_type" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_custom_questions ENABLE ROW LEVEL SECURITY;

-- recruitment_device_fingerprints (10 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_device_fingerprints (
  "components" jsonb,
  "created_at" timestamptz NOT NULL,
  "fingerprint_hash" text NOT NULL,
  "id" uuid PRIMARY KEY,
  "ip_address" text NOT NULL,
  "language" text,
  "screen_resolution" text,
  "session_id" uuid NOT NULL,
  "timezone" text,
  "user_agent" text
);
ALTER TABLE public.recruitment_device_fingerprints ENABLE ROW LEVEL SECURITY;

-- recruitment_diversity_data (8 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_diversity_data (
  "age_range" text,
  "candidate_id" uuid NOT NULL,
  "collected_at" timestamptz NOT NULL,
  "consent_given" boolean NOT NULL,
  "disability_status" boolean,
  "gender" text,
  "geographic_origin" text,
  "id" uuid PRIMARY KEY
);
ALTER TABLE public.recruitment_diversity_data ENABLE ROW LEVEL SECURITY;

-- recruitment_email_sent_log (10 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_email_sent_log (
  "body_html" text NOT NULL,
  "candidate_id" uuid,
  "error_message" text,
  "id" uuid PRIMARY KEY,
  "sent_at" timestamptz NOT NULL,
  "sent_by" text,
  "status" text NOT NULL,
  "subject" text NOT NULL,
  "template_id" uuid,
  "to_email" text NOT NULL
);
ALTER TABLE public.recruitment_email_sent_log ENABLE ROW LEVEL SECURITY;

-- recruitment_email_templates (11 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_email_templates (
  "body_html" text NOT NULL,
  "category" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "is_system" boolean NOT NULL,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "variables" jsonb NOT NULL
);
ALTER TABLE public.recruitment_email_templates ENABLE ROW LEVEL SECURITY;

-- recruitment_fullscreen_events (5 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_fullscreen_events (
  "duration_ms" numeric,
  "event_type" text NOT NULL,
  "id" uuid PRIMARY KEY,
  "occurred_at" timestamptz NOT NULL,
  "session_id" uuid NOT NULL
);
ALTER TABLE public.recruitment_fullscreen_events ENABLE ROW LEVEL SECURITY;

-- recruitment_hire_costs (9 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_hire_costs (
  "amount" numeric NOT NULL,
  "candidate_id" uuid NOT NULL,
  "cost_type" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "description" text,
  "id" uuid PRIMARY KEY,
  "incurred_at" timestamptz NOT NULL,
  "job_offer_id" uuid
);
ALTER TABLE public.recruitment_hire_costs ENABLE ROW LEVEL SECURITY;

-- recruitment_integrity_scores (13 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_integrity_scores (
  "ai_text_score" integer,
  "computed_at" timestamptz NOT NULL,
  "details" jsonb,
  "device_score" integer,
  "flags" jsonb,
  "fullscreen_score" integer,
  "id" uuid PRIMARY KEY,
  "overall_score" integer NOT NULL,
  "paste_score" integer,
  "proctoring_score" integer,
  "session_id" uuid NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "webcam_score" integer
);
ALTER TABLE public.recruitment_integrity_scores ENABLE ROW LEVEL SECURITY;

-- recruitment_interview_evaluators (5 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_interview_evaluators (
  "evaluator_user_id" uuid NOT NULL,
  "id" uuid PRIMARY KEY,
  "interview_id" uuid NOT NULL,
  "invited_at" timestamptz NOT NULL,
  "is_lead" boolean NOT NULL
);
ALTER TABLE public.recruitment_interview_evaluators ENABLE ROW LEVEL SECURITY;

-- recruitment_interview_stages (10 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_interview_stages (
  "created_at" timestamptz NOT NULL,
  "default_duration_minutes" numeric NOT NULL,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "job_offer_id" uuid,
  "name" text NOT NULL,
  "order_index" numeric NOT NULL,
  "scorecard_template_id" uuid,
  "stage_type" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_interview_stages ENABLE ROW LEVEL SECURITY;

-- recruitment_interviews (14 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_interviews (
  "candidate_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "duration_minutes" numeric NOT NULL,
  "id" uuid PRIMARY KEY,
  "job_offer_id" uuid,
  "location" text,
  "meeting_provider" text,
  "meeting_url" text,
  "notes" text,
  "organized_by" text,
  "scheduled_at" timestamptz,
  "stage_id" uuid,
  "status" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_interviews ENABLE ROW LEVEL SECURITY;

-- recruitment_job_alert_sends (4 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_job_alert_sends (
  "alert_id" uuid NOT NULL,
  "id" uuid PRIMARY KEY,
  "offer_ids" text[] NOT NULL,
  "sent_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_job_alert_sends ENABLE ROW LEVEL SECURITY;

-- recruitment_job_alerts (15 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_job_alerts (
  "contract_types" text[],
  "created_at" timestamptz NOT NULL,
  "departements" text[],
  "email" text NOT NULL,
  "frequency" text NOT NULL,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "keywords" text,
  "last_offer_id_sent" text,
  "last_sent_at" timestamptz,
  "localisations" text[],
  "remote_only" boolean,
  "salary_min" numeric,
  "unsubscribe_token" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_job_alerts ENABLE ROW LEVEL SECURITY;

-- recruitment_job_distributions (16 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_job_distributions (
  "applications_count" integer NOT NULL,
  "cost" numeric,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "error_message" text,
  "expires_at" timestamptz,
  "external_id" uuid,
  "external_url" text,
  "id" uuid PRIMARY KEY,
  "job_offer_id" uuid NOT NULL,
  "metadata" jsonb,
  "published_at" timestamptz,
  "source_id" uuid NOT NULL,
  "status" text NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "views_count" integer NOT NULL
);
ALTER TABLE public.recruitment_job_distributions ENABLE ROW LEVEL SECURITY;

-- recruitment_offer_letters (24 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_offer_letters (
  "benefits" text,
  "bonuses" text,
  "candidate_id" uuid NOT NULL,
  "contract_type" text,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "custom_terms" text,
  "decline_reason" text,
  "expires_at" timestamptz,
  "id" uuid PRIMARY KEY,
  "job_offer_id" uuid,
  "letter_pdf_url" text,
  "position_title" text NOT NULL,
  "responded_at" timestamptz,
  "salary_annual" numeric,
  "sent_at" timestamptz,
  "signature_request_id" uuid,
  "signed_at" timestamptz,
  "signed_pdf_url" text,
  "start_date" timestamptz,
  "status" text NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "variable_compensation" numeric,
  "viewed_at" timestamptz
);
ALTER TABLE public.recruitment_offer_letters ENABLE ROW LEVEL SECURITY;

-- recruitment_paste_events (8 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_paste_events (
  "ai_confidence" numeric,
  "ai_suspected" boolean,
  "id" uuid PRIMARY KEY,
  "occurred_at" timestamptz NOT NULL,
  "pasted_excerpt" text,
  "pasted_length" numeric NOT NULL,
  "question_id" uuid,
  "session_id" uuid NOT NULL
);
ALTER TABLE public.recruitment_paste_events ENABLE ROW LEVEL SECURITY;

-- recruitment_proctoring_events (6 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_proctoring_events (
  "event_type" text NOT NULL,
  "id" uuid PRIMARY KEY,
  "occurred_at" timestamptz NOT NULL,
  "payload" jsonb,
  "session_id" uuid NOT NULL,
  "severity" text NOT NULL
);
ALTER TABLE public.recruitment_proctoring_events ENABLE ROW LEVEL SECURITY;

-- recruitment_qualifying_questions (11 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_qualifying_questions (
  "assessment_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "expected_answer" boolean NOT NULL,
  "expected_value" text,
  "id" uuid PRIMARY KEY,
  "is_mandatory" boolean NOT NULL,
  "options" jsonb NOT NULL,
  "order_index" numeric NOT NULL,
  "question_text" text NOT NULL,
  "question_type" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_qualifying_questions ENABLE ROW LEVEL SECURITY;

-- recruitment_question_bank (32 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_question_bank (
  "audio_prompt_url" text,
  "category" text NOT NULL,
  "cefr_target" text,
  "code_language" text,
  "code_solution" text,
  "code_starter" text,
  "correct_answer" jsonb,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "default_points" numeric NOT NULL,
  "default_time_limit_seconds" numeric,
  "difficulty" jsonb NOT NULL,
  "dimension_key" text,
  "expected_response_type" text,
  "explanation" text,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "is_system" boolean NOT NULL,
  "language_code" text,
  "options" jsonb NOT NULL,
  "question_media_url" text,
  "question_text" text NOT NULL,
  "question_text_en" text,
  "question_text_es" text,
  "question_type" jsonb NOT NULL,
  "reverse_scored" boolean NOT NULL,
  "tags" text[] NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "usage_count" integer NOT NULL,
  "video_max_retakes" numeric,
  "video_max_seconds" numeric,
  "video_prep_seconds" numeric
);
ALTER TABLE public.recruitment_question_bank ENABLE ROW LEVEL SECURITY;

-- recruitment_referrals (10 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_referrals (
  "bonus_amount" numeric,
  "bonus_paid_at" timestamptz,
  "candidate_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "job_offer_id" uuid,
  "notes" text,
  "referrer_user_id" uuid NOT NULL,
  "status" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_referrals ENABLE ROW LEVEL SECURITY;

-- recruitment_scorecard_criteria (10 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_scorecard_criteria (
  "category" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "description" text,
  "id" uuid PRIMARY KEY,
  "label" text NOT NULL,
  "order_index" numeric NOT NULL,
  "scale_max" numeric NOT NULL,
  "scale_min" numeric NOT NULL,
  "template_id" uuid NOT NULL,
  "weight" numeric NOT NULL
);
ALTER TABLE public.recruitment_scorecard_criteria ENABLE ROW LEVEL SECURITY;

-- recruitment_scorecard_templates (9 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_scorecard_templates (
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "description" text,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "is_system" boolean NOT NULL,
  "job_family" text NOT NULL,
  "name" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_scorecard_templates ENABLE ROW LEVEL SECURITY;

-- recruitment_scorecards (14 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_scorecards (
  "candidate_id" uuid NOT NULL,
  "concerns" text,
  "created_at" timestamptz NOT NULL,
  "evaluator_user_id" uuid NOT NULL,
  "id" uuid PRIMARY KEY,
  "interview_id" uuid,
  "overall_score" integer,
  "recommendation" text,
  "scores" jsonb NOT NULL,
  "strengths" text,
  "submitted_at" timestamptz,
  "template_id" uuid,
  "updated_at" timestamptz NOT NULL,
  "verdict" text
);
ALTER TABLE public.recruitment_scorecards ENABLE ROW LEVEL SECURITY;

-- recruitment_scoring_rules (14 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_scoring_rules (
  "action_add_tags" text[],
  "action_notify_user_ids" text[],
  "action_set_grade" text,
  "action_set_status" text,
  "assessment_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "max_score" integer,
  "min_score" integer,
  "name" text NOT NULL,
  "priority" numeric NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_scoring_rules ENABLE ROW LEVEL SECURITY;

-- recruitment_sources (12 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_sources (
  "api_credentials_secret_name" text,
  "api_endpoint" text,
  "category" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "metadata" jsonb,
  "monthly_cost" numeric,
  "name" text NOT NULL,
  "posting_url_template" text,
  "setup_cost" numeric,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_sources ENABLE ROW LEVEL SECURITY;

-- recruitment_test_norms (12 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_test_norms (
  "computed_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "max_score" integer,
  "mean_score" integer,
  "min_score" integer,
  "p25" numeric,
  "p50" numeric,
  "p75" numeric,
  "p90" numeric,
  "sample_size" numeric NOT NULL,
  "stddev_score" integer,
  "test_template_id" uuid NOT NULL
);
ALTER TABLE public.recruitment_test_norms ENABLE ROW LEVEL SECURITY;

-- recruitment_test_questions (27 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_test_questions (
  "audio_prompt_url" text,
  "cefr_target" text,
  "code_language" text,
  "code_solution" text,
  "code_starter" text,
  "code_test_cases" jsonb,
  "correct_answer" jsonb,
  "created_at" timestamptz NOT NULL,
  "dimension_key" text,
  "explanation" text,
  "id" uuid PRIMARY KEY,
  "language_code" text,
  "options" jsonb,
  "order_index" numeric NOT NULL,
  "points" numeric NOT NULL,
  "question_media_url" text,
  "question_text" text NOT NULL,
  "question_text_en" text,
  "question_text_es" text,
  "question_type" jsonb NOT NULL,
  "reverse_scored" boolean NOT NULL,
  "test_template_id" uuid NOT NULL,
  "time_limit_seconds" numeric,
  "updated_at" timestamptz NOT NULL,
  "video_max_retakes" numeric,
  "video_max_seconds" numeric,
  "video_prep_seconds" numeric
);
ALTER TABLE public.recruitment_test_questions ENABLE ROW LEVEL SECURITY;

-- recruitment_test_questions_bank (7 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_test_questions_bank (
  "bank_question_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "order_index" numeric NOT NULL,
  "points" numeric,
  "test_template_id" uuid NOT NULL,
  "time_limit_seconds" numeric
);
ALTER TABLE public.recruitment_test_questions_bank ENABLE ROW LEVEL SECURITY;

-- recruitment_test_results (12 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_test_results (
  "completion_time_seconds" numeric,
  "created_at" timestamptz NOT NULL,
  "dimension_scores" jsonb,
  "id" uuid PRIMARY KEY,
  "personality_profile" jsonb,
  "points_earned" numeric,
  "points_total" numeric,
  "profile_summary" text,
  "score_percent" numeric,
  "score_percentile" numeric,
  "session_id" uuid NOT NULL,
  "test_template_id" uuid NOT NULL
);
ALTER TABLE public.recruitment_test_results ENABLE ROW LEVEL SECURITY;

-- recruitment_test_templates (22 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_test_templates (
  "allow_pause" boolean NOT NULL,
  "category" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "description" text,
  "difficulty" jsonb NOT NULL,
  "dimensions" jsonb,
  "duration_minutes" numeric NOT NULL,
  "estimated_questions" numeric,
  "icon" text,
  "id" uuid PRIMARY KEY,
  "intro_message" text,
  "is_active" boolean NOT NULL,
  "is_ai_generated" boolean NOT NULL,
  "is_system" boolean NOT NULL,
  "max_pauses" numeric NOT NULL,
  "psychometric_model" text,
  "recommended_for" text[],
  "tags" text[],
  "title" text NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "validity_info" text
);
ALTER TABLE public.recruitment_test_templates ENABLE ROW LEVEL SECURITY;

-- recruitment_webcam_snapshots (8 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_webcam_snapshots (
  "created_at" timestamptz NOT NULL,
  "face_count" integer,
  "face_detected" boolean,
  "flags" jsonb,
  "id" uuid PRIMARY KEY,
  "session_id" uuid NOT NULL,
  "storage_path" text NOT NULL,
  "taken_at" timestamptz NOT NULL
);
ALTER TABLE public.recruitment_webcam_snapshots ENABLE ROW LEVEL SECURITY;

-- recruitment_webhook_logs (7 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_webhook_logs (
  "event_type" text NOT NULL,
  "id" uuid PRIMARY KEY,
  "payload" jsonb,
  "response_body" text,
  "status_code" numeric,
  "triggered_at" timestamptz NOT NULL,
  "webhook_id" uuid NOT NULL
);
ALTER TABLE public.recruitment_webhook_logs ENABLE ROW LEVEL SECURITY;

-- recruitment_webhooks (11 colonnes)
CREATE TABLE IF NOT EXISTS public.recruitment_webhooks (
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "events" text[] NOT NULL,
  "failure_count" integer NOT NULL,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "last_triggered_at" timestamptz,
  "name" text NOT NULL,
  "secret" text,
  "updated_at" timestamptz NOT NULL,
  "url" text NOT NULL
);
ALTER TABLE public.recruitment_webhooks ENABLE ROW LEVEL SECURITY;

-- rh_notes_frais (22 colonnes)
CREATE TABLE IF NOT EXISTS public.rh_notes_frais (
  "categorie" text NOT NULL,
  "commentaire" text,
  "created_at" timestamptz NOT NULL,
  "date_depense" text NOT NULL,
  "devise" text NOT NULL,
  "id" uuid PRIMARY KEY,
  "justificatif_path" text,
  "libelle" text NOT NULL,
  "montant_ht" numeric,
  "montant_ttc" numeric NOT NULL,
  "moyen_paiement" text NOT NULL,
  "ocr_confidence" numeric,
  "ocr_extracted_data" jsonb,
  "profile_id" uuid NOT NULL,
  "rejection_reason" text,
  "remboursement_date" timestamptz,
  "remboursement_reference" text,
  "statut" text NOT NULL,
  "tva" numeric,
  "updated_at" timestamptz NOT NULL,
  "validated_at" timestamptz,
  "validateur_id" uuid
);
ALTER TABLE public.rh_notes_frais ENABLE ROW LEVEL SECURITY;

-- rh_onboarding_offboarding (13 colonnes)
CREATE TABLE IF NOT EXISTS public.rh_onboarding_offboarding (
  "comptes_acces" jsonb,
  "created_at" timestamptz,
  "created_by" text,
  "date_entree" text,
  "date_sortie" text,
  "dossier_rh" jsonb,
  "id" uuid PRIMARY KEY,
  "materiel" jsonb,
  "motif_sortie" text,
  "profile_id" uuid NOT NULL,
  "statut" text,
  "updated_at" timestamptz,
  "updated_by" text
);
ALTER TABLE public.rh_onboarding_offboarding ENABLE ROW LEVEL SECURITY;

-- role_definitions (5 colonnes)
CREATE TABLE IF NOT EXISTS public.role_definitions (
  "description" text,
  "display_name" text NOT NULL,
  "is_system" boolean NOT NULL,
  "role" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

-- role_permissions (5 colonnes)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  "granted" boolean NOT NULL,
  "id" numeric PRIMARY KEY,
  "permission" text NOT NULL,
  "role" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- secret_rotation_log (7 colonnes)
CREATE TABLE IF NOT EXISTS public.secret_rotation_log (
  "cadence" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "notes" text,
  "rotated_at" timestamptz NOT NULL,
  "rotated_by" text,
  "secret_name" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.secret_rotation_log ENABLE ROW LEVEL SECURITY;

-- signature_events (9 colonnes)
CREATE TABLE IF NOT EXISTS public.signature_events (
  "created_at" timestamptz NOT NULL,
  "event_type" jsonb NOT NULL,
  "id" uuid PRIMARY KEY,
  "ip_address" text NOT NULL,
  "payload" jsonb NOT NULL,
  "request_id" uuid NOT NULL,
  "signer_email" text,
  "signer_name" text,
  "user_agent" text
);
ALTER TABLE public.signature_events ENABLE ROW LEVEL SECURITY;

-- signature_requests (21 colonnes)
CREATE TABLE IF NOT EXISTS public.signature_requests (
  "audit_log_url" text,
  "cancelled_at" timestamptz,
  "completed_at" timestamptz,
  "contrat_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "document_hash" text,
  "document_path" text,
  "expire_at" timestamptz,
  "id" uuid PRIMARY KEY,
  "last_reminder_at" timestamptz,
  "message" text,
  "metadata" jsonb NOT NULL,
  "provider" text NOT NULL,
  "provider_request_id" uuid,
  "provider_url" text,
  "reminders_sent" numeric NOT NULL,
  "signed_document_path" text,
  "signers" jsonb NOT NULL,
  "status" text NOT NULL,
  "updated_at" timestamptz NOT NULL
);
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

-- system_flags (5 colonnes)
CREATE TABLE IF NOT EXISTS public.system_flags (
  "description" text,
  "enabled" boolean NOT NULL,
  "key" text NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "updated_by" text
);
ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;

-- taches_statut_historique (7 colonnes)
CREATE TABLE IF NOT EXISTS public.taches_statut_historique (
  "ancien_statut" jsonb,
  "changed_at" timestamptz NOT NULL,
  "changed_by" text,
  "commentaire" text,
  "id" uuid PRIMARY KEY,
  "nouveau_statut" jsonb NOT NULL,
  "tache_id" uuid NOT NULL
);
ALTER TABLE public.taches_statut_historique ENABLE ROW LEVEL SECURITY;

-- transcription_action_suggestions (13 colonnes)
CREATE TABLE IF NOT EXISTS public.transcription_action_suggestions (
  "created_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "promoted_tache_id" uuid,
  "proposed_assignee_id" uuid,
  "proposed_assignee_name" text,
  "proposed_deadline" text,
  "proposed_etablissement_id" uuid,
  "proposed_priority" text,
  "proposed_text" text NOT NULL,
  "reviewed_at" timestamptz,
  "reviewed_by" text,
  "session_id" uuid NOT NULL,
  "status" text NOT NULL
);
ALTER TABLE public.transcription_action_suggestions ENABLE ROW LEVEL SECURITY;

-- user_writing_style (9 colonnes)
CREATE TABLE IF NOT EXISTS public.user_writing_style (
  "created_at" timestamptz NOT NULL,
  "enabled" boolean NOT NULL,
  "last_analyzed_at" timestamptz,
  "sample_count" integer NOT NULL,
  "style_profile" jsonb NOT NULL,
  "tone_summary" text NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "user_id" uuid NOT NULL,
  "user_overrides" jsonb NOT NULL
);
ALTER TABLE public.user_writing_style ENABLE ROW LEVEL SECURITY;

-- webhook_idempotency_keys (7 colonnes)
CREATE TABLE IF NOT EXISTS public.webhook_idempotency_keys (
  "created_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "id" uuid PRIMARY KEY,
  "key" text NOT NULL,
  "request_hash" text,
  "result" jsonb,
  "scope" text NOT NULL
);
ALTER TABLE public.webhook_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- workflow_alert_config (11 colonnes)
CREATE TABLE IF NOT EXISTS public.workflow_alert_config (
  "created_at" timestamptz NOT NULL,
  "failure_rate_threshold" numeric NOT NULL,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "last_triggered_at" timestamptz,
  "min_runs" numeric NOT NULL,
  "notify_user_ids" text[] NOT NULL,
  "scheduled_backlog_threshold" numeric NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "window_minutes" numeric NOT NULL,
  "workflow_id" uuid
);
ALTER TABLE public.workflow_alert_config ENABLE ROW LEVEL SECURITY;

-- workflow_versions (11 colonnes)
CREATE TABLE IF NOT EXISTS public.workflow_versions (
  "comment" text,
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "description" text,
  "graph" jsonb NOT NULL,
  "id" uuid PRIMARY KEY,
  "nom" text NOT NULL,
  "trigger_config" jsonb NOT NULL,
  "trigger_type" text NOT NULL,
  "version_number" numeric NOT NULL,
  "workflow_id" uuid NOT NULL
);
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

-- workflow_webhook_tokens (10 colonnes)
CREATE TABLE IF NOT EXISTS public.workflow_webhook_tokens (
  "created_at" timestamptz NOT NULL,
  "created_by" text,
  "id" uuid PRIMARY KEY,
  "is_active" boolean NOT NULL,
  "label" text,
  "last_used_at" timestamptz,
  "token" text NOT NULL,
  "total_calls" numeric NOT NULL,
  "webhook_secret" text,
  "workflow_id" uuid NOT NULL
);
ALTER TABLE public.workflow_webhook_tokens ENABLE ROW LEVEL SECURITY;

