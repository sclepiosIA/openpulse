import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useMemo } from 'react'
import { format, addMonths, startOfMonth } from 'date-fns'

export interface Transaction {
  nom: string
  montant: number
  statut: string
}

export interface CategoryNode {
  id: string
  code: string
  nom: string
  niveau: number
  ordre: number
  parentId: string | null
  children: CategoryNode[]
  monthlyData: Record<string, number> // "2025-01" => montant
  transactions: Record<string, Transaction[]> // "2025-01" => list
  total: number
}

export interface AnalyseData {
  tree: CategoryNode[]
  months: string[]
  currentMonth: string
  grandTotal: Record<string, number>
  grandTotalAll: number
  grandTransactions: Record<string, Transaction[]>
  // Revenue
  revenueTree: CategoryNode[]
  revenueGrandTotal: Record<string, number>
  revenueGrandTotalAll: number
  revenueGrandTransactions: Record<string, Transaction[]>
  // Soldes
  solde: Record<string, number>
  soldeCumule: Record<string, number>
  isLoading: boolean
}

// Mapping type_revenu -> category code
const TYPE_REVENU_TO_CATEGORY: Record<string, string> = {
  abonnement_mensuel: 'REC_VENTES',
  paiement_initial: 'REC_VENTES',
  autre: 'REC_AUTRES',
}

