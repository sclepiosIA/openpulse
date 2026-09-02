// BI Studio — Exécution sécurisée d'une question depuis son JSON-DSL.
// Le SQL est reconstruit côté serveur avec une whitelist stricte (pas de SQL libre).
// La requête est exécutée SOUS l'identité du caller via son JWT → RLS s'applique.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ---------- Whitelist DSL ----------
const AGG_FN = new Set(['sum', 'avg', 'count', 'min', 'max', 'count_distinct'])
const OPS = new Set([
  '=',
  '!=',
  '<>',
  '<',
  '<=',
  '>',
  '>=',
  'in',
  'not_in',
  'between',
  'ilike',
  'like',
  'is_null',
  'is_not_null',
])
const DIR = new Set(['asc', 'desc'])
const DATE_TRUNC = new Set(['day', 'week', 'month', 'quarter', 'year'])
const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/
const VIEW_RE = /^public\.bi_v_[a-zA-Z0-9_]{1,60}$/

function assertIdent(x: unknown, label: string): string {
  if (typeof x !== 'string' || !IDENT_RE.test(x)) {
    throw new Error(`Invalid identifier for ${label}: ${JSON.stringify(x)}`)
  }
  return x
}
function assertView(x: unknown): string {
  if (typeof x !== 'string' || !VIEW_RE.test(x)) {
    throw new Error(`Invalid source_view: ${JSON.stringify(x)}`)
  }
  return x
}

interface DSL {
  filters?: Array<{ col: string; op: string; value?: unknown; date_trunc?: string }>
  group_by?: Array<{ col: string; date_trunc?: string; alias?: string }>
  aggregations?: Array<{ fn: string; col?: string; alias: string }>
  order_by?: Array<{ col: string; dir?: string }>
  limit?: number
}

