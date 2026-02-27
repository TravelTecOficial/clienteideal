import Papa from "papaparse";
import * as XLSX from "xlsx";

/** Campo mapeável do sistema para leads */
export type LeadFieldId =
  | "name"
  | "email"
  | "phone"
  | "external_id"
  | "status"
  | "classificacao"
  | "data_nascimento"
  | "idade"
  | "cep"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_term"
  | "utm_content"
  | "utm_id"
  | "fbclid"
  | "gclid"
  | "item_name";

export const LEAD_FIELD_OPTIONS: { value: LeadFieldId | ""; label: string }[] = [
  { value: "", label: "— Ignorar" },
  { value: "name", label: "Nome" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefone" },
  { value: "external_id", label: "External ID" },
  { value: "status", label: "Status" },
  { value: "classificacao", label: "Classificação" },
  { value: "data_nascimento", label: "Data Nascimento" },
  { value: "idade", label: "Idade" },
  { value: "cep", label: "CEP" },
  { value: "utm_source", label: "UTM Source" },
  { value: "utm_medium", label: "UTM Medium" },
  { value: "utm_campaign", label: "UTM Campaign" },
  { value: "utm_term", label: "UTM Term" },
  { value: "utm_content", label: "UTM Content" },
  { value: "utm_id", label: "UTM ID" },
  { value: "fbclid", label: "FBCLID" },
  { value: "gclid", label: "GCLID" },
  { value: "item_name", label: "Produto/Serviço (nome)" },
];

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  previewRows: Record<string, string>[];
}

/** Palavras que indicam que uma célula é cabeçalho (não dado) */
const HEADER_HINTS = [
  "nome",
  "name",
  "email",
  "e-mail",
  "celular",
  "phone",
  "telefone",
  "cpf",
  "cep",
  "id",
  "código",
  "codigo",
  "número",
  "numero",
  "data",
  "endereço",
  "endereco",
  "cidade",
  "estado",
  "observação",
  "observacao",
  "whatsapp",
  "fone",
  "tel",
  "cliente",
  "lead",
  "status",
  "classificação",
  "classificacao",
];

function cellLooksLikeHeader(cell: string): boolean {
  const lower = String(cell ?? "").trim().toLowerCase();
  if (!lower) return false;
  return HEADER_HINTS.some((h) => lower.includes(h));
}

/** Detecta se a primeira linha parece ser cabeçalho (verifica qualquer célula) */
function firstRowLooksLikeHeader(row: string[]): boolean {
  return row.some((cell) => cellLooksLikeHeader(String(cell ?? "")));
}

/** Detecta se uma linha parece ser dados (não cabeçalho) */
function looksLikeDataRow(row: string[]): boolean {
  const first = row[0]?.trim() ?? "";
  if (!first) return false;
  if (cellLooksLikeHeader(first)) return false;
  if (/^\d+$/.test(first) && first.length > 5) return true;
  if (first.includes("@")) return true;
  if (first.length >= 2 && !first.toLowerCase().includes("nome") && !first.toLowerCase().includes("email"))
    return true;
  return false;
}

/**
 * Parseia CSV com papaparse. Detecta cabeçalho automaticamente.
 * Suporta vírgula, ponto-e-vírgula e valores entre aspas.
 */
export function parseCsvFile(text: string): ParsedCsvResult {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
    delimiter: text.includes(";") ? ";" : ",",
  });

  const rawRows = parsed.data.filter((row) => row.some((cell) => String(cell).trim() !== ""));
  if (rawRows.length === 0) {
    return { headers: [], rows: [], previewRows: [] };
  }

  const firstRow = rawRows[0];
  const secondRow = rawRows[1];
  const hasHeader =
    firstRow &&
    (firstRowLooksLikeHeader(firstRow) ||
      (secondRow && looksLikeDataRow(secondRow) && !looksLikeDataRow(firstRow)));

  const headers = hasHeader
    ? firstRow.map((h, i) => String(h ?? "").trim() || `Coluna ${i + 1}`)
    : firstRow.map((_, i) => `Coluna ${i + 1}`);
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;

  const rows: Record<string, string>[] = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = String(row[i] ?? "").trim();
    });
    return obj;
  });

  const previewRows = rows.slice(0, 5);

  return { headers, rows, previewRows };
}

/**
 * Converte raw rows (array de arrays) em ParsedCsvResult.
 * Reutiliza a lógica de detecção de cabeçalho do CSV.
 */
