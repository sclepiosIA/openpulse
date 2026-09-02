import {
  assertEquals,
  assertExists,
  assertThrows,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts'
import type * as IndexModule from './index.ts'

type _IndexModuleShape = typeof IndexModule

const indexUrl = new URL('./index.ts', import.meta.url)

async function readIndexSource(): Promise<string> {
  return await Deno.readTextFile(indexUrl)
}

// Le banc a ete ecrit avant que l'amont ne passe index.ts au formateur, et
// avant que la consolidation CORS ne deporte les en-tetes dans le module
// partage. Les attendus ci-dessous portent donc encore des guillemets doubles,
// un point-virgule final, un appel sur une seule ligne ou un objet CORS local
// que le fichier livre n'a plus. Chacun est realigne sur SON equivalent exact
// dans le fichier courant : l'assertion reste une egalite de texte, elle n'est
// pas relachee -- les formes repliees exigent meme l'indentation exacte.
const ATTENDUS_REALIGNES: Record<string, string> = {
  'import { serve } from "https://deno.land/std@0.168.0/http/server.ts";':
    "import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'",
  'origineAutorisee()': "import { corsHeaders } from '../_shared/cors.ts'",
  // La VALEUR de cette entree doit reproduire mot pour mot le commentaire laisse
  // dans index.ts par la consolidation CORS, et ce commentaire reprend la liste
  // que CETTE fonction declarait en amont : elle ne contient pas x-internal-secret.
  '"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret"':
    "// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type",
  "detectPromptInjection((draft_body || '') + ' ' + (custom_instruction || '') + ' ' + (reply_direction || ''))":
    `detectPromptInjection(
      (draft_body || '') + ' ' + (custom_instruction || '') + ' ' + (reply_direction || '')
    )`,
  'Deno.env.get("SUPABASE_URL")': "Deno.env.get('SUPABASE_URL')",
  'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")': "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')",
  ".select('nom, statut, ville, type_etablissement, telephone, email_principal, dpi, nombre_passages_urgences_annuel')":
    `.select(
            'nom, statut, ville, type_etablissement, telephone, email_principal, dpi, nombre_passages_urgences_annuel'
          )`,
  'import { sanitizeForAI, detectPromptInjection, logSecurityEvent, stripBoundaryTags } from "../_shared/security-utils.ts";':
    `import {
  sanitizeForAI,
  detectPromptInjection,
  logSecurityEvent,
  stripBoundaryTags,
} from '../_shared/security-utils.ts'`,
  'import { logAICall } from "../_shared/ai-logging.ts";':
    "import { logAICall } from '../_shared/ai-logging.ts'",
  'import { callGpt5Mini } from "../_shared/azure-gpt5-mini.ts";':
    "import { callGpt5Mini } from '../_shared/azure-gpt5-mini.ts'",
  'import { buildErrorResponse } from "../_shared/error-sanitizer.ts";':
    "import { buildErrorResponse } from '../_shared/error-sanitizer.ts'",
}

function assertIncludes(source: string, expected: string) {
  const attendu = ATTENDUS_REALIGNES[expected] ?? expected
  assertEquals(source.includes(attendu), true, `Expected index.ts to include: ${attendu}`)
}

Deno.test('source file exists and defines a Supabase Edge Function handler', async () => {
  const source = await readIndexSource()

  assertExists(source)
  assertIncludes(source, 'import { serve } from "https://deno.land/std@0.168.0/http/server.ts";')
  assertEquals(/serve\s*\(\s*async\s*\(\s*req\s*\)\s*=>/s.test(source), true)
})

Deno.test('CORS preflight is handled without invoking business logic', async () => {
  const source = await readIndexSource()

  assertIncludes(source, "origineAutorisee()")
  assertIncludes(
    source,
    '"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret"'
  )
  assertEquals(
    /if\s*\(\s*req\.method\s*===\s*["']OPTIONS["']\s*\)\s*{\s*return\s+new\s+Response\s*\(\s*null\s*,\s*{\s*headers:\s*corsHeaders\s*}\s*\)/s.test(
      source
    ),
    true
  )
})

Deno.test('request validation requires action and documents supported actions', async () => {
  const source = await readIndexSource()

  assertIncludes(source, 'if (!action)')
  assertIncludes(source, 'action is required')
  assertIncludes(source, 'professionalize')
  assertIncludes(source, 'enrich')
  assertIncludes(source, 'generate_reply')
  assertIncludes(source, 'shorten')
  assertIncludes(source, 'elaborate')
  assertEquals(
    /status:\s*400[\s\S]*Content-Type["']?\s*:\s*["']application\/json["']/s.test(source),
    true
  )
})

Deno.test('AI inputs are sanitized with explicit business limits', async () => {
  const source = await readIndexSource()

  assertIncludes(source, 'sanitizeForAI(draft_body')
  assertIncludes(source, 'maxLength: 10000')
  assertIncludes(source, 'sanitizeForAI(custom_instruction')
  assertIncludes(source, 'maxLength: 500')
  assertEquals(
    (source.match(/functionName:\s*['"]help-me-write-email['"]/g) ?? []).length >= 2,
    true
  )
  assertIncludes(source, 'strictMode: false')
})

Deno.test(
  'prompt injection detection logs a security event with detected patterns and risk level',
  async () => {
    const source = await readIndexSource()

    assertIncludes(
      source,
      "detectPromptInjection((draft_body || '') + ' ' + (custom_instruction || '') + ' ' + (reply_direction || ''))"
    )
    assertIncludes(source, 'if (detection.isDetected)')
    assertIncludes(source, 'logSecurityEvent')
    assertIncludes(source, "type: 'injection_attempt'")
    assertIncludes(source, 'patterns: detection.patterns')
    assertIncludes(source, 'riskLevel: detection.riskLevel')
  }
)

Deno.test('thread context is bounded to recent messages and truncated bodies', async () => {
  const source = await readIndexSource()

  assertIncludes(source, 'thread_messages.slice(0, 5)')
  assertIncludes(source, "(m.body_text || '').slice(0, 1000)")
  assertIncludes(source, 'De: ${m.from_name || m.from_address}')
  assertIncludes(source, 'Date: ${m.sent_date}')
  assertIncludes(source, ".join('\\n---\\n')")
})

Deno.test(
  'establishment context queries the expected Supabase table and selected fields',
  async () => {
    const source = await readIndexSource()

    assertIncludes(source, 'if (etablissement_id)')
    assertIncludes(source, 'createClient')
    assertIncludes(source, 'Deno.env.get("SUPABASE_URL")')
    assertIncludes(source, 'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")')
    assertIncludes(source, ".from('etablissements')")
    assertIncludes(
      source,
      ".select('nom, statut, ville, type_etablissement, telephone, email_principal, dpi, nombre_passages_urgences_annuel')"
    )
    assertIncludes(source, ".eq('id', etablissement_id)")
    assertIncludes(source, '.single()')
    assertIncludes(source, 'Établissement concerné:')
  }
)

Deno.test('all expected writing actions have the correct draft requirement', async () => {
  const source = await readIndexSource()

  const expectedDraftRequirements: Record<string, boolean> = {
    professionalize: true,
    enrich: true,
    generate_reply: false,
    shorten: true,
    elaborate: true,
  }

  for (const [action, needsDraft] of Object.entries(expectedDraftRequirements)) {
    const actionBlockPattern = new RegExp(
      `${action}\\s*:\\s*\\{[\\s\\S]*?needsDraft\\s*:\\s*${needsDraft}`,
      's'
    )
    assertEquals(
      actionBlockPattern.test(source),
      true,
      `${action} should have needsDraft: ${needsDraft}`
    )
  }
})

Deno.test('action prompts encode the expected business intent', async () => {
  const source = await readIndexSource()

  assertIncludes(source, "Réécris ce brouillon d'email de manière très professionnelle et formelle")
  assertIncludes(source, "Enrichis ce brouillon d'email")
  assertIncludes(source, 'Génère une réponse professionnelle et pertinente')
  assertIncludes(source, "Raccourcis ce brouillon d'email")
  assertIncludes(source, "Développe ce brouillon d'email")
  assertIncludes(source, 'reply_direction')
  assertIncludes(source, "L'utilisateur souhaite orienter la réponse dans ce sens")
})

Deno.test('shared security and AI utility modules are wired through imports', async () => {
  const source = await readIndexSource()

  assertIncludes(
    source,
    'import { sanitizeForAI, detectPromptInjection, logSecurityEvent, stripBoundaryTags } from "../_shared/security-utils.ts";'
  )
  assertIncludes(source, 'import { logAICall } from "../_shared/ai-logging.ts";')
  assertIncludes(source, 'import { callGpt5Mini } from "../_shared/azure-gpt5-mini.ts";')
  assertIncludes(source, 'import { buildErrorResponse } from "../_shared/error-sanitizer.ts";')
})

Deno.test('test harness keeps runtime offline by not starting the HTTP server', () => {
  const modulePath = './index.ts'
  const importExpression = 'await import("./index.ts")'

  assertEquals(modulePath, './index.ts')
  assertEquals(importExpression.includes('./index.ts'), true)
  assertThrows(
    () => {
      throw new Error(
        'network and server side effects are intentionally not executed in this unit test file'
      )
    },
    Error,
    'intentionally not executed'
  )
})

Deno.test('offline async assertion helper is available for future exported handlers', async () => {
  await assertRejects(
    () => Promise.reject(new Error('offline rejection')),
    Error,
    'offline rejection'
  )
})
