import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  X,
  Trash2,
  Image as ImageIcon,
  Video,
  Linkedin,
  Download,
  Save,
  Undo2,
  Redo2,
  Bold,
  GripVertical,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { linkify } from '@/lib/linkify'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/shared/useAuth'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type StatusKey = 'a_rediger' | 'en_attente' | 'a_revoir' | 'a_valider' | 'valide'

const STATUS_META: Record<StatusKey, { label: string; dot: string; badge: string }> = {
  a_rediger: {
    label: 'À rédiger',
    dot: 'bg-yellow-400',
    badge:
      'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30',
  },
  en_attente: {
    label: "En attente d'éléments",
    dot: 'bg-purple-500',
    badge:
      'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
  },
  a_revoir: {
    label: 'À revoir',
    dot: 'bg-orange-500',
    badge:
      'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  },
  a_valider: {
    label: 'À valider',
    dot: 'bg-blue-500',
    badge:
      'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  },
  valide: {
    label: 'Validé',
    dot: 'bg-green-500',
    badge:
      'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
  },
}

type EditorialCard = {
  id: string
  title: string
  postTitle?: string
  weekNumber?: number
  updatedAt?: number
  content: string
  tags: string
  image: string | null // data URL
  video: string | null // data URL
  status: StatusKey
  statuses?: StatusKey[]
}

function getStatuses(card: Pick<EditorialCard, 'status' | 'statuses'>): StatusKey[] {
  if (card.statuses && card.statuses.length > 0) {
    return card.statuses.filter((s) => s in STATUS_META)
  }
  return card.status ? [card.status] : ['a_rediger']
}

// Unicode Mathematical Sans-Serif Bold — rendu en gras nativement sur LinkedIn
function toBoldChar(ch: string): string {
  const code = ch.codePointAt(0)!
  if (code >= 0x41 && code <= 0x5a) return String.fromCodePoint(0x1d5d4 + (code - 0x41)) // A-Z
  if (code >= 0x61 && code <= 0x7a) return String.fromCodePoint(0x1d5ee + (code - 0x61)) // a-z
  if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(0x1d7ec + (code - 0x30)) // 0-9
  return ch
}
function fromBoldChar(ch: string): string {
  const code = ch.codePointAt(0)!
  if (code >= 0x1d5d4 && code <= 0x1d5ed) return String.fromCodePoint(0x41 + (code - 0x1d5d4))
  if (code >= 0x1d5ee && code <= 0x1d607) return String.fromCodePoint(0x61 + (code - 0x1d5ee))
  if (code >= 0x1d7ec && code <= 0x1d7f5) return String.fromCodePoint(0x30 + (code - 0x1d7ec))
  return ch
}
function isBoldChar(ch: string): boolean {
  const code = ch.codePointAt(0)
  if (code === undefined) return false
  return (
    (code >= 0x1d5d4 && code <= 0x1d5ed) ||
    (code >= 0x1d5ee && code <= 0x1d607) ||
    (code >= 0x1d7ec && code <= 0x1d7f5)
  )
}
function toggleBoldText(text: string): string {
  const chars = Array.from(text)
  // Si la sélection contient au moins un caractère en gras → on retire le gras
  // partout (sans re-bolder les caractères normaux). Sinon → on met tout en gras.
  const hasBold = chars.some((c) => isBoldChar(c))
  if (hasBold) {
    return chars.map((c) => (isBoldChar(c) ? fromBoldChar(c) : c)).join('')
  }
  return chars.map((c) => toBoldChar(c)).join('')
}

function guessExtFromDataUrl(dataUrl: string, fallback = 'png'): string {
  const m = /^data:([^;]+);/.exec(dataUrl)
  if (!m) return fallback
  return guessExtFromMime(m[1], fallback)
}

function guessExtFromMime(mime: string, fallback = 'bin'): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }
  return map[mime] || mime.split('/')[1] || fallback
}

function isDataUrl(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('data:')
}

function guessExtFromMediaSource(source: string, fallback = 'bin'): string {
  if (isDataUrl(source)) return guessExtFromDataUrl(source, fallback)
  try {
    const path = new URL(source).pathname
    const ext = path.split('.').pop()?.split('?')[0]
    return ext && ext.length <= 8 ? ext : fallback
  } catch {
    const ext = String(source).split('?')[0].split('.').pop()
    return ext && ext.length <= 8 ? ext : fallback
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

async function downloadMediaSource(source: string, filename: string) {
  if (isDataUrl(source)) {
    downloadDataUrl(source, filename)
    return
  }

  try {
    const response = await fetch(source)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    downloadDataUrl(objectUrl, filename)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    const a = document.createElement('a')
    a.href = source
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

function safeStorageName(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'media'
  )
}

async function uploadEditorialMediaBlob(
  blob: Blob,
  userId: string,
  cardId: string,
  kind: 'image' | 'video',
  filename: string,
  contentType?: string
) {
  const ext = guessExtFromMime(contentType || blob.type || '', kind === 'image' ? 'png' : 'mp4')
  const safeName = safeStorageName(filename || `${kind}.${ext}`)
  const path = `${userId}/${MEDIA_STORAGE_PREFIX}/${cardId}/${Date.now()}-${uid()}-${safeName}`
  const { error } = await supabase.storage.from(MEDIA_STORAGE_BUCKET).upload(path, blob, {
    cacheControl: '31536000',
    contentType: contentType || blob.type || undefined,
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from(MEDIA_STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function uploadEditorialMediaFile(
  file: File,
  userId: string,
  cardId: string,
  kind: 'image' | 'video'
) {
  return uploadEditorialMediaBlob(file, userId, cardId, kind, file.name, file.type)
}

async function uploadDataUrlMedia(
  dataUrl: string,
  userId: string,
  cardId: string,
  kind: 'image' | 'video'
) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const ext = guessExtFromMime(blob.type, kind === 'image' ? 'png' : 'mp4')
  return uploadEditorialMediaBlob(blob, userId, cardId, kind, `${kind}.${ext}`, blob.type)
}

type MonthColumn = {
  id: string // e.g. 2026-09
  label: string
  cards: EditorialCard[]
}

type EditorialCalendarRow = {
  columns: unknown
}

type EditorialCalendarRealtimePayload = {
  new?: {
    columns?: unknown
  }
}

type EditorialCalendarQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string
    ) => {
      maybeSingle: () => Promise<{ data: EditorialCalendarRow | null; error: Error | null }>
    }
  }
  upsert: (
    value: { key: string; columns: MonthColumn[]; updated_by: string | null },
    options: { onConflict: string }
  ) => Promise<{ error: Error | null }>
}

type EditorialCalendarClient = typeof supabase & {
  from: (table: 'editorial_calendar_state') => EditorialCalendarQuery
}

const editorialCalendarClient = supabase as EditorialCalendarClient

const STORAGE_KEY = 'calendrier_editorial_v5'
const LOCAL_MEDIA_STORAGE_PREFIX = 'calendrier_editorial'
const MEDIA_STORAGE_BUCKET = 'editor-images'
const MEDIA_STORAGE_PREFIX = 'editorial-calendar'
const DELETED_CARD_IDS_STORAGE_KEY = `${STORAGE_KEY}_deleted_card_ids`
const DELETED_WEEK_KEYS_STORAGE_KEY = `${STORAGE_KEY}_deleted_week_keys`
const DB_STATE_KEY = 'main'

const YEAR_PLAN: { year: number; months: number[] }[] = [
  { year: 2026, months: [8, 9, 10, 11] }, // sept -> déc
  { year: 2027, months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }, // jan -> déc
]

const MONTH_NAMES_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

// ISO 8601 week number
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Retourne les numéros ISO des semaines "appartenant" à un mois (Thursday-rule ISO 8601).
// Chaque semaine est attribuée au mois qui contient son jeudi → pas de doublon
// entre deux mois consécutifs pour une semaine à cheval.
function isoWeeksForMonth(year: number, monthIdx: number): number[] {
  const first = new Date(year, monthIdx, 1)
  const firstDow = (first.getDay() + 6) % 7 // 0 = lundi
  const startMonday = new Date(year, monthIdx, 1 - firstDow)
  const last = new Date(year, monthIdx + 1, 0)
  const weeks: number[] = []
  const cursor = new Date(startMonday)
  while (cursor <= last) {
    // Le jeudi de cette semaine (lundi + 3)
    const thursday = new Date(cursor)
    thursday.setDate(thursday.getDate() + 3)
    if (thursday.getFullYear() === year && thursday.getMonth() === monthIdx) {
      weeks.push(getISOWeek(cursor))
    }
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function cardScore(c: EditorialCard | undefined) {
  if (!c) return -1
  let s = 0
  if (c.content?.trim()) s += 4
  if (c.postTitle?.trim()) s += 2
  if (c.image) s += 2
  if (c.video) s += 2
  if (c.tags?.trim()) s += 1
  return s
}

function cardUpdatedAt(c: EditorialCard | undefined) {
  return typeof c?.updatedAt === 'number' && Number.isFinite(c.updatedAt) ? c.updatedAt : 0
}

function choosePreferredCard(first: EditorialCard, second: EditorialCard): EditorialCard {
  const firstUpdatedAt = cardUpdatedAt(first)
  const secondUpdatedAt = cardUpdatedAt(second)
  if (secondUpdatedAt > firstUpdatedAt) return second
  if (firstUpdatedAt > secondUpdatedAt) return first
  return cardScore(second) > cardScore(first) ? second : first
}

function hasFilledCard(c: EditorialCard | undefined) {
  return cardScore(c) > 0
}

type DeletionState = {
  cardIds: Set<string>
  weekKeys: Set<string>
}

function readStringSetStorage(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    )
  } catch {
    return new Set()
  }
}

function writeStringSetStorage(key: string, value: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(value)))
  } catch (e) {
    console.warn('Local deletion marker save failed', e)
  }
}

