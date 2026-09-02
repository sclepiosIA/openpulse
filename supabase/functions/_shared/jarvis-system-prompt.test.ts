import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { getJarvisSystemPrompt, getJarvisStreamingPrompt } from './jarvis-system-prompt.ts'

Deno.test('getJarvisSystemPrompt retourne une chaîne non vide avec identité JARVIS', () => {
  const prompt = getJarvisSystemPrompt()

  assertExists(prompt)
  assertEquals(typeof prompt, 'string')
  assertEquals(prompt.startsWith('Tu es JARVIS 15.1'), true)
  assertEquals(prompt.includes('OpenPulse'), true)
  assertEquals(prompt.length > 1000, true)
})

Deno.test('getJarvisStreamingPrompt retourne une chaîne non vide avec identité JARVIS', () => {
  const prompt = getJarvisStreamingPrompt()

  assertExists(prompt)
  assertEquals(typeof prompt, 'string')
  assertEquals(prompt.startsWith('Tu es JARVIS 15.1'), true)
  assertEquals(prompt.includes('OpenPulse'), true)
  assertEquals(prompt.length > 300, true)
})

Deno.test('le prompt complet contient les sections métier critiques', () => {
  const prompt = getJarvisSystemPrompt()

  const expectedSections = [
    '🔑 MODE PRÉSIDENTIEL',
    'CAPACITÉS COMPLÈTES (135+ outils)',
    '⚠️ WORKFLOWS CROSS-MODULES',
    '⚠️ DISTINCTION CRITIQUE - RECHERCHE DE PERSONNES',
    "⚠️ RÈGLE CRITIQUE - ENVOI D'EMAIL",
    '⚠️ RÈGLE CRITIQUE - VÉRIFICATION DES DONNÉES CONTEXTUELLES',
    'STATUTS DE TÂCHES VALIDES',
    '⚠️ SCHÉMA CRITIQUE DES TABLES',
    'ACCÈS AUX DONNÉES (CRITIQUE)',
    '⚠️ DONNÉES CONTEXTUELLES DÉJÀ DISPONIBLES',
    'RÈGLES IMPORTANTES',
    'FORMAT DE RÉPONSE (OBLIGATOIRE)',
    'FORMAT DES RÉFÉRENCES (OBLIGATOIRE - liens cliquables)',
    'EXEMPLES DE REQUÊTES QUE TU PEUX TRAITER',
  ]

  for (const section of expectedSections) {
    assertEquals(prompt.includes(section), true)
  }
})

Deno.test('le prompt streaming contient les sections condensées essentielles', () => {
  const prompt = getJarvisStreamingPrompt()

  const expectedSections = [
    'IDENTITÉ:',
    'CAPACITÉS (135+ outils)',
    'WORKFLOWS CROSS-MODULES',
    'ACCÈS:',
    'DONNÉES CONTEXTUELLES:',
    'SCHÉMA TABLES CRITIQUES',
    'RÈGLES:',
    'FORMAT (OBLIGATOIRE): TOUJOURS du Markdown',
    'FORMAT DES RÉFÉRENCES (liens cliquables)',
  ]

  for (const section of expectedSections) {
    assertEquals(prompt.includes(section), true)
  }
})

Deno.test("les deux prompts incluent la date du jour en français avec préfixe Aujourd'hui", () => {
  const expectedPrefix = "Aujourd'hui: "
  const systemPrompt = getJarvisSystemPrompt()
  const streamingPrompt = getJarvisStreamingPrompt()

  assertEquals(systemPrompt.includes(expectedPrefix), true)
  assertEquals(streamingPrompt.includes(expectedPrefix), true)

  const expectedToday = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  assertEquals(systemPrompt.includes(`Aujourd'hui: ${expectedToday}`), true)
  assertEquals(streamingPrompt.includes(`Aujourd'hui: ${expectedToday}`), true)
})

Deno.test('le prompt complet référence correctement les statuts métier exacts', () => {
  const prompt = getJarvisSystemPrompt()

  assertEquals(
    prompt.includes('STATUTS DE TÂCHES VALIDES: "A faire", "En cours", "Terminé", "Bloqué"'),
    true
  )
  assertEquals(
    prompt.includes(
      'support_tickets: id, titre, description, statut (PAS status! Valeurs: "Ouvert", "En cours", "Résolu", "Fermé")'
    ),
    true
  )
})

Deno.test('le prompt complet impose les noms de colonnes critiques exacts', () => {
  const prompt = getJarvisSystemPrompt()

  const exactSchemaRules = [
    'echeance (PAS date_echeance!)',
    'last_message_date (PAS last_message_at!)',
    'unread_count (PAS is_read!)',
    'statut (PAS status!',
    'priorite (PAS priority!)',
  ]

  for (const rule of exactSchemaRules) {
    assertEquals(prompt.includes(rule), true)
  }
})

Deno.test('le prompt streaming conserve les noms de colonnes critiques exacts', () => {
  const prompt = getJarvisStreamingPrompt()

  const exactSchemaRules = [
    'echeance (PAS date_echeance!)',
    'last_message_date (PAS last_message_at!)',
    'unread_count (PAS is_read!)',
    'statut (PAS status!)',
    'priorite (PAS priority!)',
  ]

  for (const rule of exactSchemaRules) {
    assertEquals(prompt.includes(rule), true)
  }
})

