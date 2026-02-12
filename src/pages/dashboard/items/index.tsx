import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth, useOrganization } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Package, Wrench, Loader2, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";

// --- Interfaces ---
interface Item {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string | null;
  category: string | null;
  type: "product" | "service";
}

interface ProfileRow {
  company_id: string | null;
}

// --- Helpers ---
async function fetchCompanyId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar company_id:", error);
    return null;
  }
  const profile = data as ProfileRow | null;
  return profile?.company_id ?? null;
}

// --- Schema Zod ---
const itemFormSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  price: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "string" ? parseFloat(v) || 0 : v))
    .pipe(z.number().min(0, "O preço deve ser maior ou igual a zero")),
});

type ItemFormInput = z.input<typeof itemFormSchema>;

// --- Componente Principal ---
export default function ItemsPage() {
  const { userId } = useAuth();
  const { organization } = useOrganization();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<"product" | "service">("product");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ItemFormInput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      name: "",
      description: "",
      unit: "",
      category: "",
      price: 0,
    },
  });

  const effectiveCompanyId = companyId ?? organization?.id ?? null;

  const loadItems = useCallback(async () => {
    if (!effectiveCompanyId) return;
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;
      setItems((data as Item[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar itens:", err);
      toast({
        variant: "destructive",
        title: "Erro ao carregar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsFetching(false);
    }
  }, [effectiveCompanyId, supabase, toast]);

  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleOpenModal = () => {
    form.reset({
      name: "",
      description: "",
      unit: "",
      category: "",
      price: 0,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const onSubmit = async (values: ItemFormInput) => {
    if (!effectiveCompanyId || !userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
      });
      return;
    }
    const price =
      typeof values.price === "string" ? parseFloat(values.price) || 0 : values.price;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("items").insert({
        company_id: effectiveCompanyId,
        user_id: userId,
        name: values.name.trim(),
        description: values.description?.trim() || null,
        unit: values.unit?.trim() || null,
        category: values.category?.trim() || null,
        price,
        type: activeTab,
      });

      if (error) throw error;

      toast({
        title: "Item criado",
        description: `${values.name} foi adicionado com sucesso.`,
      });
      handleCloseModal();
      loadItems();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao criar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: Item) => {
    if (!userId) return;
    const confirmed = window.confirm(
      `Excluir "${item.name}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("items")
        .delete()
        .eq("id", item.id)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Item excluído",
        description: `${item.name} foi removido.`,
      });
      loadItems();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveCompanyId || !userId) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const hasHeader = lines[0]?.toLowerCase().includes("name") || lines[0]?.toLowerCase().includes("nome");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const rows: Array<{
        company_id: string;
        user_id: string;
        name: string;
        description: string | null;
        unit: string | null;
        category: string | null;
        price: number;
        type: "product" | "service";
      }> = [];

      for (const line of dataLines) {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length < 1 || !parts[0]) continue;

        const name = parts[0];
        const description = parts[1] ?? null;
        const unit = parts[2] ?? null;
        const category = parts[3] ?? null;
        const price = parseFloat(parts[4] ?? "0") || 0;
        const typeStr = (parts[5] ?? "").toLowerCase();
        const type: "product" | "service" =
          typeStr === "service"
            ? "service"
            : typeStr === "product"
              ? "product"
              : activeTab;

        rows.push({
          company_id: effectiveCompanyId,
          user_id: userId,
          name,
          description,
          unit,
          category,
          price,
          type,
        });
      }

      if (rows.length === 0) {
        toast({
          variant: "destructive",
          title: "Arquivo vazio",
          description: "Nenhum dado válido encontrado no CSV.",
        });
        return;
      }

      const { error } = await supabase.from("items").insert(rows);

      if (error) throw error;

      toast({
        title: "Importação concluída",
        description: `${rows.length} itens importados com sucesso.`,
      });
      loadItems();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao importar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const productItems = items.filter((i) => i.type === "product");
  const serviceItems = items.filter((i) => i.type === "service");

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Catálogo
        </h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportClick}
            disabled={isImporting || !effectiveCompanyId}
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Importar CSV
          </Button>
          <Button size="sm" onClick={handleOpenModal} disabled={!effectiveCompanyId}>
            <Plus className="mr-2 h-4 w-4" /> Novo Item
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "product" | "service")}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="product">
            <Package className="mr-2 h-4 w-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="service">
            <Wrench className="mr-2 h-4 w-4" /> Serviços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="product" className="mt-4">
          <ItemsTable
            type="product"
            data={productItems}
            isLoading={isFetching}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="service" className="mt-4">
          <ItemsTable
            type="service"
            data={serviceItems}
            isLoading={isFetching}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Modal Novo Item */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="border-border bg-background">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Novo {activeTab === "product" ? "Produto" : "Serviço"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Preencha os campos para cadastrar um novo item no catálogo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Nome
              </Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="Ex: Consultoria"
                className="border-input bg-background"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">
                Descrição
              </Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Descrição opcional"
                className="border-input bg-background min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit" className="text-foreground">
                  Unidade
                </Label>
                <Input
                  id="unit"
                  {...form.register("unit")}
                  placeholder="Ex: un, h, m²"
                  className="border-input bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-foreground">
                  Categoria
                </Label>
                <Input
                  id="category"
                  {...form.register("category")}
                  placeholder="Ex: Serviços"
                  className="border-input bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price" className="text-foreground">
                Preço (R$)
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min={0}
                {...form.register("price")}
                className="border-input bg-background"
              />
              {form.formState.errors.price && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.price.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Tabela de Itens ---
function ItemsTable({
  type,
  data,
  isLoading,
  onDelete,
}: {
  type: "product" | "service";
  data: Item[];
  isLoading: boolean;
  onDelete: (item: Item) => void;
}) {
  return (
    <div className="border border-border rounded-md bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-foreground">Nome</TableHead>
            <TableHead className="text-foreground">Categoria</TableHead>
            <TableHead className="text-foreground">Unidade</TableHead>
            <TableHead className="text-foreground">Preço</TableHead>
            <TableHead className="text-right text-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center py-10 text-muted-foreground"
              >
                Nenhum {type === "product" ? "produto" : "serviço"} encontrado.
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-foreground">
                  {item.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.category ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.unit ?? "—"}
                </TableCell>
                <TableCell className="text-foreground">
                  R$ {Number(item.price).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
