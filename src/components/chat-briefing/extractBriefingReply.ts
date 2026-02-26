/**
 * Extrai o texto da resposta do webhook de briefing n8n.
 * Considera output, message, text e formatos aninhados comuns.
 */
export function extractBriefingReply(data: unknown): string {
  const fallback = "Não foi possível processar a resposta. Tente novamente.";
  if (data == null) return fallback;
  if (typeof data === "string") return data;

  const dataObj = data as Record<string, unknown>;
  const firstItem = Array.isArray(data) ? data[0] : data;
  const item: Record<string, unknown> =
    (firstItem as Record<string, unknown> | null) ??
    (data as Record<string, unknown>) ??
    {};

  const output =
    item.output ??
    (item.json as Record<string, unknown>)?.output ??
    item.response ??
    (item.json as Record<string, unknown>)?.response ??
    dataObj?.output ??
    (dataObj.json as Record<string, unknown>)?.output ??
    dataObj?.response ??
    dataObj?.result ??
    dataObj?.message;

  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "content" in first)
      return String((first as { content?: unknown }).content ?? "");
    if (first && typeof first === "object" && "text" in first)
      return String((first as { text?: unknown }).text ?? "");
  }
  if (output && typeof output === "object") {
    const nested =
      (output as Record<string, unknown>).output ??
      (output as Record<string, unknown>).text ??
      (output as Record<string, unknown>).content;
    if (typeof nested === "string") return nested;
  }

  const text =
    item.text ??
    item.content ??
    dataObj?.text ??
    dataObj?.message;
  if (typeof text === "string") return text;

  return fallback;
}

/** Verifica se a resposta indica que o briefing foi concluído */
export function isBriefingCompleted(data: unknown): boolean {
  if (data == null || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return obj?.status === "completed";
}
