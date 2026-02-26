import { useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";
import {
  parseCsvFile,
  suggestMapping,
  rowToPayload,
  LEAD_FIELD_OPTIONS,
  type ParsedCsvResult,
  type ColumnMapping,
  type LeadImportPayload,
} from "@/lib/csv-leads-import";

const BATCH_SIZE = 50;

interface LeadImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  onSuccess: () => void;
}

async function fetchItemsMap(
  supabase: SupabaseClient,
  companyId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("items")
    .select("id, name")
    .eq("company_id", companyId);
  if (error) return new Map();
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const name = (row as { name: string }).name;
    if (name) map.set(name.trim().toLowerCase(), (row as { id: string }).id);
  }
  return map;
}

export function LeadImportModal({
  open,
  onOpenChange,
  companyId,
  onSuccess,
}: LeadImportModalProps) {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [parsed, setParsed] = useState<ParsedCsvResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importAs, setImportAs] = useState<"lead" | "cliente">("lead");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        const parsedResult = parseCsvFile(text);
        if (parsedResult.headers.length === 0 || parsedResult.rows.length === 0) {
          toast({
            variant: "destructive",
            title: "Arquivo inválido",
            description: "Nenhum dado encontrado no CSV. Verifique o formato.",
          });
          return;
        }
        setParsed(parsedResult);
        setMapping(suggestMapping(parsedResult.headers));
        setStep(2);
        setResult(null);
      };
      reader.readAsText(file, "UTF-8");
      e.target.value = "";
    },
    [toast]
  );

  const handleReset = useCallback(() => {
    setStep(1);
    setParsed(null);
    setMapping({});
    setImportAs("lead");
    setResult(null);
    fileInputRef.current?.click();
  }, []);

  const handleClose = useCallback(() => {
    setStep(1);
    setParsed(null);
    setMapping({});
    setResult(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleImport = useCallback(async () => {
    if (!parsed || !companyId || !userId) return;

    const nameMapped = Object.values(mapping).includes("name");
    if (!nameMapped) {
      toast({
        variant: "destructive",
        title: "Mapeamento obrigatório",
        description: "É necessário mapear pelo menos a coluna Nome.",
      });
      return;
    }

    setIsImporting(true);
    setResult(null);

    try {
      const itemsMap = await fetchItemsMap(supabase, companyId);
      const payloads: LeadImportPayload[] = [];

      for (const row of parsed.rows) {
        const payload = rowToPayload(row, mapping, {
          company_id: companyId,
          user_id: userId,
          is_cliente: importAs === "cliente",
          itemsMap,
        });
        if (payload) payloads.push(payload);
      }

      if (payloads.length === 0) {
        toast({
          variant: "destructive",
          title: "Nenhum registro válido",
          description: "Nenhuma linha possui nome válido (mínimo 2 caracteres).",
        });
        setIsImporting(false);
        return;
      }

      const errors: string[] = [];
      let successCount = 0;

      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from("leads")
          .insert(batch)
          .select("id");

        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          successCount += (data ?? []).length;
        }
      }

      const failedCount = payloads.length - successCount;
      setResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 5),
      });
      setStep(3);

      if (successCount > 0) {
        toast({
          title: "Importação concluída",
          description: `${successCount} registro(s) importado(s) com sucesso.`,
        });
        onSuccess();
      }
      if (failedCount > 0) {
        toast({
          variant: "destructive",
          title: "Alguns registros falharam",
          description: `${failedCount} registro(s) não foram importados.`,
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao importar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
      setResult({
        success: 0,
        failed: parsed.rows.length,
        errors: [err instanceof Error ? err.message : "Erro desconhecido"],
      });
      setStep(3);
    } finally {
      setIsImporting(false);
    }
  }, [parsed, mapping, importAs, companyId, userId, supabase, toast, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar CSV</DialogTitle>
          <DialogDescription>
            {step === 1 && "Envie um arquivo CSV (exportado do Google Sheets ou Excel) para importar leads ou clientes."}
            {step === 2 && "Associe cada coluna do CSV ao campo correspondente do sistema."}
            {step === 3 && "Resultado da importação."}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {step === 1 && (
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium text-foreground">Clique ou arraste o arquivo CSV</p>
            <p className="text-xs text-muted-foreground mt-1">
              Exporte do Google Sheets: Arquivo → Fazer download → Valores separados por vírgula (.csv)
            </p>
          </div>
        )}

        {step === 2 && parsed && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de importação</Label>
              <RadioGroup
                value={importAs}
                onValueChange={(v) => setImportAs(v as "lead" | "cliente")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lead" id="import-lead" />
                  <Label htmlFor="import-lead" className="font-normal cursor-pointer">
                    Importar como Lead
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cliente" id="import-cliente" />
                  <Label htmlFor="import-cliente" className="font-normal cursor-pointer">
                    Importar como Cliente
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Coluna no CSV</TableHead>
                    <TableHead>Associar ao campo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.headers.map((header) => (
                    <TableRow key={header}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell>
                        <Select
                          value={mapping[header] === "" || !mapping[header] ? "__ignore" : mapping[header]}
                          onValueChange={(v) =>
                            setMapping((prev) => ({
                              ...prev,
                              [header]: v === "__ignore" ? "" : (v as ColumnMapping[string]),
                            }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="— Ignorar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignore">— Ignorar</SelectItem>
                            {LEAD_FIELD_OPTIONS.filter((o) => o.value).map((opt) => (
                              <SelectItem key={opt.value} value={opt.value as string}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!Object.values(mapping).includes("name") && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nome obrigatório</AlertTitle>
                <AlertDescription>
                  Associe pelo menos uma coluna ao campo &quot;Nome&quot; para que os registros sejam importados.
                </AlertDescription>
              </Alert>
            )}

            <div className="rounded-md border p-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Prévia (primeiras 5 linhas)</p>
              <div className="overflow-x-auto max-h-32 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {parsed.headers.slice(0, 5).map((h) => (
                        <TableHead key={h} className="text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.previewRows.map((row, idx) => (
                      <TableRow key={idx}>
                        {parsed.headers.slice(0, 5).map((h) => (
                          <TableCell key={h} className="text-xs max-w-[120px] truncate">
                            {row[h] ?? "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {parsed.rows.length} linha(s) serão processadas.
            </p>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-4">
            <Alert variant={result.failed > 0 ? "destructive" : "success"}>
              {result.failed > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.success} importado(s)
                {result.failed > 0 && ` · ${result.failed} falharam`}
              </AlertTitle>
              {result.errors.length > 0 && (
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 text-xs">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={handleReset} disabled={isImporting}>
                Trocar arquivo
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || !Object.values(mapping).includes("name")}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar {parsed?.rows.length ?? 0} registro(s)
                  </>
                )}
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Importar outro arquivo
              </Button>
              <Button onClick={handleClose}>Fechar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