function loadDeletionState(): DeletionState {
  return {
    cardIds: readStringSetStorage(DELETED_CARD_IDS_STORAGE_KEY),
    weekKeys: readStringSetStorage(DELETED_WEEK_KEYS_STORAGE_KEY),
  }
}

function saveDeletionState(state: DeletionState) {
  writeStringSetStorage(DELETED_CARD_IDS_STORAGE_KEY, state.cardIds)
  writeStringSetStorage(DELETED_WEEK_KEYS_STORAGE_KEY, state.weekKeys)
}

function weekDeletionKey(
  columnId: string,
  cardOrWeek: EditorialCard | number | undefined
): string | null {
  const weekNumber =
    typeof cardOrWeek === 'number'
      ? cardOrWeek
      : (cardOrWeek?.weekNumber ?? extractWeekNumberFromTitle(cardOrWeek?.title))
  if (!Number.isInteger(weekNumber) || !weekNumber || weekNumber < 1 || weekNumber > 53) return null
  return `${columnId}:S${weekNumber}`
}

function markCardAsDeleted(columnId: string, card: EditorialCard) {
  const state = loadDeletionState()
  state.cardIds.add(card.id)
  const weekKey = weekDeletionKey(columnId, card)
  if (weekKey) state.weekKeys.add(weekKey)
  saveDeletionState(state)
}

function clearDeletionMarkerForCard(columnId: string, card: EditorialCard) {
  const state = loadDeletionState()
  let changed = state.cardIds.delete(card.id)
  const weekKey = weekDeletionKey(columnId, card)
  if (weekKey && state.weekKeys.delete(weekKey)) changed = true
  if (changed) saveDeletionState(state)
}

function countFilledCards(column: MonthColumn) {
  return column.cards.filter(hasFilledCard).length
}

function yearHasFilledCards(columns: MonthColumn[], year: number) {
  return columns.some(
    (column) => parseColumnId(column.id)?.year === year && column.cards.some(hasFilledCard)
  )
}

function firstYearWithFilledCards(columns: MonthColumn[]) {
  const years = columns
    .filter((column) => column.cards.some(hasFilledCard))
    .map((column) => parseColumnId(column.id)?.year)
    .filter((year): year is number => typeof year === 'number')
    .sort((a, b) => a - b)
  return years[0] ?? null
}

function buildInitialColumns(): MonthColumn[] {
  const result: MonthColumn[] = []
  for (const { year, months } of YEAR_PLAN) {
    for (const m of months) {
      const weekNumbers = isoWeeksForMonth(year, m)
      const cards: EditorialCard[] = weekNumbers.map((wn) => ({
        id: uid(),
        title: `S${wn}`,
        weekNumber: wn,
        content: '',
        tags: '',
        image: null,
        video: null,
        status: 'a_rediger' as StatusKey,
      }))
      result.push({
        id: `${year}-${String(m + 1).padStart(2, '0')}`,
        label: `${MONTH_NAMES_FR[m]} ${year}`,
        cards,
      })
    }
  }
  return result
}

function parseColumnId(columnId: string): { year: number; monthIdx: number } | null {
  const [yearStr, month] = columnId.split('-')
  const year = Number(yearStr)
  const monthNumber = Number(month)
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) return null
  if (monthNumber < 1 || monthNumber > 12) return null
  return { year, monthIdx: monthNumber - 1 }
}

function extractWeekNumberFromTitle(title: string | undefined): number | undefined {
  const t = (title ?? '').trim()
  const m = /^S\s*(\d+)$/i.exec(t) ?? /^Semaine\s+(\d+)$/i.exec(t)
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isInteger(n) && n >= 1 && n <= 53 ? n : undefined
}

function isAutoWeekTitle(title: string | undefined): boolean {
  return extractWeekNumberFromTitle(title) !== undefined
}

function displayCardTitle(card: EditorialCard, columnId: string, cardIndex: number): string {
  const weekNumber = card.weekNumber ?? weekNumberForCard(columnId, cardIndex)
  if (weekNumber) return `S${weekNumber}`
  return isAutoWeekTitle(card.title) ? 'Publication additionnelle' : card.title
}

