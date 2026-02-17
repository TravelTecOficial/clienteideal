import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function getMinDateTime(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

const baseSchema = z.object({
  tipo_reuniao: z.string().min(2, "Tipo de reunião obrigatório"),
  vendedor_id: z.string().optional(),
  status: z.enum(["Pendente", "Confirmado", "Cancelado", "Finalizado"]),
  descricao: z.string().optional(),
});

const agendaFormSchemaCreate = baseSchema.extend({
  data_hora: z
    .string()
    .min(1, "Data/hora obrigatória")
    .refine((val) => new Date(val) >= new Date(), {
      message: "Data/hora não pode ser anterior a agora",
    }),
});

const agendaFormSchemaEdit = baseSchema.extend({
  data_hora: z.string().min(1, "Data/hora obrigatória"),
});

function getAgendaFormSchema(mode: "create" | "edit") {
  return mode === "create" ? agendaFormSchemaCreate : agendaFormSchemaEdit;
}

export type AgendaFormValues = z.infer<typeof agendaFormSchemaCreate>;

export interface VendedorOption {
  id: string;
  nome: string;
}

const STATUS_OPTIONS: { value: AgendaFormValues["status"]; label: string }[] = [
  { value: "Pendente", label: "Pendente" },
  { value: "Confirmado", label: "Confirmado" },
  { value: "Cancelado", label: "Cancelado" },
  { value: "Finalizado", label: "Finalizado" },
];

interface AgendaFormProps {
  onSubmit: (values: AgendaFormValues) => void | Promise<void>;
  defaultValues?: Partial<AgendaFormValues>;
  isSaving: boolean;
  vendedores: VendedorOption[];
  mode?: "create" | "edit";
  onCancelAgenda?: () => void | Promise<void>;
  isCancelling?: boolean;
}

export function AgendaForm({
  onSubmit,
  defaultValues,
  isSaving,
  vendedores,
  mode = "create",
  onCancelAgenda,
  isCancelling = false,
}: AgendaFormProps) {
  const form = useForm<AgendaFormValues>({
    resolver: zodResolver(getAgendaFormSchema(mode)),
    defaultValues: {
      data_hora: "",
      tipo_reuniao: "",
      vendedor_id: "",
      status: "Pendente",
      descricao: "",
      ...defaultValues,
    },
  });

  const currentStatus = form.watch("status");
  const showCancelButton =
    mode === "edit" &&
    onCancelAgenda &&
    currentStatus !== "Cancelado";

  return (
    <form
      className="grid gap-4 py-4"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="space-y-2">
        <Label htmlFor="data_hora">Data e Hora</Label>
        <Input
          id="data_hora"
          type="datetime-local"
          min={mode === "create" ? getMinDateTime() : undefined}
          {...form.register("data_hora")}
        />
        {form.formState.errors.data_hora && (
          <p className="text-xs text-destructive">
            {form.formState.errors.data_hora.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipo_reuniao">Tipo de Reunião</Label>
        <Input
          id="tipo_reuniao"
          placeholder="Ex: Reunião de vendas, Demonstração"
          {...form.register("tipo_reuniao")}
        />
        {form.formState.errors.tipo_reuniao && (
          <p className="text-xs text-destructive">
            {form.formState.errors.tipo_reuniao.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Vendedor Responsável</Label>
        <Select
          value={form.watch("vendedor_id") || "none"}
          onValueChange={(v: string) =>
            form.setValue("vendedor_id", v === "none" ? "" : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o vendedor..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={form.watch("status")}
          onValueChange={(v: string) =>
            form.setValue("status", v as AgendaFormValues["status"])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          placeholder="Observações sobre a reunião..."
          rows={3}
          {...form.register("descricao")}
        />
      </div>

      <div className="flex justify-between pt-2">
        <div>
          {showCancelButton && (
            <Button
              type="button"
              variant="destructive"
              disabled={isSaving || isCancelling}
              onClick={onCancelAgenda}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Cancelar agendamento"
              )}
            </Button>
          )}
        </div>
        <Button type="submit" disabled={isSaving || isCancelling}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : mode === "edit" ? (
            "Salvar alterações"
          ) : (
            "Salvar agendamento"
          )}
        </Button>
      </div>
    </form>
  );
}