function buildSQL(
  sourceView: string,
  dsl: DSL,
  columns: Array<{ name: string }>
): { sql: string; params: unknown[] } {
  const validCols = new Set(columns.map((c) => c.name))
  const params: unknown[] = []
  const push = (v: unknown) => {
    params.push(v)
    return `$${params.length}`
  }

  // --------- SELECT ---------
  const selectParts: string[] = []

  for (const g of dsl.group_by ?? []) {
    if (!validCols.has(g.col)) throw new Error(`Unknown column: ${g.col}`)
    const c = assertIdent(g.col, 'group_by.col')
    const alias = g.alias ? assertIdent(g.alias, 'group_by.alias') : c
    if (g.date_trunc) {
      if (!DATE_TRUNC.has(g.date_trunc)) throw new Error(`Invalid date_trunc: ${g.date_trunc}`)
      selectParts.push(`date_trunc('${g.date_trunc}', "${c}")::date AS "${alias}"`)
    } else {
      selectParts.push(`"${c}" AS "${alias}"`)
    }
  }

  const aggs = dsl.aggregations ?? []
  if (aggs.length === 0 && (dsl.group_by?.length ?? 0) === 0) {
    // pas d'agrégat ni de group_by → sélection brute de toutes les colonnes déclarées
    selectParts.push(columns.map((c) => `"${assertIdent(c.name, 'column')}"`).join(', '))
  }
  for (const a of aggs) {
    if (!AGG_FN.has(a.fn)) throw new Error(`Invalid aggregation fn: ${a.fn}`)
    const alias = assertIdent(a.alias, 'agg.alias')
    if (a.fn === 'count' && !a.col) {
      selectParts.push(`COUNT(*) AS "${alias}"`)
    } else if (a.fn === 'count_distinct') {
      if (!a.col || !validCols.has(a.col)) throw new Error(`Invalid col for count_distinct`)
      selectParts.push(`COUNT(DISTINCT "${assertIdent(a.col, 'agg.col')}") AS "${alias}"`)
    } else {
      if (!a.col || !validCols.has(a.col)) throw new Error(`Invalid col for ${a.fn}: ${a.col}`)
      const fn = a.fn.toUpperCase()
      selectParts.push(`${fn}("${assertIdent(a.col, 'agg.col')}") AS "${alias}"`)
    }
  }

  // --------- WHERE ---------
  const whereParts: string[] = []
  for (const f of dsl.filters ?? []) {
    if (!validCols.has(f.col)) throw new Error(`Unknown filter column: ${f.col}`)
    if (!OPS.has(f.op)) throw new Error(`Invalid filter op: ${f.op}`)
    const c = assertIdent(f.col, 'filter.col')
    const lhs = f.date_trunc
      ? DATE_TRUNC.has(f.date_trunc)
        ? `date_trunc('${f.date_trunc}', "${c}")`
        : (() => {
            throw new Error('bad date_trunc')
          })()
      : `"${c}"`
    switch (f.op) {
      case 'is_null':
        whereParts.push(`${lhs} IS NULL`)
        break
      case 'is_not_null':
        whereParts.push(`${lhs} IS NOT NULL`)
        break
      case 'in':
      case 'not_in': {
        if (!Array.isArray(f.value) || f.value.length === 0) throw new Error('in: array required')
        const placeholders = f.value.map((v) => push(v)).join(', ')
        whereParts.push(`${lhs} ${f.op === 'in' ? 'IN' : 'NOT IN'} (${placeholders})`)
        break
      }
      case 'between': {
        if (!Array.isArray(f.value) || f.value.length !== 2)
          throw new Error('between: [a,b] required')
        whereParts.push(`${lhs} BETWEEN ${push(f.value[0])} AND ${push(f.value[1])}`)
        break
      }
      case 'ilike':
      case 'like': {
        whereParts.push(`${lhs} ${f.op.toUpperCase()} ${push(f.value)}`)
        break
      }
      case '!=':
      case '<>':
        whereParts.push(`${lhs} <> ${push(f.value)}`)
        break
      default:
        whereParts.push(`${lhs} ${f.op} ${push(f.value)}`)
    }
  }

  // --------- GROUP BY ---------
  const groupParts = (dsl.group_by ?? []).map((_, i) => `${i + 1}`)

  // --------- ORDER BY ---------
  const orderParts: string[] = []
  const aliasSet = new Set([
    ...(dsl.group_by ?? []).map((g) => g.alias || g.col),
    ...aggs.map((a) => a.alias),
    ...columns.map((c) => c.name),
  ])
  for (const o of dsl.order_by ?? []) {
    if (!aliasSet.has(o.col)) throw new Error(`Unknown order_by column: ${o.col}`)
    const dir = (o.dir ?? 'asc').toLowerCase()
    if (!DIR.has(dir)) throw new Error(`Invalid order dir: ${dir}`)
    orderParts.push(`"${assertIdent(o.col, 'order.col')}" ${dir.toUpperCase()}`)
  }

  // --------- LIMIT ---------
  const limit = Math.min(Math.max(Number(dsl.limit ?? 5000) | 0, 1), 50000)

  let sql = `SELECT ${selectParts.join(', ')} FROM ${sourceView}`
  if (whereParts.length) sql += ` WHERE ${whereParts.join(' AND ')}`
  if (groupParts.length) sql += ` GROUP BY ${groupParts.join(', ')}`
  if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`
  sql += ` LIMIT ${limit}`

  return { sql, params }
}

// ---------- HTTP handler ----------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const questionId = String(body.question_id ?? '')
    if (!questionId) return json({ error: 'question_id required' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Client caller-scoped (RLS s'applique)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Récupère la question + son dataset (RLS: admin/direction only)
    const { data: q, error: qErr } = await userClient
      .from('bi_questions')
      .select('id, definition, dataset_id, viz_type')
      .eq('id', questionId)
      .maybeSingle()
    if (qErr || !q) return json({ error: 'Question not found or forbidden' }, 404)

    const { data: ds, error: dsErr } = await userClient
      .from('bi_datasets')
      .select('id, source_view, columns, allowed_roles')
      .eq('id', q.dataset_id)
      .maybeSingle()
    if (dsErr || !ds) return json({ error: 'Dataset not found or forbidden' }, 404)

    const sourceView = assertView(ds.source_view)
    const columns = Array.isArray(ds.columns) ? (ds.columns as Array<{ name: string }>) : []

    const { sql, params } = buildSQL(sourceView, q.definition as DSL, columns)

    // Cache lookup
    const enc = new TextEncoder()
    const digest = await crypto.subtle.digest(
      'SHA-256',
      enc.encode(JSON.stringify({ sql, params, u: authHeader.slice(-20) }))
    )
    const cacheKey = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const { data: cached } = await userClient
      .from('bi_query_cache')
      .select('result, row_count, duration_ms')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (cached) {
      return json({
        rows: cached.result,
        row_count: cached.row_count,
        cached: true,
        duration_ms: cached.duration_ms,
        sql,
      })
    }

    // Exécution via RPC bi_execute (créée dans une prochaine migration si besoin de SQL dynamique).
    // Pour V1 : on utilise supabase-js .from(view) avec les filtres reconstruits
    // MAIS notre DSL supporte agrégats/date_trunc/group_by → on doit passer par une fonction SQL.
    //
    // V1 pragmatique : on exécute la vue "en brut" via .from() SANS agrégat, et on fait les agrégats en JS.
    // Cela reste sécurisé (RLS s'applique) et suffit pour < 5000 lignes.
    const t0 = Date.now()
    const viewName = sourceView.replace(/^public\./, '')
    let query = userClient.from(viewName).select('*', { count: 'exact' })

    // Applique filtres (uniquement ceux exprimables via PostgREST)
    for (const f of (q.definition as DSL).filters ?? []) {
      const col = f.col
      switch (f.op) {
        case '=':
          query = query.eq(col, f.value)
          break
        case '!=':
        case '<>':
          query = query.neq(col, f.value)
          break
        case '<':
          query = query.lt(col, f.value)
          break
        case '<=':
          query = query.lte(col, f.value)
          break
        case '>':
          query = query.gt(col, f.value)
          break
        case '>=':
          query = query.gte(col, f.value)
          break
        case 'ilike':
          query = query.ilike(col, String(f.value))
          break
        case 'like':
          query = query.like(col, String(f.value))
          break
        case 'in':
          query = query.in(col, f.value as unknown[])
          break
        case 'is_null':
          query = query.is(col, null)
          break
        case 'is_not_null':
          query = query.not(col, 'is', null)
          break
        case 'between': {
          const [a, b] = f.value as [unknown, unknown]
          query = query.gte(col, a).lte(col, b)
          break
        }
      }
    }

    // Order & limit
    for (const o of (q.definition as DSL).order_by ?? []) {
      const validCols = new Set(columns.map((c) => c.name))
      if (validCols.has(o.col)) {
        query = query.order(o.col, { ascending: (o.dir ?? 'asc') === 'asc' })
      }
    }
    const limit = Math.min(Number((q.definition as DSL).limit ?? 5000), 10000)
    query = query.limit(limit)

    const { data: rows, error: runErr } = await query
    if (runErr) return json({ error: `Query failed: ${runErr.message}` }, 400)

    // Aggregation JS-side si demandé
    const dsl = q.definition as DSL
    let finalRows = rows ?? []
    if ((dsl.group_by?.length ?? 0) > 0 || (dsl.aggregations?.length ?? 0) > 0) {
      finalRows = aggregateInJs(finalRows, dsl)
    }

    const duration_ms = Date.now() - t0

    // Store cache (30s par défaut ; réactif mais réduit la charge)
    await userClient.from('bi_query_cache').insert({
      cache_key: cacheKey,
      question_id: questionId,
      result: finalRows,
      row_count: finalRows.length,
      duration_ms,
      expires_at: new Date(Date.now() + 30_000).toISOString(),
    })

    return json({ rows: finalRows, row_count: finalRows.length, cached: false, duration_ms, sql })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[bi-run-query]', msg)
    return json({ error: msg }, 400)
  }
})

function aggregateInJs(rows: Record<string, unknown>[], dsl: DSL): Record<string, unknown>[] {
  const groupBy = dsl.group_by ?? []
  const aggs = dsl.aggregations ?? []

  const keyOf = (r: Record<string, unknown>) =>
    groupBy
      .map((g) => {
        const raw = r[g.col]
        if (g.date_trunc && raw) {
          const d = new Date(String(raw))
          if (!Number.isNaN(d.getTime())) {
            switch (g.date_trunc) {
              case 'day':
                return d.toISOString().slice(0, 10)
              case 'week': {
                const day = d.getUTCDay() || 7
                const monday = new Date(d)
                monday.setUTCDate(d.getUTCDate() - day + 1)
                return monday.toISOString().slice(0, 10)
              }
              case 'month':
                return d.toISOString().slice(0, 7) + '-01'
              case 'quarter':
                return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`
              case 'year':
                return `${d.getUTCFullYear()}-01-01`
            }
          }
        }
        return raw ?? null
      })
      .join('\u0001')

  const buckets = new Map<string, { key: unknown[]; items: Record<string, unknown>[] }>()
  for (const r of rows) {
    const k = keyOf(r)
    const bucket = buckets.get(k)
    if (bucket) bucket.items.push(r)
    else buckets.set(k, { key: groupBy.map((g) => r[g.col]), items: [r] })
  }

  const result: Record<string, unknown>[] = []
  for (const b of buckets.values()) {
    const out: Record<string, unknown> = {}
    groupBy.forEach((g, i) => {
      out[g.alias || g.col] = b.key[i]
    })
    for (const a of aggs) {
      const values = b.items.map((it) => (a.col ? it[a.col] : null))
      switch (a.fn) {
        case 'count':
          out[a.alias] = b.items.length
          break
        case 'count_distinct':
          out[a.alias] = new Set(values).size
          break
        case 'sum':
          out[a.alias] = values.reduce((s: number, v) => s + (Number(v) || 0), 0)
          break
        case 'avg': {
          const nums = values.map((v) => Number(v)).filter((v) => !Number.isNaN(v))
          out[a.alias] = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null
          break
        }
        case 'min':
          out[a.alias] = values.reduce((m: number | null, v) => {
            const n = Number(v)
            if (Number.isNaN(n)) return m
            return m === null || n < m ? n : m
          }, null)
          break
        case 'max':
          out[a.alias] = values.reduce((m: number | null, v) => {
            const n = Number(v)
            if (Number.isNaN(n)) return m
            return m === null || n > m ? n : m
          }, null)
          break
      }
    }
    result.push(out)
  }
  return result
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
