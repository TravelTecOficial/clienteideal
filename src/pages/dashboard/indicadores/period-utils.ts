/**
 * Utilitários para o seletor de período do Dashboard.
 * Note: UI-level. API enforcement required.
 */

import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  startOfDay,
  endOfDay,
  formatISO,
} from "date-fns"

export type PeriodoKey = "todo" | "7d" | "30d" | "mes" | "mesAnterior"

export interface PeriodRange {
  start: string | null
  end: string | null
}

export interface PeriodOption {
  value: PeriodoKey
  label: string
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { value: "todo", label: "Todo o período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mesAnterior", label: "Mês anterior" },
]

/**
 * Retorna o intervalo de datas para o período selecionado.
 * Para "todo", retorna { start: null, end: null } (sem filtro).
 * Datas em ISO string para uso nas queries Supabase.
 */
export function getPeriodRange(periodoKey: PeriodoKey): PeriodRange {
  const now = new Date()

  switch (periodoKey) {
    case "todo":
      return { start: null, end: null }

    case "7d": {
      const end = endOfDay(now)
      const start = startOfDay(subDays(now, 6))
      return {
        start: formatISO(start, { representation: "date" }),
        end: formatISO(end, { representation: "date" }),
      }
    }

    case "30d": {
      const end = endOfDay(now)
      const start = startOfDay(subDays(now, 29))
      return {
        start: formatISO(start, { representation: "date" }),
        end: formatISO(end, { representation: "date" }),
      }
    }

    case "mes": {
      const start = startOfMonth(now)
      const end = endOfMonth(now)
      return {
        start: formatISO(start, { representation: "date" }),
        end: formatISO(end, { representation: "date" }),
      }
    }

    case "mesAnterior": {
      const mesAnterior = subMonths(now, 1)
      const start = startOfMonth(mesAnterior)
      const end = endOfMonth(mesAnterior)
      return {
        start: formatISO(start, { representation: "date" }),
        end: formatISO(end, { representation: "date" }),
      }
    }

    default:
      return { start: null, end: null }
  }
}

/** Indica se o período deve exibir variação (vs. período anterior). */
export function hasVariacao(periodoKey: PeriodoKey): boolean {
  return periodoKey === "mes" || periodoKey === "mesAnterior"
}