function rawRowsToResult(rawRows: unknown[][]): ParsedCsvResult {
  const rows = rawRows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== ""));
  if (rows.length === 0) {
    return { headers: [], rows: [], previewRows: [] };
  }

  const firstRow = rows[0] as string[];
  const secondRow = rows[1] as string[] | undefined;
  const hasHeader =
    firstRow &&
    (firstRowLooksLikeHeader(firstRow) ||
      (secondRow && looksLikeDataRow(secondRow) && !looksLikeDataRow(firstRow)));

  const headers = hasHeader
    ? firstRow.map((h, i) => String(h ?? "").trim() || `Coluna ${i + 1}`)
    : firstRow.map((_, i) => `Coluna ${i + 1}`);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const resultRows: Record<string, string>[] = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    const arr = row as unknown[];
    headers.forEach((h, i) => {
      obj[h] = String(arr[i] ?? "").trim();
    });
    return obj;
  });

  const previewRows = resultRows.slice(0, 5);

  return { headers, rows: resultRows, previewRows };
}

/**
 * Parseia arquivo XLSX (Excel). Lê a primeira planilha.
 */
export function parseXlsxFile(buffer: ArrayBuffer): ParsedCsvResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { headers: [], rows: [], previewRows: [] };
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
  return rawRowsToResult(rawRows);
}

const STATUS_VALUES = ["Novo", "Em Contato", "Qualificado", "Perdido"] as const;
const CLASSIFICACAO_VALUES = ["Frio", "Morno", "Quente"] as const;

function normalizeStatus(val: string): (typeof STATUS_VALUES)[number] | null {
  if (!val || typeof val !== "string") return null;
  const lower = val.trim().toLowerCase();
  if (lower === "novo") return "Novo";
  if (lower.includes("contato")) return "Em Contato";
  if (lower === "qualificado") return "Qualificado";
  if (lower === "perdido") return "Perdido";
  return null;
}

function normalizeClassificacao(val: string): (typeof CLASSIFICACAO_VALUES)[number] | null {
  if (!val || typeof val !== "string") return null;
  const lower = val.trim().toLowerCase();
  if (lower === "frio") return "Frio";
  if (lower === "morno") return "Morno";
  if (lower === "quente") return "Quente";
  return null;
}

function parseDate(val: string): string | null {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/) ?? trimmed.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    if (match[1].length === 4) return `${match[1]}-${match[2]}-${match[3]}`;
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return null;
}

function parseIdade(val: string): number | null {
  if (!val || typeof val !== "string") return null;
  const n = parseInt(val.replace(/\D/g, ""), 10);
  if (Number.isNaN(n) || n < 0 || n > 150) return null;
  return n;
}

function normalizeCep(val: string): string | null {
  if (!val || typeof val !== "string") return null;
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Extrai números de telefone válidos de uma string (DDD 2 dígitos + 8 ou 9 dígitos).
 */
export function extractPhoneNumbers(raw: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  const digits = raw.replace(/\D/g, "");
  const matches: string[] = [];
  const regex = /(\d{2})(\d{8,9})/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(digits)) !== null) {
    matches.push(m[1] + m[2]);
  }
  return matches;
}

/**
 * Retorna o primeiro número de telefone e indica se havia múltiplos.
 */
export function normalizePhoneToSingle(raw: string): { phone: string | null; hadMultiple: boolean } {
  const numbers = extractPhoneNumbers(raw);
  if (numbers.length === 0) return { phone: null, hadMultiple: false };
  return {
    phone: numbers[0] ?? null,
    hadMultiple: numbers.length > 1,
  };
}

export interface PhoneAnalysisResult {
  totalWithMultiple: number;
  sampleRowIndices: number[];
}

/**
 * Analisa a coluna mapeada como telefone e conta quantas linhas têm múltiplos números.
 */
export function analyzePhoneColumn(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): PhoneAnalysisResult {
  const phoneHeader = Object.keys(mapping).find((h) => mapping[h] === "phone");
  if (!phoneHeader) return { totalWithMultiple: 0, sampleRowIndices: [] };

  const sampleRowIndices: number[] = [];
  let totalWithMultiple = 0;

  rows.forEach((row, idx) => {
    const raw = (row[phoneHeader] ?? "").trim();
    if (!raw) return;
    const { hadMultiple } = normalizePhoneToSingle(raw);
    if (hadMultiple) {
      totalWithMultiple++;
      if (sampleRowIndices.length < 5) sampleRowIndices.push(idx + 1);
    }
  });

  return { totalWithMultiple, sampleRowIndices };
}