function normalizeStoredColumns(
  columns: MonthColumn[],
  deletionState: DeletionState = loadDeletionState()
): MonthColumn[] {
  // ⚠️ Non destructif ET préservant l'ordre choisi par l'utilisateur (drag & drop).
  // - On garde chaque carte dans la colonne et la position où elle a été rangée.
  // - Les doublons sur un même numéro de semaine à l'intérieur d'une colonne
  //   sont fusionnés dans la première occurrence pour ne rien perdre.
  // - Les semaines ISO canoniques manquantes d'un mois sont ajoutées en fin de
  //   colonne comme cartes vides.
  const planned = buildInitialColumns()
  const plannedIds = new Set(planned.map((p) => p.id))
  const plannedById = new Map(planned.map((p) => [p.id, p]))

  const migrateCard = (card: EditorialCard, weekNumber?: number): EditorialCard => {
    const wn = typeof weekNumber === 'number' ? weekNumber : card.weekNumber
    const legacyTitle = card.title ?? ''
    const isAutoLegacyTitle = isAutoWeekTitle(legacyTitle)
    const migratedPostTitle =
      card.postTitle && card.postTitle.trim().length > 0
        ? card.postTitle
        : !isAutoLegacyTitle && legacyTitle.trim().length > 0
          ? legacyTitle
          : ''
    return {
      id: card.id ?? uid(),
      content: card.content ?? '',
      tags: card.tags ?? '',
      image: card.image ?? null,
      video: card.video ?? null,
      status: card.status ?? 'a_rediger',
      statuses:
        card.statuses && card.statuses.length > 0
          ? (card.statuses as StatusKey[]).filter((s) => s in STATUS_META)
          : card.status
            ? [card.status as StatusKey]
            : ['a_rediger' as StatusKey],
      updatedAt: cardUpdatedAt(card),
      postTitle: migratedPostTitle,
      title: wn
        ? `S${wn}`
        : isAutoLegacyTitle
          ? 'Publication additionnelle'
          : (card.title ?? 'Publication additionnelle'),
      weekNumber: wn,
    }
  }

  const mergeCards = (base: EditorialCard, extra: EditorialCard): EditorialCard => {
    const primary = choosePreferredCard(base, extra)
    const secondary = primary === base ? extra : base

    const mergedContent = [primary.content?.trim(), secondary.content?.trim()]
      .filter((v): v is string => !!v && v.length > 0)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join('\n\n---\n\n')

    const mergedTags = [primary.tags, secondary.tags]
      .flatMap((t) =>
        (t ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .join(', ')

    const primaryStatuses = (primary.statuses ??
      (primary.status ? [primary.status] : [])) as StatusKey[]
    const secondaryStatuses = (secondary.statuses ??
      (secondary.status ? [secondary.status] : [])) as StatusKey[]
    const mergedStatuses = [...primaryStatuses, ...secondaryStatuses]
      .filter((s) => s in STATUS_META)
      .filter((v, i, arr) => arr.indexOf(v) === i) as StatusKey[]

    return {
      ...primary,
      content: mergedContent,
      tags: mergedTags,
      image: primary.image ?? secondary.image ?? null,
      video: primary.video ?? secondary.video ?? null,
      postTitle: (primary.postTitle?.trim() ? primary.postTitle : secondary.postTitle) ?? '',
      status: mergedStatuses[0] ?? primary.status ?? 'a_rediger',
      statuses:
        mergedStatuses.length > 0
          ? mergedStatuses
          : primaryStatuses.length
            ? primaryStatuses
            : ['a_rediger'],
      updatedAt: Math.max(cardUpdatedAt(primary), cardUpdatedAt(secondary)),
    }
  }

  const result: MonthColumn[] = []

  // 1) Rejouer les colonnes stockées dans l'ordre, en ne gardant que celles qui
  //    correspondent à un mois planifié. On préserve l'ordre des cartes.
  const processedColumnIds = new Set<string>()
  for (const stored of columns) {
    if (!plannedIds.has(stored.id)) continue
    if (processedColumnIds.has(stored.id)) continue
    processedColumnIds.add(stored.id)

    const plan = plannedById.get(stored.id)!
    const orderedCards: EditorialCard[] = []
    const weekIndexInOrdered = new Map<number, number>()

    for (const raw of stored.cards ?? []) {
      const rawWeekKey = weekDeletionKey(stored.id, raw)
      if (deletionState.cardIds.has(raw.id)) continue
      if (rawWeekKey && deletionState.weekKeys.has(rawWeekKey) && !hasFilledCard(raw)) continue

      const wn =
        typeof raw.weekNumber === 'number' ? raw.weekNumber : extractWeekNumberFromTitle(raw.title)
      const migrated = migrateCard(raw, wn)

      if (typeof wn === 'number' && weekIndexInOrdered.has(wn)) {
        // Doublon dans la colonne → on fusionne dans la première occurrence
        const idx = weekIndexInOrdered.get(wn)!
        orderedCards[idx] = mergeCards(orderedCards[idx], migrated)
        continue
      }

      const idx = orderedCards.push(migrated) - 1
      if (typeof wn === 'number') weekIndexInOrdered.set(wn, idx)
    }

    result.push({ ...plan, cards: orderedCards })
  }

  // 2) Ajouter uniquement les colonnes planifiées qui n'étaient pas encore
  //    stockées. Les colonnes déjà stockées ne sont jamais recomplétées avec
  //    les semaines manquantes : une carte absente peut avoir été supprimée
  //    volontairement, elle ne doit donc pas réapparaître au rafraîchissement.
  for (const plan of planned) {
    if (processedColumnIds.has(plan.id)) continue
    result.push({
      ...plan,
      cards: plan.cards.filter((card) => {
        const weekKey = weekDeletionKey(plan.id, card)
        return (
          !deletionState.cardIds.has(card.id) && (!weekKey || !deletionState.weekKeys.has(weekKey))
        )
      }),
    })
  }

  // 3) Réordonner selon l'ordre planifié canonique (année/mois).
  const orderIndex = new Map(planned.map((p, i) => [p.id, i]))
  result.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))

  return result
}

function weekNumberForCard(columnId: string, cardIndex: number): number | null {
  const parsed = parseColumnId(columnId)
  if (!parsed) return null
  return isoWeeksForMonth(parsed.year, parsed.monthIdx)[cardIndex] ?? null
}

function loadColumns(): MonthColumn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildInitialColumns()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return buildInitialColumns()
    return normalizeStoredColumns(parsed)
  } catch {
    return buildInitialColumns()
  }
}

function saveColumnsLocally(columns: MonthColumn[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns))
  } catch (e) {
    console.warn('LocalStorage save failed', e)
  }
}

function localStorageCalendarKeys(): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue
      if (!key.startsWith(LOCAL_MEDIA_STORAGE_PREFIX)) continue
      if (key.endsWith('_deleted_card_ids') || key.endsWith('_deleted_week_keys')) continue
      keys.push(key)
    }
  } catch (e) {
    console.warn('Local media backup scan failed', e)
  }
  return keys
}

function hasAnyMedia(columns: MonthColumn[]) {
  return columns.some((column) => column.cards.some((card) => Boolean(card.image || card.video)))
}