export function useTresorerieDepensesParCategorie(): AnalyseData {
  const now = new Date()
  const currentMonth = format(now, 'yyyy-MM')

  // Generate months: Jan 2025 -> current + 24
  const months = useMemo(() => {
    const result: string[] = []
    const start = new Date(2025, 0, 1)
    const end = addMonths(startOfMonth(now), 24)
    let cursor = start
    while (cursor <= end) {
      result.push(format(cursor, 'yyyy-MM'))
      cursor = addMonths(cursor, 1)
    }
    return result
  }, [])

  // Fetch categories (both depense and recette)
  const { data: categories } = useQuery({
    queryKey: ['tresorerie-categories-analyse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_categories')
        .select('id, code, nom, parent_id, niveau, ordre, type')
        .eq('actif', true)
        .order('niveau')
        .order('ordre')
      if (error) throw error
      return data
    },
    staleTime: 10 * 60 * 1000,
  })

  // Fetch all depenses from 2025-01-01, excluding 1900-01-01
  const { data: depenses, isLoading: isLoadingDep } = useQuery({
    queryKey: ['tresorerie-depenses-analyse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_depenses')
        .select('categorie_code, date_prevue, montant, statut, nom, source')
        .gte('date_prevue', '2025-01-01')
        .neq('date_prevue', '1900-01-01')
      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch revenus from 2025-01-01
  const { data: revenus, isLoading: isLoadingRev } = useQuery({
    queryKey: ['tresorerie-revenus-analyse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tresorerie_revenus')
        .select('mois, montant_prevu, statut, type_revenu, notes')
        .gte('mois', '2025-01-01')
      if (error) throw error
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  // Build aggregated trees
  const result = useMemo(() => {
    const empty = {
      tree: [] as CategoryNode[],
      grandTotal: {} as Record<string, number>,
      grandTotalAll: 0,
      grandTransactions: {} as Record<string, Transaction[]>,
      revenueTree: [] as CategoryNode[],
      revenueGrandTotal: {} as Record<string, number>,
      revenueGrandTotalAll: 0,
      revenueGrandTransactions: {} as Record<string, Transaction[]>,
      solde: {} as Record<string, number>,
      soldeCumule: {} as Record<string, number>,
    }

    if (!categories) return empty

    // ========== DEPENSES ==========
    const depRoot = categories.find((c) => c.code === 'DEP')
    let depTree: CategoryNode[] = []
    const depGrandTotal: Record<string, number> = {}
    const depGrandTransactions: Record<string, Transaction[]> = {}
    let depGrandTotalAll = 0

    if (depRoot && depenses) {
      const agg: Record<string, Record<string, number>> = {}
      const txMap: Record<string, Record<string, Transaction[]>> = {}

      // Deduplication salaires: privilegier Qonto sur RH (par nom normalisé + mois)
      const extractSalaryName = (nom: string): string =>
        nom
          .replace(/^salaire\s*-\s*/i, '')
          .trim()
          .toLowerCase()

      const qontoSalaryKeys = new Map<string, number>()
      for (const d of depenses) {
        if (d.source === 'qonto_sync' && d.categorie_code === 'DEP_SALAIRES_NETS') {
          const name = extractSalaryName(d.nom || '')
          const month = (d.date_prevue as string).substring(0, 7)
          const key = `${name}|${month}`
          qontoSalaryKeys.set(key, (qontoSalaryKeys.get(key) || 0) + 1)
        }
      }
      const filteredDepenses = depenses.filter((d) => {
        if (d.source !== 'rh_salaires_net') return true
        if (d.categorie_code !== 'DEP_SALAIRES_NETS') return true
        const name = extractSalaryName(d.nom || '')
        const month = (d.date_prevue as string).substring(0, 7)
        const key = `${name}|${month}`
        const count = qontoSalaryKeys.get(key)
        if (count && count > 0) {
          qontoSalaryKeys.set(key, count - 1)
          return false
        }
        return true
      })

      for (const d of filteredDepenses) {
        const code = d.categorie_code || 'SANS_CATEGORIE'
        const month = (d.date_prevue as string).substring(0, 7)
        if (!agg[code]) agg[code] = {}
        agg[code][month] = (agg[code][month] || 0) + (d.montant || 0)
        if (!txMap[code]) txMap[code] = {}
        if (!txMap[code][month]) txMap[code][month] = []
        txMap[code][month].push({
          nom: d.nom || 'Sans nom',
          montant: d.montant || 0,
          statut: d.statut || 'prevu',
        })
      }

      depTree = buildTree(categories, depRoot.id, 'depense', agg, txMap, months)

      for (const m of months) {
        depGrandTotal[m] = depTree.reduce((s, n) => s + (n.monthlyData[m] || 0), 0)
        const allTx: Transaction[] = []
        for (const n of depTree) {
          if (n.transactions[m]) allTx.push(...n.transactions[m])
        }
        if (allTx.length > 0) depGrandTransactions[m] = allTx
      }
      depGrandTotalAll = Object.values(depGrandTotal).reduce((s, v) => s + v, 0)
    }

    // ========== RECETTES ==========
    const recRoot = categories.find((c) => c.code === 'REC')
    let recTree: CategoryNode[] = []
    const recGrandTotal: Record<string, number> = {}
    const recGrandTransactions: Record<string, Transaction[]> = {}
    let recGrandTotalAll = 0

    if (recRoot) {
      const recAgg: Record<string, Record<string, number>> = {}
      const recTxMap: Record<string, Record<string, Transaction[]>> = {}

      if (revenus) {
        for (const r of revenus) {
          const month = (r.mois as string).substring(0, 7)
          const catCode =
            (r.type_revenu ? TYPE_REVENU_TO_CATEGORY[r.type_revenu] : null) || 'REC_AUTRES'
          if (!recAgg[catCode]) recAgg[catCode] = {}
          recAgg[catCode][month] = (recAgg[catCode][month] || 0) + (r.montant_prevu || 0)
          if (!recTxMap[catCode]) recTxMap[catCode] = {}
          if (!recTxMap[catCode][month]) recTxMap[catCode][month] = []
          recTxMap[catCode][month].push({
            nom: r.notes || r.type_revenu || 'Revenu',
            montant: r.montant_prevu || 0,
            statut: r.statut || 'prevu',
          })
        }
      }

      recTree = buildTree(categories, recRoot.id, 'recette', recAgg, recTxMap, months)

      for (const m of months) {
        recGrandTotal[m] = recTree.reduce((s, n) => s + (n.monthlyData[m] || 0), 0)
        const allTx: Transaction[] = []
        for (const n of recTree) {
          if (n.transactions[m]) allTx.push(...n.transactions[m])
        }
        if (allTx.length > 0) recGrandTransactions[m] = allTx
      }
      recGrandTotalAll = Object.values(recGrandTotal).reduce((s, v) => s + v, 0)
    }

    // ========== SOLDES ==========
    const solde: Record<string, number> = {}
    const soldeCumule: Record<string, number> = {}
    let cumul = 0
    for (const m of months) {
      solde[m] = (recGrandTotal[m] || 0) - (depGrandTotal[m] || 0)
      cumul += solde[m]
      soldeCumule[m] = cumul
    }

    return {
      tree: depTree,
      grandTotal: depGrandTotal,
      grandTotalAll: depGrandTotalAll,
      grandTransactions: depGrandTransactions,
      revenueTree: recTree,
      revenueGrandTotal: recGrandTotal,
      revenueGrandTotalAll: recGrandTotalAll,
      revenueGrandTransactions: recGrandTransactions,
      solde,
      soldeCumule,
    }
  }, [categories, depenses, revenus, months])

  return {
    ...result,
    months,
    currentMonth,
    isLoading: isLoadingDep || isLoadingRev,
  }
}

// Shared tree builder
type CatRow = {
  id: string
  code: string
  nom: string
  parent_id: string | null
  niveau: number
  ordre: number | null
  type: string
}

function buildTree(
  categories: CatRow[],
  rootId: string,
  type: string,
  agg: Record<string, Record<string, number>>,
  txMap: Record<string, Record<string, Transaction[]>>,
  months: string[]
): CategoryNode[] {
  function buildNode(cat: CatRow): CategoryNode {
    const children = categories
      .filter((c) => c.parent_id === cat.id && c.id !== cat.id)
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
      .map(buildNode)

    const ownData = agg[cat.code] || {}
    const ownTx = txMap[cat.code] || {}

    const monthlyData: Record<string, number> = {}
    const transactions: Record<string, Transaction[]> = {}

    for (const m of months) {
      let val = ownData[m] || 0
      const txList: Transaction[] = [...(ownTx[m] || [])]
      for (const child of children) {
        val += child.monthlyData[m] || 0
        if (child.transactions[m]) txList.push(...child.transactions[m])
      }
      monthlyData[m] = val
      if (txList.length > 0) transactions[m] = txList
    }

    const total = Object.values(monthlyData).reduce((s, v) => s + v, 0)

    return {
      id: cat.id,
      code: cat.code,
      nom: cat.nom,
      niveau: cat.niveau,
      ordre: cat.ordre || 0,
      parentId: cat.parent_id,
      children,
      monthlyData,
      transactions,
      total,
    }
  }

  return categories
    .filter((c) => c.parent_id === rootId && c.type === type)
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
    .map(buildNode)
}
