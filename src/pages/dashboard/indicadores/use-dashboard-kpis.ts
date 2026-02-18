/**
 * Hook para buscar KPIs do Dashboard a partir do Supabase.
 * Note: UI-level. RLS valida company_id no Supabase.
 */

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@clerk/clerk-react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays, parseISO } from "date-fns"
import { formatISO } from "date-fns"
import { useSupabaseClient } from "@/lib/supabase-context"
import type { PeriodRange } from "./period-utils"

interface ProfileRow {
  company_id: string | null
}

interface PagamentoRow {
  valor: number
}

export interface DashboardKpis {
  investimentoAds: number
  atendimentos: number
  agendamentos: number
  reunioes: number
  vendas: number
}

async function fetchCompanyId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("Erro ao buscar company_id:", error)
    return null
  }
  const profile = data as ProfileRow | null
  return profile?.company_id ?? null
}

/**
 * Para timestamptz: incluir o dia inteiro usando lt com o dia seguinte.
 */
function getEndExclusiveForTimestamptz(end: string): string {
  const endDate = parseISO(end)
  const nextDay = addDays(endDate, 1)
  return formatISO(nextDay, { representation: "date" })
}

export function useDashboardKpis(periodo: PeriodRange) {
  const { userId } = useAuth()
  const supabase = useSupabaseClient()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [kpis, setKpis] = useState<DashboardKpis>({
    investimentoAds: 0,
    atendimentos: 0,
    agendamentos: 0,
    reunioes: 0,
    vendas: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchKpis = useCallback(async () => {
    if (!userId || !companyId || !supabase) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const hasPeriod = periodo.start !== null && periodo.end !== null

      const [
        investimentoRes,
        atendimentosRes,
        agendamentosRes,
        reunioesRes,
        vendasRes,
      ] = await Promise.all([
          // Investimento Ads - pagamentos_anuncios (data é date)
          (async () => {
            let query = supabase
              .from("pagamentos_anuncios")
              .select("valor")
              .eq("company_id", companyId)

            if (hasPeriod && periodo.start && periodo.end) {
              query = query.gte("data", periodo.start).lte("data", periodo.end)
            }

            const { data, error: err } = await query
            if (err) throw err

            const rows = (data as PagamentoRow[]) ?? []
            const total = rows.reduce((acc, r) => acc + Number(r.valor), 0)
            return total
          })(),

          // Atendimentos - atendimentos_ia (created_at é timestamptz)
          (async () => {
            let query = supabase
              .from("atendimentos_ia")
              .select("id", { count: "exact", head: true })
              .eq("company_id", companyId)

            if (hasPeriod && periodo.start && periodo.end) {
              const endExclusive = getEndExclusiveForTimestamptz(periodo.end)
              query = query
                .gte("created_at", periodo.start)
                .lt("created_at", endExclusive)
            }

            const { count, error: err } = await query
            if (err) throw err
            return count ?? 0
          })(),

          // Agendamentos - agenda (data_hora é timestamptz, excluir Cancelado)
          (async () => {
            let query = supabase
              .from("agenda")
              .select("id", { count: "exact", head: true })
              .eq("company_id", companyId)
              .neq("status", "Cancelado")

            if (hasPeriod && periodo.start && periodo.end) {
              const endExclusive = getEndExclusiveForTimestamptz(periodo.end)
              query = query
                .gte("data_hora", periodo.start)
                .lt("data_hora", endExclusive)
            }

            const { count, error: err } = await query
            if (err) throw err
            return count ?? 0
          })(),

          // Reuniões - agenda com status = 'Finalizado' (reuniões realizadas)
          (async () => {
            let query = supabase
              .from("agenda")
              .select("id", { count: "exact", head: true })
              .eq("company_id", companyId)
              .eq("status", "Finalizado")

            if (hasPeriod && periodo.start && periodo.end) {
              const endExclusive = getEndExclusiveForTimestamptz(periodo.end)
              query = query
                .gte("data_hora", periodo.start)
                .lt("data_hora", endExclusive)
            }

            const { count, error: err } = await query
            if (err) throw err
            return count ?? 0
          })(),

          // Vendas - opportunities com stage = 'ganho'
          (async () => {
            let query = supabase
              .from("opportunities")
              .select("id", { count: "exact", head: true })
              .eq("company_id", companyId)
              .eq("stage", "ganho")

            if (hasPeriod && periodo.start && periodo.end) {
              const endExclusive = getEndExclusiveForTimestamptz(periodo.end)
              query = query
                .gte("created_at", periodo.start)
                .lt("created_at", endExclusive)
            }

            const { count, error: err } = await query
            if (err) throw err
            return count ?? 0
          })(),
        ])

      setKpis({
        investimentoAds: investimentoRes,
        atendimentos: atendimentosRes,
        agendamentos: agendamentosRes,
        reunioes: reunioesRes,
        vendas: vendasRes,
      })
    } catch (err) {
      console.error("Erro ao carregar KPIs:", err)
      setError("Não foi possível carregar os indicadores.")
      setKpis({
        investimentoAds: 0,
        atendimentos: 0,
        agendamentos: 0,
        reunioes: 0,
        vendas: 0,
      })
    } finally {
      setIsLoading(false)
    }
  }, [companyId, supabase, periodo.start, periodo.end, userId])

  useEffect(() => {
    if (!userId || !supabase) return
    fetchCompanyId(supabase, userId).then(setCompanyId)
  }, [userId, supabase])

  useEffect(() => {
    if (companyId) {
      fetchKpis()
    } else {
      setIsLoading(false)
    }
  }, [companyId, fetchKpis])

  return { kpis, isLoading, error }
}