export interface LeadImportPayload {
  company_id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  external_id: string | null;
  status: "Novo" | "Em Contato" | "Qualificado" | "Perdido";
  classificacao: "Frio" | "Morno" | "Quente" | null;
  is_cliente: boolean;
  data_nascimento: string | null;
  idade: number | null;
  cep: string | null;
  item_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  utm_id: string | null;
  fbclid: string | null;
  gclid: string | null;
}

export type ColumnMapping = Record<string, LeadFieldId | "">;

/**
 * Converte uma linha CSV mapeada em payload para insert no Supabase.
 * item_name é resolvido para item_id via itemsMap (nome -> uuid).
 */
export function rowToPayload(
  row: Record<string, string>,
  mapping: ColumnMapping,
  meta: {
    company_id: string;
    user_id: string;
    is_cliente: boolean;
    itemsMap: Map<string, string>;
  }
): LeadImportPayload | null {
  const getVal = (fieldId: LeadFieldId): string => {
    const header = Object.keys(mapping).find((h) => mapping[h] === fieldId);
    return header ? (row[header] ?? "").trim() : "";
  };

  const nameVal = getVal("name");
  if (!nameVal || nameVal.length < 2) return null;

  const statusVal = getVal("status");
  const classificacaoVal = getVal("classificacao");
  const itemNameVal = getVal("item_name");

  const { phone: phoneVal } = normalizePhoneToSingle(getVal("phone"));

  const payload: LeadImportPayload = {
    company_id: meta.company_id,
    user_id: meta.user_id,
    name: nameVal,
    email: getVal("email") || null,
    phone: phoneVal,
    external_id: getVal("external_id") || null,
    status: normalizeStatus(statusVal) ?? "Novo",
    classificacao: normalizeClassificacao(classificacaoVal),
    is_cliente: meta.is_cliente,
    data_nascimento: parseDate(getVal("data_nascimento")),
    idade: parseIdade(getVal("idade")),
    cep: normalizeCep(getVal("cep")) ?? (getVal("cep") || null),
    item_id: itemNameVal ? meta.itemsMap.get(itemNameVal.trim().toLowerCase()) ?? null : null,
    utm_source: getVal("utm_source") || null,
    utm_medium: getVal("utm_medium") || null,
    utm_campaign: getVal("utm_campaign") || null,
    utm_term: getVal("utm_term") || null,
    utm_content: getVal("utm_content") || null,
    utm_id: getVal("utm_id") || null,
    fbclid: getVal("fbclid") || null,
    gclid: getVal("gclid") || null,
  };

  return payload;
}

/**
 * Sugere mapeamento automático baseado em similaridade de cabeçalhos.
 */
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());

  const patterns: { keys: string[]; field: LeadFieldId }[] = [
    { keys: ["nome", "name", "nome completo", "nome_cliente", "cliente"], field: "name" },
    { keys: ["email", "e-mail", "e_mail", "mail"], field: "email" },
    { keys: ["telefone", "phone", "celular", "fone", "tel"], field: "phone" },
    { keys: ["external_id", "id externo", "id_externo", "crm_id", "id"], field: "external_id" },
    { keys: ["status", "estado", "situacao"], field: "status" },
    { keys: ["classificacao", "classificação", "temperatura", "score"], field: "classificacao" },
    { keys: ["data_nascimento", "nascimento", "data de nascimento", "birth"], field: "data_nascimento" },
    { keys: ["idade", "age"], field: "idade" },
    { keys: ["cep", "zip", "postal"], field: "cep" },
    { keys: ["utm_source", "utm source", "source"], field: "utm_source" },
    { keys: ["utm_medium", "utm medium", "medium"], field: "utm_medium" },
    { keys: ["utm_campaign", "utm campaign", "campaign", "campanha"], field: "utm_campaign" },
    { keys: ["utm_term", "utm term", "term"], field: "utm_term" },
    { keys: ["utm_content", "utm content", "content"], field: "utm_content" },
    { keys: ["utm_id", "utm id"], field: "utm_id" },
    { keys: ["fbclid", "fb_clid"], field: "fbclid" },
    { keys: ["gclid", "gcl_id"], field: "gclid" },
    { keys: ["produto", "serviço", "servico", "item", "product", "service"], field: "item_name" },
  ];

  headers.forEach((header, i) => {
    const lower = lowerHeaders[i] ?? "";
    let found: LeadFieldId | null = null;
    for (const { keys, field } of patterns) {
      if (keys.some((k) => lower.includes(k))) {
        found = field;
        break;
      }
    }
    mapping[header] = found ?? "";
  });

  return mapping;
}
