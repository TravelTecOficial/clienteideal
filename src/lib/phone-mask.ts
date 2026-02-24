/**
 * Máscara de telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * Aceita apenas dígitos; formata automaticamente.
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Remove formatação e retorna apenas dígitos.
 */
export function parsePhone(value: string): string {
  return value.replace(/\D/g, "");
}
