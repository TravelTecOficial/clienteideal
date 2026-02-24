/**
 * Formata valor numérico em moeda BRL para exibição.
 */
export function formatCurrencyDisplay(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Remove formatação de moeda e retorna número.
 */
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/\D/g, "");
  if (!cleaned) return 0;
  const num = parseInt(cleaned, 10) / 100;
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Formata string de input para exibição em tempo real (R$ 0,00).
 */
export function formatCurrencyInput(value: string): string {
  const num = parseCurrencyInput(value);
  if (num === 0 && !value.replace(/\D/g, "")) return "";
  return formatCurrencyDisplay(num);
}