function normalizeMatchText(value: string | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function cardMatchKeys(columnId: string, card: EditorialCard) {
  const keys = new Set<string>([`id:${card.id}`])
  const weekNumber = card.weekNumber ?? extractWeekNumberFromTitle(card.title)
  if (weekNumber) {
    keys.add(`week:${columnId}:${weekNumber}`)
    keys.add(`week-any:${weekNumber}`)
  }
  const postTitle = normalizeMatchText(card.postTitle)
  if (postTitle) {
    keys.add(`post:${columnId}:${postTitle}`)
    keys.add(`post-any:${postTitle}`)
  }
  const title = normalizeMatchText(card.title)
  if (title) {
    keys.add(`title:${columnId}:${title}`)
    keys.add(`title-any:${title}`)
  }
  const content = normalizeMatchText(card.content)
  if (content) {
    keys.add(`content:${columnId}:${content.slice(0, 220)}`)
    keys.add(`content-any:${content.slice(0, 220)}`)
  }
  return Array.from(keys)
}

function readLocalMediaBackups(): MonthColumn[] {
  const backups: MonthColumn[] = []
  for (const key of localStorageCalendarKeys()) {
    try {
      const raw = localStorage.getItem(key)
      const parsed = raw ? JSON.parse(raw) : null
      if (!Array.isArray(parsed)) continue
      const normalized = normalizeStoredColumns(parsed)
      if (hasAnyMedia(normalized)) backups.push(...normalized)
    } catch (e) {
      console.warn('Local media backup read failed', key, e)
    }
  }
  return backups
}

function restoreMediaFromLocalBackups(columns: MonthColumn[]) {
  const backups = readLocalMediaBackups()
  if (backups.length === 0) return { columns, restoredCount: 0 }

  return restoreMediaFromColumns(columns, backups)
}

function restoreMediaFromColumns(columns: MonthColumn[], backups: MonthColumn[]) {
  if (backups.length === 0) return { columns, restoredCount: 0 }

  const mediaByKey = new Map<string, Pick<EditorialCard, 'image' | 'video'>>()
  for (const column of backups) {
    for (const card of column.cards) {
      if (!card.image && !card.video) continue
      for (const key of cardMatchKeys(column.id, card)) {
        if (!mediaByKey.has(key)) mediaByKey.set(key, { image: card.image, video: card.video })
      }
    }
  }

  let restoredCount = 0
  const restored = columns.map((column) => ({
    ...column,
    cards: column.cards.map((card) => {
      let media: Pick<EditorialCard, 'image' | 'video'> | undefined
      for (const key of cardMatchKeys(column.id, card)) {
        media = mediaByKey.get(key)
        if (media) break
      }
      if (!media) return card
      const image = card.image ?? media.image ?? null
      const video = card.video ?? media.video ?? null
      if (image === card.image && video === card.video) return card
      restoredCount += 1
      return { ...card, image, video, updatedAt: Math.max(cardUpdatedAt(card), Date.now()) }
    }),
  }))

  return { columns: restored, restoredCount }
}

async function externalizeDataUrlMedia(columns: MonthColumn[], userId: string) {
  let convertedCount = 0
  const convertedColumns: MonthColumn[] = []

  for (const column of columns) {
    const cards: EditorialCard[] = []
    for (const card of column.cards) {
      let next = card
      if (isDataUrl(card.image)) {
        try {
          const image = await uploadDataUrlMedia(card.image, userId, card.id, 'image')
          next = { ...next, image, updatedAt: Math.max(cardUpdatedAt(next), Date.now()) }
          convertedCount += 1
        } catch (error) {
          console.error('Editorial restored image upload failed', error)
        }
      }
      if (isDataUrl(card.video)) {
        try {
          const video = await uploadDataUrlMedia(card.video, userId, card.id, 'video')
          next = { ...next, video, updatedAt: Math.max(cardUpdatedAt(next), Date.now()) }
          convertedCount += 1
        } catch (error) {
          console.error('Editorial restored video upload failed', error)
        }
      }
      cards.push(next)
    }
    convertedColumns.push({ ...column, cards })
  }

  return { columns: convertedColumns, convertedCount }
}

function isMonthColumnArray(value: unknown): value is MonthColumn[] {
  return Array.isArray(value)
}

function mergeColumnSets(primary: MonthColumn[], secondary: MonthColumn[]): MonthColumn[] {
  const byId = new Map<string, MonthColumn>()
  for (const col of [...primary, ...secondary]) {
    const existing = byId.get(col.id)
    if (!existing) {
      byId.set(col.id, { ...col, cards: [...(col.cards ?? [])] })
      continue
    }

    // Fusion carte-par-carte : ne JAMAIS remplacer, toujours fusionner les
    // champs (image, video, content, etc.) pour éviter la perte de médias
    // quand une version plus récente ne les contient pas.
    const cardsById = new Map<string, EditorialCard>()
    const order: string[] = []
    for (const card of [...existing.cards, ...(col.cards ?? [])]) {
      const previous = cardsById.get(card.id)
      if (!previous) {
        cardsById.set(card.id, card)
        order.push(card.id)
      } else {
        cardsById.set(card.id, mergeCardsPreservingMedia(previous, card))
      }
    }

    byId.set(col.id, {
      ...existing,
      ...col,
      cards: order.map((id) => cardsById.get(id)!),
    })
  }

  return normalizeStoredColumns(Array.from(byId.values()))
}

/** Fusionne deux cartes en préservant systématiquement image/vidéo/contenu. */
function mergeCardsPreservingMedia(a: EditorialCard, b: EditorialCard): EditorialCard {
  const aUp = cardUpdatedAt(a)
  const bUp = cardUpdatedAt(b)
  const primary = bUp >= aUp ? b : a
  const secondary = primary === a ? b : a
  return {
    ...primary,
    image: primary.image ?? secondary.image ?? null,
    video: primary.video ?? secondary.video ?? null,
    content: primary.content?.trim() ? primary.content : (secondary.content ?? ''),
    postTitle: primary.postTitle?.trim() ? primary.postTitle : (secondary.postTitle ?? ''),
    tags: primary.tags?.trim() ? primary.tags : (secondary.tags ?? ''),
    updatedAt: Math.max(aUp, bUp),
  }
}

async function fetchSharedColumns(): Promise<MonthColumn[] | null> {
  const { data, error } = await editorialCalendarClient
    .from('editorial_calendar_state')
    .select('columns')
    .eq('key', DB_STATE_KEY)
    .maybeSingle()

  if (error) throw error
  if (!data || !isMonthColumnArray(data.columns)) return null
  return normalizeStoredColumns(data.columns)
}

async function upsertSharedColumns(columns: MonthColumn[], userId?: string) {
  const { error } = await editorialCalendarClient.from('editorial_calendar_state').upsert(
    {
      key: DB_STATE_KEY,
      columns,
      updated_by: userId ?? null,
    },
    { onConflict: 'key' }
  )

  if (error) throw error
}

function SortableCardWrapper({
  id,
  columnId,
  onClick,
  children,
}: {
  id: string
  columnId: string
  onClick: () => void
  children: (dragHandle: React.ReactNode) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { columnId, type: 'card' },
  })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 touch-none cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-marque-orange opacity-0 group-hover:opacity-100 transition-opacity"
      aria-label="Déplacer la carte"
      title="Glisser pour déplacer"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  )
  return (
    <div ref={setNodeRef} style={style} onClick={onClick}>
      {children(handle)}
    </div>
  )
}

