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

export type OpportunityStage =
  | "novo"
  | "qualificacao"
  | "negociacao"
  | "proposta"
  | "ganho"
  | "perdido";

const STAGE_OPTIONS: { value: OpportunityStage; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "qualificacao", label: "Em fase de qualificação" },
  { value: "negociacao", label: "Em negociação" },
  { value: "proposta", label: "Proposta" },
  { value: "ganho", label: "Ganho" },
  { value: "perdido", label: "Perdido" },
];

const opportunityFormSchema = z.object({
  title: z.string().min(2, "O título deve ter pelo menos 2 caracteres"),
  value: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseFloat(v.replace(",", ".")) || 0 : v))
    .pipe(z.number().min(0, "O valor deve ser maior ou igual a zero")),
  expected_closing_date: z.string().optional(),
  stage: z.enum([
    "novo",
    "qualificacao",
    "negociacao",
    "proposta",
    "ganho",
    "perdido",
  ]),
  ideal_customer_id: z.string().optional(),
  product_id: z.string().optional(),
  seller_id: z.string().optional(),
});

export type OpportunityFormValues = z.infer<typeof opportunityFormSchema>;

export interface ProfileOption {
  id: string;
  full_name: string | null;
}

export interface IdealCustomerOption {
  id: string;
  profile_name: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
}

interface OpportunityFormProps {
  onSubmit: (values: OpportunityFormValues) => void | Promise<void>;
  defaultValues?: Partial<OpportunityFormValues>;
  isEditing?: boolean;
  isSaving: boolean;
  onCancel?: () => void;
  profiles: ProfileOption[];
  idealCustomers: IdealCustomerOption[];
  products: ProductOption[];
}

export function OpportunityForm({
  onSubmit,
  defaultValues,
  isEditing = false,
  isSaving,
  onCancel,
  profiles,
  idealCustomers,
  products,
}: OpportunityFormProps) {
  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      title: "",
      value: 0,
      expected_closing_date: "",
      stage: "novo",
      ideal_customer_id: "",
      product_id: "",
      seller_id: "",
      ...defaultValues,
    },
  });

  return (
    <form
      className="grid gap-4 py-4"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="space-y-2">
        <Label htmlFor="title">Título da Oportunidade</Label>
        <Input
          id="title"
          placeholder="Ex: Venda Empresa ABC"
          {...form.register("title")}
        />
        {form.formState.errors.title && (
          <p className="text-xs text-destructive">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="value">Valor (R$)</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            min={0}
            placeholder="0,00"
            {...form.register("value")}
          />
          {form.formState.errors.value && (
            <p className="text-xs text-destructive">
              {form.formState.errors.value.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="expected_closing_date">Data Prevista de Fechamento</Label>
          <Input
            id="expected_closing_date"
            type="date"
            {...form.register("expected_closing_date")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Estágio</Label>
        <Select
          value={form.watch("stage")}
          onValueChange={(v: string) =>
            form.setValue("stage", v as OpportunityFormValues["stage"])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Cliente Ideal (ICP)</Label>
        <Select
          value={form.watch("ideal_customer_id") || "none"}
          onValueChange={(v: string) =>
            form.setValue("ideal_customer_id", v === "none" ? "" : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um perfil..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {idealCustomers.map((ic) => (
              <SelectItem key={ic.id} value={ic.id}>
                {ic.profile_name ?? "Sem nome"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Produto</Label>
        <Select
          value={form.watch("product_id") || "none"}
          onValueChange={(v: string) =>
            form.setValue("product_id", v === "none" ? "" : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um produto..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Atribuir Vendedor</Label>
        <Select
          value={form.watch("seller_id") || "none"}
          onValueChange={(v: string) =>
            form.setValue("seller_id", v === "none" ? "" : v)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.full_name ?? profile.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button variant="outline" type="button" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing ? (
            "Salvar alterações"
          ) : (
            "Criar oportunidade"
          )}
        </Button>
      </div>
    </form>
  );
}
