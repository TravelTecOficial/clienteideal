/**
 * Dados mock para o Dashboard de Indicadores.
 * Estrutura tipada para fácil migração para useQuery do Supabase.
 * Note: UI-level. RLS valida company_id no Supabase.
 */

export interface KpiComercial {
  investimentoAds: number
  investimentoAdsVariacao: number
  atendimentos: number
  atendimentosVariacao: number
  agendamentos: number
  agendamentosVariacao: number
  vendas: number
  vendasVariacao: number
  faturamento: number
  lucro: number
}

export interface HistoricoFechamento {
  mes: string
  fechamentos: number
}

export interface TemperaturaLead {
  nome: string
  valor: number
  cor: string
}

export interface CanalSocial {
  canal: string
  seguidores: number
  engajamento: number
  cor: string
}

export const MOCK_KPI_COMERCIAL: KpiComercial = {
  investimentoAds: 12450,
  investimentoAdsVariacao: 12.5,
  atendimentos: 1240,
  atendimentosVariacao: 8.2,
  agendamentos: 85,
  agendamentosVariacao: -5.1,
  vendas: 32,
  vendasVariacao: 15.3,
  faturamento: 84200,
  lucro: 28150,
}

export const MOCK_HISTORICO: HistoricoFechamento[] = [
  { mes: "Jan", fechamentos: 18 },
  { mes: "Fev", fechamentos: 22 },
  { mes: "Mar", fechamentos: 25 },
  { mes: "Abr", fechamentos: 19 },
  { mes: "Mai", fechamentos: 28 },
  { mes: "Jun", fechamentos: 32 },
]

export const MOCK_TEMPERATURA: TemperaturaLead[] = [
  { nome: "Quente", valor: 45, cor: "#b91c1c" },
  { nome: "Morno", valor: 35, cor: "#d97706" },
  { nome: "Frio", valor: 20, cor: "#2563eb" },
]

export const MOCK_CANAIS: CanalSocial[] = [
  { canal: "Instagram", seguidores: 12500, engajamento: 8.2, cor: "#E4405F" },
  { canal: "Facebook", seguidores: 8200, engajamento: 5.1, cor: "#1877F2" },
  { canal: "LinkedIn", seguidores: 3400, engajamento: 4.8, cor: "#0A66C2" },
  { canal: "YouTube", seguidores: 5600, engajamento: 6.3, cor: "#FF0000" },
]