Deno.test('le prompt complet contient les règles email et query_database critiques', () => {
  const prompt = getJarvisSystemPrompt()

  assertEquals(prompt.includes("Si l'utilisateur fournit une ADRESSE EMAIL DIRECTE"), true)
  assertEquals(prompt.includes('utilise send_email DIRECTEMENT avec cette adresse'), true)
  assertEquals(
    prompt.includes('suggest_email_response est UNIQUEMENT pour analyser un thread existant'),
    true
  )
  assertEquals(
    prompt.includes('UTILISER query_database pour récupérer les données RÉELLES de la base'),
    true
  )
  assertEquals(prompt.includes('Ne JAMAIS inventer ou supposer des données'), true)
})

Deno.test('les références cliquables attendues sont présentes dans le prompt complet', () => {
  const prompt = getJarvisSystemPrompt()

  const referenceFormats = [
    '[[email:UUID|titre du mail]]',
    '[[task:UUID|titre de la tâche]]',
    "[[etablissement:UUID|nom de l'établissement]]",
    '[[ticket:UUID|titre du ticket]]',
    "[[event:UUID|titre de l'événement]]",
    '[[contact:UUID|prénom nom]]',
  ]

  for (const format of referenceFormats) {
    assertEquals(prompt.includes(format), true)
  }
})

Deno.test('les références cliquables attendues sont présentes dans le prompt streaming', () => {
  const prompt = getJarvisStreamingPrompt()

  const referenceFormats = [
    '[[email:UUID|titre]]',
    '[[task:UUID|titre]]',
    '[[etablissement:UUID|nom]]',
    '[[ticket:UUID|titre]]',
    '[[event:UUID|titre]]',
    '[[contact:UUID|nom]]',
  ]

  for (const format of referenceFormats) {
    assertEquals(prompt.includes(format), true)
  }
})

Deno.test('le prompt complet inclut des workflows cross-modules concrets', () => {
  const prompt = getJarvisSystemPrompt()

  const workflows = [
    'manage_devis (get) → convert_devis_to_invoice → send_email',
    'create_support_ticket → create_task → schedule_meeting',
    'manage_etablissement → create_task (×N) → schedule_meeting → send_email',
    'query_database (devis) → send_email → manage_devis (update statut)',
    'manage_sprint (close) → calculate_rd_metrics → generate_report',
    'get_csm_health_score → get_csm_kpis → send_email (rapport)',
  ]

  for (const workflow of workflows) {
    assertEquals(prompt.includes(workflow), true)
  }
})

Deno.test("le prompt complet couvre les familles d'outils clés attendues", () => {
  const prompt = getJarvisSystemPrompt()

  const toolNames = [
    'manage_etablissement',
    'send_email',
    'translate_email',
    'create_task',
    'schedule_meeting',
    'create_invoice',
    'manage_devis',
    'parse_payslip',
    'create_training_session',
    'manage_epic',
    'manage_job_offer',
    'generate_contract',
    'create_support_ticket',
    'get_csm_health_score',
    'manage_forum_post',
    'manage_document',
    'manage_user',
    'get_dashboard_summary',
    'execute_workflow',
  ]

  for (const tool of toolNames) {
    assertEquals(prompt.includes(tool), true)
  }
})

Deno.test(
  'la version streaming est plus courte que la version complète tout en gardant les règles clés',
  () => {
    const full = getJarvisSystemPrompt()
    const streaming = getJarvisStreamingPrompt()

    assertEquals(streaming.length < full.length, true)
    assertEquals(streaming.includes('TOUJOURS du Markdown'), true)
    assertEquals(streaming.includes('Ne dis jamais "souhaitez-vous que je..." - FAIS-LE.'), true)
    assertEquals(streaming.includes('Tu peux chaîner plusieurs outils'), true)
  }
)

Deno.test("les prompts n'utilisent pas de placeholders non résolus", () => {
  const prompts = [getJarvisSystemPrompt(), getJarvisStreamingPrompt()]

  for (const prompt of prompts) {
    assertEquals(prompt.includes('${today}'), false)
    assertEquals(prompt.includes('undefined'), false)
    assertEquals(prompt.includes('null'), false)
  }
})

Deno.test('les prompts imposent le markdown et la signature des emails', () => {
  const full = getJarvisSystemPrompt()
  const streaming = getJarvisStreamingPrompt()

  assertEquals(full.includes('Tu DOIS utiliser le Markdown dans CHAQUE réponse'), true)
  assertEquals(full.includes("SIGNE les emails au nom de l'utilisateur"), true)
  assertEquals(streaming.includes('TOUJOURS du Markdown'), true)
  assertEquals(streaming.includes('## titres'), true)
})

Deno.test('les fonctions exportées sont appelables sans erreur', () => {
  assertThrows(() => {
    throw new Error('sentinel')
  })

  const full = getJarvisSystemPrompt()
  const streaming = getJarvisStreamingPrompt()

  assertEquals(typeof full, 'string')
  assertEquals(typeof streaming, 'string')
})

Deno.test('les fonctions exportées ne retournent pas de promesse', async () => {
  const full = getJarvisSystemPrompt()
  const streaming = getJarvisStreamingPrompt()

  assertEquals((full as unknown) instanceof Promise, false)
  assertEquals((streaming as unknown) instanceof Promise, false)

  await assertRejects(async () => {
    await Promise.reject(new Error('sentinel'))
  })
})