export default function CalendrierEditorial() {
  const { user, loading: authLoading } = useAuth()
  const [columns, setColumns] = useState<MonthColumn[]>(() => loadColumns())
  const [sharedLoaded, setSharedLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const lastSavedJsonRef = useRef<string>('')
  const loadToastShownRef = useRef(false)
  const autoSelectedContentYearRef = useRef(false)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const availableYears = useMemo(() => {
    const set = new Set<number>()
    for (const c of columns) {
      const p = parseColumnId(c.id)
      if (p) set.add(p.year)
    }
    YEAR_PLAN.forEach((y) => set.add(y.year))
    return Array.from(set).sort((a, b) => a - b)
  }, [columns])
  const [selectedYear, setSelectedYear] = useState<number>(
    () => YEAR_PLAN[0]?.year ?? new Date().getFullYear()
  )
  const visibleColumns = useMemo(
    () => columns.filter((c) => parseColumnId(c.id)?.year === selectedYear),
    [columns, selectedYear]
  )
  const visibleFilledCount = useMemo(
    () => visibleColumns.reduce((total, column) => total + countFilledCards(column), 0),
    [visibleColumns]
  )

  useEffect(() => {
    setColumns((current) => {
      const normalized = normalizeStoredColumns(current)
      return JSON.stringify(normalized) === JSON.stringify(current) ? current : normalized
    })
  }, [])

  useEffect(() => {
    saveColumnsLocally(columns)
  }, [columns])

  useEffect(() => {
    if (!sharedLoaded || autoSelectedContentYearRef.current) return
    autoSelectedContentYearRef.current = true
    if (yearHasFilledCards(columns, selectedYear)) return
    const contentYear = firstYearWithFilledCards(columns)
    if (contentYear) setSelectedYear(contentYear)
  }, [columns, selectedYear, sharedLoaded])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    async function loadSharedState() {
      if (!user) {
        setSharedLoaded(true)
        return
      }

      try {
        const shared = await fetchSharedColumns()
        if (cancelled) return

        if (shared) {
          const restored = restoreMediaFromLocalBackups(shared)
          const mediaReady = await externalizeDataUrlMedia(restored.columns, user.id)
          const merged = mediaReady.columns
          if (cancelled) return
          lastSavedJsonRef.current = JSON.stringify(shared)
          setColumns(merged)
          saveColumnsLocally(merged)
          if (JSON.stringify(merged) !== JSON.stringify(shared)) {
            await upsertSharedColumns(merged, user.id)
            lastSavedJsonRef.current = JSON.stringify(merged)
            if (restored.restoredCount > 0) {
              toast.success(
                `${restored.restoredCount} média${restored.restoredCount > 1 ? 's' : ''} restauré${restored.restoredCount > 1 ? 's' : ''} depuis ce navigateur`
              )
            }
          }
        } else {
          const local = normalizeStoredColumns(loadColumns())
          const restored = restoreMediaFromLocalBackups(local)
          const mediaReady = await externalizeDataUrlMedia(restored.columns, user.id)
          const restoredLocal = mediaReady.columns
          if (cancelled) return
          await upsertSharedColumns(restoredLocal, user.id)
          if (cancelled) return
          lastSavedJsonRef.current = JSON.stringify(restoredLocal)
          setColumns(restoredLocal)
          saveColumnsLocally(restoredLocal)
          if (restored.restoredCount > 0) {
            toast.success(
              `${restored.restoredCount} média${restored.restoredCount > 1 ? 's' : ''} restauré${restored.restoredCount > 1 ? 's' : ''} depuis ce navigateur`
            )
          }
        }
      } catch (error) {
        console.error('Shared editorial calendar load failed', error)
        if (!loadToastShownRef.current) {
          toast.error("Le calendrier partagé n'a pas pu être chargé. Vérifiez votre connexion.")
          loadToastShownRef.current = true
        }
      } finally {
        if (!cancelled) setSharedLoaded(true)
      }
    }

    loadSharedState()

    return () => {
      cancelled = true
    }
  }, [authLoading, user])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('editorial-calendar-state')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'editorial_calendar_state',
          filter: `key=eq.${DB_STATE_KEY}`,
        },
        (payload: EditorialCalendarRealtimePayload) => {
          const incoming = payload.new?.columns
          if (!isMonthColumnArray(incoming)) return
          const normalizedIncoming = normalizeStoredColumns(incoming)
          const incomingJson = JSON.stringify(normalizedIncoming)
          if (incomingJson === lastSavedJsonRef.current) return
          setColumns((current) => {
            // La base reste la source de vérité pour les cartes ; on ne garde
            // en local que les médias absents pour éviter la perte de visuels.
            const restored = restoreMediaFromColumns(normalizedIncoming, current)
            const merged = restored.columns
            const mergedJson = JSON.stringify(merged)
            lastSavedJsonRef.current = mergedJson
            saveColumnsLocally(merged)
            return merged
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  useEffect(() => {
    if (!user || !sharedLoaded) return
    const normalized = normalizeStoredColumns(columns)
    const json = JSON.stringify(normalized)
    if (json === lastSavedJsonRef.current) return

    const timeout = window.setTimeout(async () => {
      try {
        setIsSaving(true)
        await upsertSharedColumns(normalized, user.id)
        lastSavedJsonRef.current = json
      } catch (error) {
        console.error('Shared editorial calendar save failed', error)
        toast.error("L'enregistrement partagé du calendrier a échoué")
      } finally {
        setIsSaving(false)
      }
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [columns, sharedLoaded, user])

  async function saveNow() {
    const normalized = normalizeStoredColumns(columns)
    saveColumnsLocally(normalized)

    if (!user) {
      toast.error('Connectez-vous pour enregistrer le calendrier partagé')
      return
    }

    try {
      setIsSaving(true)
      await upsertSharedColumns(normalized, user.id)
      lastSavedJsonRef.current = JSON.stringify(normalized)
      setColumns(normalized)
      toast.success('Modifications enregistrées dans le calendrier partagé')
    } catch (error) {
      console.error('Shared editorial calendar manual save failed', error)
      toast.error("Impossible d'enregistrer le calendrier partagé")
    } finally {
      setIsSaving(false)
    }
  }

  const [isRestoringMedia, setIsRestoringMedia] = useState(false)

  async function restoreMediaNow() {
    if (!user) {
      toast.error('Connectez-vous pour restaurer les médias')
      return
    }
    try {
      setIsRestoringMedia(true)
      const restored = restoreMediaFromLocalBackups(columns)
      const mediaReady = await externalizeDataUrlMedia(restored.columns, user.id)
      const next = mediaReady.columns
      const nextJson = JSON.stringify(next)
      const restoredCount = restored.restoredCount
      const uploadedCount = mediaReady.convertedCount

      if (nextJson === JSON.stringify(columns)) {
        toast.info('Aucun visuel supplémentaire à récupérer depuis ce navigateur')
        return
      }

      setColumns(next)
      saveColumnsLocally(next)
      await upsertSharedColumns(next, user.id)
      lastSavedJsonRef.current = nextJson

      const parts: string[] = []
      if (restoredCount > 0)
        parts.push(
          `${restoredCount} visuel${restoredCount > 1 ? 's' : ''} récupéré${restoredCount > 1 ? 's' : ''}`
        )
      if (uploadedCount > 0)
        parts.push(`${uploadedCount} transféré${uploadedCount > 1 ? 's' : ''} en base`)
      toast.success(parts.length ? parts.join(' · ') : 'Médias synchronisés en base')
    } catch (error) {
      console.error('Editorial media restore failed', error)
      toast.error('La récupération des visuels a échoué')
    } finally {
      setIsRestoringMedia(false)
    }
  }

  const openCard = useMemo(() => {
    if (!openCardId) return null
    for (const col of columns) {
      const c = col.cards.find((c) => c.id === openCardId)
      if (c) return { card: c, columnId: col.id }
    }
    return null
  }, [openCardId, columns])

  function updateCard(columnId: string, cardId: string, patch: Partial<EditorialCard>) {
    const updatedPatch = { ...patch, updatedAt: Date.now() }
    setColumns((cols) =>
      cols.map((col) =>
        col.id !== columnId
          ? col
          : {
              ...col,
              cards: col.cards.map((c) => {
                if (c.id !== cardId) return c
                const next = { ...c, ...updatedPatch }
                if (hasFilledCard(next)) clearDeletionMarkerForCard(columnId, next)
                return next
              }),
            }
      )
    )
  }

  function addCard(columnId: string) {
    setColumns((cols) =>
      cols.map((col) => {
        if (col.id !== columnId) return col
        return {
          ...col,
          cards: [
            ...col.cards,
            {
              id: uid(),
              title: 'Publication additionnelle',
              updatedAt: Date.now(),
              content: '',
              tags: '',
              image: null,
              video: null,
              status: 'a_rediger',
            },
          ],
        }
      })
    )
  }

  function deleteCard(columnId: string, cardId: string) {
    setColumns((cols) => {
      const deletedCard = cols
        .find((col) => col.id === columnId)
        ?.cards.find((c) => c.id === cardId)
      if (deletedCard) markCardAsDeleted(columnId, deletedCard)

      return cols.map((col) =>
        col.id !== columnId ? col : { ...col, cards: col.cards.filter((c) => c.id !== cardId) }
      )
    })
    if (openCardId === cardId) setOpenCardId(null)
  }

  async function handleImageUpload(file: File, columnId: string, cardId: string) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop lourde (max 10 Mo).')
      return
    }
    try {
      if (!user) {
        toast.error('Connectez-vous pour enregistrer une image')
        return
      }
      const publicUrl = await uploadEditorialMediaFile(file, user.id, cardId, 'image')
      const savedColumns = columns.map((col) =>
        col.id !== columnId
          ? col
          : {
              ...col,
              cards: col.cards.map((card) =>
                card.id === cardId
                  ? {
                      ...card,
                      image: publicUrl,
                      updatedAt: Math.max(cardUpdatedAt(card), Date.now()),
                    }
                  : card
              ),
            }
      )
      const normalizedSavedColumns = normalizeStoredColumns(savedColumns)
      setColumns(savedColumns)
      saveColumnsLocally(savedColumns)
      await upsertSharedColumns(normalizedSavedColumns, user.id)
      lastSavedJsonRef.current = JSON.stringify(normalizedSavedColumns)
      toast.success('Image enregistrée')
    } catch (error) {
      console.error('Editorial image upload failed', error)
      toast.error("L'image n'a pas pu être importée")
    }
  }

  async function handleVideoUpload(file: File, columnId: string, cardId: string) {
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Vidéo trop lourde (max 50 Mo).')
      return
    }
    try {
      if (!user) {
        toast.error('Connectez-vous pour enregistrer une vidéo')
        return
      }
      const publicUrl = await uploadEditorialMediaFile(file, user.id, cardId, 'video')
      const savedColumns = columns.map((col) =>
        col.id !== columnId
          ? col
          : {
              ...col,
              cards: col.cards.map((card) =>
                card.id === cardId
                  ? {
                      ...card,
                      video: publicUrl,
                      updatedAt: Math.max(cardUpdatedAt(card), Date.now()),
                    }
                  : card
              ),
            }
      )
      const normalizedSavedColumns = normalizeStoredColumns(savedColumns)
      setColumns(savedColumns)
      saveColumnsLocally(savedColumns)
      await upsertSharedColumns(normalizedSavedColumns, user.id)
      lastSavedJsonRef.current = JSON.stringify(normalizedSavedColumns)
      toast.success('Vidéo enregistrée')
    } catch (error) {
      console.error('Editorial video upload failed', error)
      toast.error("La vidéo n'a pas pu être importée")
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeDragCardId, setActiveDragCardId] = useState<string | null>(null)

  const findColumnByCardId = (cardId: string): MonthColumn | undefined =>
    columns.find((col) => col.cards.some((c) => c.id === cardId))

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragCardId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    setColumns((cols) => {
      const activeCol = cols.find((c) => c.cards.some((card) => card.id === activeId))
      if (!activeCol) return cols
      const overCol =
        cols.find((c) => c.id === overId) ??
        cols.find((c) => c.cards.some((card) => card.id === overId))
      if (!overCol || activeCol.id === overCol.id) return cols

      const activeIndex = activeCol.cards.findIndex((c) => c.id === activeId)
      if (activeIndex < 0) return cols
      const moved = activeCol.cards[activeIndex]

      return cols.map((col) => {
        if (col.id === activeCol.id) {
          return { ...col, cards: col.cards.filter((c) => c.id !== activeId) }
        }
        if (col.id === overCol.id) {
          const overIndex = col.cards.findIndex((c) => c.id === overId)
          const insertAt = overIndex >= 0 ? overIndex : col.cards.length
          const next = [...col.cards]
          next.splice(insertAt, 0, moved)
          return { ...col, cards: next }
        }
        return col
      })
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragCardId(null)
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    setColumns((cols) => {
      const col = cols.find((c) => c.cards.some((card) => card.id === activeId))
      if (!col) return cols
      const oldIndex = col.cards.findIndex((c) => c.id === activeId)
      const newIndex = col.cards.findIndex((c) => c.id === overId)
      if (oldIndex < 0 || newIndex < 0) return cols
      return cols.map((c) =>
        c.id === col.id ? { ...c, cards: arrayMove(c.cards, oldIndex, newIndex) } : c
      )
    })
  }

  const activeDragCard = activeDragCardId
    ? findColumnByCardId(activeDragCardId)?.cards.find((c) => c.id === activeDragCardId)
    : null

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-br from-marque-pastelCyan/30 via-background to-marque-pastelOrange/10">
      <header className="px-6 py-4 border-b border-marque-cyan/40 bg-gradient-to-r from-marque-blue to-marque-blue/80 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Linkedin className="h-6 w-6" />
              Calendrier éditorial OpenPulse
            </h1>
            <p className="text-sm text-marque-cyan mt-1">
              {visibleFilledCount > 0
                ? `${visibleFilledCount} carte${visibleFilledCount > 1 ? 's' : ''} remplie${visibleFilledCount > 1 ? 's' : ''} sur ${selectedYear}`
                : '\u00A0'}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={restoreMediaNow}
            disabled={isRestoringMedia || !user}
            className="shrink-0 bg-card/15 hover:bg-card/25 text-white border border-white/30"
            title="Retrouve les visuels sauvegardés dans ce navigateur et les enregistre en base"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRestoringMedia ? 'animate-spin' : ''}`} />
            {isRestoringMedia ? 'Récupération…' : 'Récupérer les visuels'}
          </Button>
        </div>

        <Tabs
          value={String(selectedYear)}
          onValueChange={(v) => setSelectedYear(Number(v))}
          className="mt-3"
        >
          <TabsList className="bg-card/10 border border-white/20">
            {availableYears.map((y) => (
              <TabsTrigger
                key={y}
                value={String(y)}
                className="text-white/80 data-[state=active]:bg-marque-orange data-[state=active]:text-white"
              >
                {y}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragCardId(null)}
      >
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-4 min-w-max h-full">
            {visibleColumns.map((col) => (
              <div
                key={col.id}
                className="w-80 shrink-0 bg-marque-pastelCyan/40 dark:bg-marque-blue/20 border border-marque-cyan/50 rounded-lg flex flex-col max-h-[calc(100vh-10rem)] shadow-sm"
              >
                <div className="px-3 py-2 flex items-center justify-between border-b border-marque-cyan/50 bg-gradient-to-r from-marque-cyan/70 to-marque-pastelCyan/70 dark:from-marque-blue/40 dark:to-marque-blue/20 rounded-t-lg">
                  <h2 className="font-semibold text-sm text-marque-blue dark:text-marque-cyan">
                    {col.label}
                  </h2>
                  <span className="text-xs text-marque-blue/70 dark:text-marque-cyan/80">
                    {countFilledCards(col) > 0 ? `${countFilledCards(col)}/` : ''}
                    {col.cards.length} carte{col.cards.length > 1 ? 's' : ''}
                  </span>
                </div>

                <SortableContext
                  items={col.cards.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {col.cards.map((card, cardIndex) => {
                      const cardStatuses = getStatuses(card)
                      const meta = STATUS_META[cardStatuses[0]]
                      const weekNumber = card.weekNumber ?? weekNumberForCard(col.id, cardIndex)
                      const displayTitle = weekNumber ? `S${weekNumber}` : card.title
                      return (
                        <SortableCardWrapper
                          key={card.id}
                          id={card.id}
                          columnId={col.id}
                          onClick={() => setOpenCardId(card.id)}
                        >
                          {(dragHandle) => (
                            <Card className="p-3 cursor-pointer hover:shadow-md transition-all group bg-card dark:bg-card border-marque-cyan/40 hover:border-marque-orange/60 hover:-translate-y-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  {dragHandle}
                                  <span
                                    className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`}
                                    aria-hidden
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                      <span className="text-sm font-semibold text-marque-blue dark:text-marque-cyan shrink-0">
                                        {displayTitle}
                                      </span>
                                      {card.postTitle && (
                                        <span
                                          className="text-sm font-semibold text-foreground truncate"
                                          title={card.postTitle}
                                        >
                                          {card.postTitle}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                      {cardStatuses.map((s) => (
                                        <Badge
                                          key={s}
                                          variant="outline"
                                          className={`text-[10px] px-1.5 py-0 ${STATUS_META[s].badge}`}
                                        >
                                          {STATUS_META[s].label}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (confirm(`Supprimer « ${card.title} » ?`))
                                      deleteCard(col.id, card.id)
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  aria-label="Supprimer la carte"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {(card.image || card.video) && (
                                <div className="mt-2 relative w-full rounded overflow-hidden bg-muted group/media flex items-center justify-center max-h-64">
                                  {card.video ? (
                                    <>
                                      <video
                                        src={card.video}
                                        className="w-full h-auto max-h-64 object-contain"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                        <Video className="h-5 w-5 text-white" />
                                      </div>
                                    </>
                                  ) : (
                                    <img
                                      src={card.image!}
                                      alt=""
                                      className="w-full h-auto max-h-64 object-contain"
                                    />
                                  )}
                                  {(card.image || card.video) && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        const src = (card.video || card.image) as string
                                        const isVideo = !!card.video
                                        const ext = guessExtFromMediaSource(
                                          src,
                                          isVideo ? 'mp4' : 'png'
                                        )
                                        const base = (card.postTitle || displayTitle || 'media')
                                          .replace(/[^\w\-]+/g, '_')
                                          .slice(0, 60)
                                        await downloadMediaSource(src, `${base}.${ext}`)
                                        toast.success(
                                          isVideo ? 'Vidéo téléchargée' : 'Image téléchargée'
                                        )
                                      }}
                                      className="absolute top-1.5 right-1.5 inline-flex items-center justify-center h-7 w-7 rounded-md bg-black/55 text-white hover:bg-black/75 opacity-0 group-hover/media:opacity-100 transition-opacity"
                                      aria-label={
                                        card.video ? 'Télécharger la vidéo' : "Télécharger l'image"
                                      }
                                      title={
                                        card.video ? 'Télécharger la vidéo' : "Télécharger l'image"
                                      }
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </Card>
                          )}
                        </SortableCardWrapper>
                      )
                    })}
                  </div>
                </SortableContext>

                <div className="p-2 border-t border-marque-cyan/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-marque-blue dark:text-marque-cyan hover:bg-marque-orange/10 hover:text-marque-orange"
                    onClick={() => addCard(col.id)}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Ajouter une carte
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeDragCard ? (
            <Card className="p-3 bg-card dark:bg-card border-marque-orange/60 shadow-lg w-72">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-marque-blue/70 dark:text-marque-cyan/80">
                {activeDragCard.weekNumber ? `S${activeDragCard.weekNumber}` : activeDragCard.title}
              </div>
              {activeDragCard.postTitle && (
                <div className="text-xs font-medium mt-1 truncate">{activeDragCard.postTitle}</div>
              )}
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!openCard} onOpenChange={(o) => !o && setOpenCardId(null)}>
        <DialogContent className="!max-w-[98vw] w-[98vw] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col p-0">
          {openCard && (
            <CardEditor
              key={openCard.card.id}
              card={openCard.card}
              columnId={openCard.columnId}
              isSaving={isSaving}
              onSave={saveNow}
              onChange={(patch) => updateCard(openCard.columnId, openCard.card.id, patch)}
              onDelete={() => deleteCard(openCard.columnId, openCard.card.id)}
              onImageUpload={(f) => handleImageUpload(f, openCard.columnId, openCard.card.id)}
              onVideoUpload={(f) => handleVideoUpload(f, openCard.columnId, openCard.card.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CardEditor({
  card,
  isSaving,
  onSave,
  onChange,
  onDelete,
  onImageUpload,
  onVideoUpload,
}: {
  card: EditorialCard
  columnId: string
  isSaving: boolean
  onSave: () => void | Promise<void>
  onChange: (patch: Partial<EditorialCard>) => void
  onDelete: () => void
  onImageUpload: (file: File) => void
  onVideoUpload: (file: File) => void
}) {
  const pastRef = useRef<EditorialCard[]>([])
  const futureRef = useRef<EditorialCard[]>([])
  const lastCardRef = useRef<EditorialCard>(card)
  const skipHistoryRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const selectionRangeRef = useRef({ start: 0, end: 0 })

  function rememberTextSelection() {
    const ta = textareaRef.current
    if (!ta) return
    selectionRangeRef.current = {
      start: ta.selectionStart ?? 0,
      end: ta.selectionEnd ?? 0,
    }
  }

  function handleBold() {
    const ta = textareaRef.current
    if (!ta) return
    let start = ta.selectionStart ?? 0
    let end = ta.selectionEnd ?? 0
    if (start === end && selectionRangeRef.current.end > selectionRangeRef.current.start) {
      start = selectionRangeRef.current.start
      end = selectionRangeRef.current.end
    }
    start = Math.max(0, Math.min(start, card.content.length))
    end = Math.max(start, Math.min(end, card.content.length))
    if (start === end) {
      toast.info('Sélectionnez du texte à mettre en gras')
      return
    }
    const before = card.content.slice(0, start)
    const selected = card.content.slice(start, end)
    const after = card.content.slice(end)
    const transformed = toggleBoldText(selected)
    const newContent = before + transformed + after
    onChange({ content: newContent })
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const newEnd = start + transformed.length
      el.setSelectionRange(start, newEnd)
      selectionRangeRef.current = { start, end: newEnd }
    })
  }
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false
      lastCardRef.current = card
      return
    }
    // Only track history when the card actually changes
    if (
      lastCardRef.current !== card &&
      JSON.stringify(lastCardRef.current) !== JSON.stringify(card)
    ) {
      pastRef.current.push(lastCardRef.current)
      // Cap history to avoid unbounded memory
      if (pastRef.current.length > 100) pastRef.current.shift()
      futureRef.current = []
      lastCardRef.current = card
      forceRender((n) => n + 1)
    }
  }, [card])

  function fullPatch(target: EditorialCard): Partial<EditorialCard> {
    return {
      title: target.title,
      postTitle: target.postTitle,
      weekNumber: target.weekNumber,
      content: target.content,
      tags: target.tags,
      image: target.image,
      video: target.video,
      status: target.status,
      statuses: target.statuses,
    }
  }

  function handleUndo() {
    const prev = pastRef.current.pop()
    if (!prev) return
    futureRef.current.push(lastCardRef.current)
    skipHistoryRef.current = true
    lastCardRef.current = prev
    onChange(fullPatch(prev))
    forceRender((n) => n + 1)
  }

  function handleRedo() {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(lastCardRef.current)
    skipHistoryRef.current = true
    lastCardRef.current = next
    onChange(fullPatch(next))
    forceRender((n) => n + 1)
  }

  const canUndo = pastRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  return (
    <>
      <DialogHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <DialogTitle className="flex items-center gap-2 flex-1 min-w-0">
            <span className="inline-flex items-center gap-1 rounded-md bg-marque-blue/10 text-marque-blue dark:text-marque-cyan px-2 py-0.5 text-xs font-semibold shrink-0">
              <span>S</span>
              <input
                type="number"
                min={1}
                max={53}
                value={card.weekNumber ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') {
                    onChange({ weekNumber: undefined, title: '' })
                    return
                  }
                  const n = parseInt(v, 10)
                  if (!Number.isFinite(n)) return
                  const clamped = Math.max(1, Math.min(53, n))
                  onChange({ weekNumber: clamped, title: `S${clamped}` })
                }}
                className="w-12 bg-transparent border-0 outline-none focus:ring-0 p-0 text-xs font-semibold text-inherit [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Numéro de semaine"
                title="Numéro de semaine (1-53)"
              />
            </span>
            <Input
              value={card.postTitle ?? ''}
              onChange={(e) => onChange({ postTitle: e.target.value })}
              className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 px-0"
              placeholder="Titre du post"
            />
          </DialogTitle>
          <div className="flex items-center gap-1 shrink-0 mr-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Annuler"
              title="Annuler (revenir en arrière)"
              className="h-8 w-8"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Rétablir"
              title="Rétablir (revenir en avant)"
              className="h-8 w-8"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="h-8 bg-marque-orange hover:bg-marque-orange/90 text-white"
            >
              <Save className="h-4 w-4 mr-1" /> {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(440px,1fr)] gap-0">
        {/* Édition */}
        <div className="p-6 space-y-5 border-r">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Titre du post
            </label>
            <Input
              value={card.postTitle ?? ''}
              onChange={(e) => onChange({ postTitle: e.target.value })}
              placeholder="Ex : Comment l'IA optimise le parcours patient"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Étiquettes{' '}
              <span className="normal-case text-[10px] text-muted-foreground/70">
                (plusieurs possibles)
              </span>
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(STATUS_META) as StatusKey[]).map((k) => {
                const current = getStatuses(card)
                const active = current.includes(k)
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      const next = active ? current.filter((s) => s !== k) : [...current, k]
                      const finalStatuses: StatusKey[] = next.length > 0 ? next : ['a_rediger']
                      onChange({ statuses: finalStatuses, status: finalStatuses[0] })
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all ${
                      active
                        ? STATUS_META[k].badge + ' ring-1 ring-current/20'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}
                    aria-pressed={active}
                  >
                    <span className={`h-2 w-2 rounded-full ${STATUS_META[k].dot}`} />
                    {STATUS_META[k].label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                Contenu du post
              </label>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleBold}
                  aria-label="Mettre en gras"
                  title="Mettre en gras la sélection"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <label className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onImageUpload(f)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    asChild
                  >
                    <span title={card.image ? "Remplacer l'image" : 'Importer une image'}>
                      <ImageIcon className="h-4 w-4" />
                    </span>
                  </Button>
                </label>
                {card.image && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        const ext = guessExtFromMediaSource(card.image!, 'png')
                        const base = (card.postTitle || card.title || 'image')
                          .replace(/[^\w\-]+/g, '_')
                          .slice(0, 60)
                        await downloadMediaSource(card.image!, `${base}.${ext}`)
                        toast.success('Image téléchargée')
                      }}
                      aria-label="Télécharger l'image"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Télécharger l'image"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onChange({ image: null })}
                      aria-label="Retirer l'image"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <label className="relative">
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onVideoUpload(f)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    asChild
                  >
                    <span title={card.video ? 'Remplacer la vidéo' : 'Importer une vidéo'}>
                      <Video className="h-4 w-4" />
                    </span>
                  </Button>
                </label>
                {card.video && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        const ext = guessExtFromMediaSource(card.video!, 'mp4')
                        const base = (card.postTitle || card.title || 'video')
                          .replace(/[^\w\-]+/g, '_')
                          .slice(0, 60)
                        await downloadMediaSource(card.video!, `${base}.${ext}`)
                        toast.success('Vidéo téléchargée')
                      }}
                      aria-label="Télécharger la vidéo"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Télécharger la vidéo"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onChange({ video: null })}
                      aria-label="Retirer la vidéo"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <Textarea
              ref={textareaRef}
              value={card.content}
              onChange={(e) => onChange({ content: e.target.value })}
              onSelect={rememberTextSelection}
              onKeyUp={rememberTextSelection}
              onMouseUp={rememberTextSelection}
              placeholder="Rédigez ici votre post LinkedIn…"
              className="mt-1 min-h-[360px] resize-y text-base leading-relaxed"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase">
              Tags (indicatif)
            </label>
            <Input
              value={card.tags}
              onChange={(e) => onChange({ tags: e.target.value })}
              placeholder="santé, innovation, ehpad"
              className="mt-1"
            />
          </div>

          <div className="pt-2 border-t">
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer cette carte
            </Button>
          </div>
        </div>

        {/* Aperçu LinkedIn */}
        <div className="p-4 bg-muted/30">
          <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Aperçu du post
          </div>
          <LinkedInPreview card={card} />
        </div>
      </div>
    </>
  )
}

function LinkedInPreview({ card }: { card: EditorialCard }) {
  const hasContent = Boolean(card.content || card.image || card.video)
  return (
    <div className="bg-card text-gray-900 dark:bg-card dark:text-gray-900 rounded-lg shadow border overflow-hidden w-full max-w-xl mx-auto">
      {!hasContent ? (
        <div className="p-8 text-center text-sm text-gray-400">Pas d'aperçu</div>
      ) : (
        <>
          <div className="p-3 flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">OpenPulse</div>
              <div className="text-xs text-gray-500">Il y a quelques minutes</div>
            </div>
          </div>
          {card.content && (
            <div className="px-3 pb-2 text-sm whitespace-pre-wrap break-words">
              {linkify(card.content)}
            </div>
          )}
          {card.video ? (
            <video
              src={card.video}
              controls
              className="w-full max-h-[32rem] object-contain bg-gray-100"
            />
          ) : card.image ? (
            <img
              src={card.image}
              alt=""
              className="w-full max-h-[32rem] object-contain bg-gray-100"
            />
          ) : null}
          <div className="px-3 py-2 border-t flex items-center justify-around text-gray-600 text-xs">
            <span className="hover:text-blue-600">J'aime</span>
            <span className="hover:text-blue-600">Commenter</span>
            <span className="hover:text-blue-600">Partager</span>
          </div>
        </>
      )}
    </div>
  )
}
