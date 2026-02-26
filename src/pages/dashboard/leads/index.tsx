import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PlusCircle,
  Pencil,
  Search,
  MoreHorizontal,
  UserCircle,
  Filter,
  Loader2,
  Trash2,
  Users,
  UserCheck,
} from "lucide-react";

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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";

// --- Interfaces ---
interface ProfileRow {
  company_id: string | null;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  external_id: string | null;
  status: "Novo" | "Em Contato" | "Qualificado" | "Perdido";
  classificacao: string | null;
  is_cliente?: boolean;
  seller_id?: string | null;
}

interface VendedorOption {
  id: string;
  nome: string;
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
const leadFormSchema = z.object({
  name: z.string().min(2, "O nome deve ter pelo menos 2 caracteres"),
  email: z.string().optional(),
  phone: z.string().optional(),
  external_id: z.string().optional(),
  status: z.enum(["Novo", "Em Contato", "Qualificado", "Perdido"]),
  classificacao: z.enum(["Frio", "Morno", "Quente"]).optional().nullable(),
  is_cliente: z.boolean().optional(),
  seller_id: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

const STATUS_OPTIONS = [
  { value: "Novo", label: "Novo" },
  { value: "Em Contato", label: "Em Contato" },
  { value: "Qualificado", label: "Qualificado" },
  { value: "Perdido", label: "Perdido" },
] as const;

const CLASSIFICACAO_OPTIONS = [
  { value: "none", label: "Não definido" },
  { value: "Frio", label: "Frio" },
  { value: "Morno", label: "Morno" },
  { value: "Quente", label: "Quente" },
] as const;

/** Normaliza classificacao do banco (case-insensitive) para o formato do Select (Frio/Morno/Quente). */
function normalizeClassificacao(
  value: string | null | undefined
): "Frio" | "Morno" | "Quente" | null {
  if (!value || typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  if (lower === "frio") return "Frio";
  if (lower === "morno") return "Morno";
  if (lower === "quente") return "Quente";
  return null;
}

export default function LeadsPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"leads" | "clientes">("leads");

  const effectiveCompanyId = companyId;

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      external_id: "",
      status: "Novo",
      classificacao: null,
      is_cliente: false,
      seller_id: "",
    },
  });

  const editForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      external_id: "",
      status: "Novo",
      classificacao: null,
      is_cliente: false,
      seller_id: "",
    },
  });

  // Buscar company_id
  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  // Buscar vendedores
  const loadVendedores = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("vendedores")
        .select("id, nome")
        .eq("company_id", effectiveCompanyId)
        .eq("status", true);

      if (error) throw error;
      setVendedores((data as VendedorOption[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar vendedores:", err);
    }
  }, [effectiveCompanyId, supabase]);

  // Buscar leads
  const loadLeads = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setLeads([]);
      return;
    }
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, phone, external_id, status, classificacao, is_cliente, seller_id")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads((data as Lead[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar leads:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar leads.",
      });
      setLeads([]);
    } finally {
      setIsFetching(false);
    }
  }, [effectiveCompanyId, supabase, toast]);

  useEffect(() => {
    loadVendedores();
  }, [loadVendedores]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Filtro por tab (leads vs clientes) e por nome/email
  const leadsByTab = leads.filter((l) =>
    activeTab === "leads" ? !(l.is_cliente ?? false) : (l.is_cliente ?? false)
  );
  const filteredLeads = searchQuery.trim()
    ? leadsByTab.filter(
        (l) =>
          l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (l.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : leadsByTab;

  const vendedorMap = useCallback(
    () => new Map(vendedores.map((v) => [v.id, v.nome])),
    [vendedores]
  );

  const getSellerName = (sellerId: string | null | undefined) => {
    if (!sellerId) return null;
    return vendedorMap().get(sellerId) ?? null;
  };

  // Status Badge Color Helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Novo":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100";
      case "Em Contato":
        return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
      case "Qualificado":
        return "bg-green-100 text-green-700 hover:bg-green-100";
      case "Perdido":
        return "bg-red-100 text-red-700 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Classificação Badge Color Helper (Frio, Morno, Quente)
  const getClassificacaoColor = (classificacao: string | null) => {
    switch (classificacao) {
      case "Frio":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100";
      case "Morno":
        return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
      case "Quente":
        return "bg-red-100 text-red-700 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Create
  async function onSubmit(values: LeadFormValues) {
    if (!effectiveCompanyId || !userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("leads").insert({
        company_id: effectiveCompanyId,
        user_id: userId,
        name: values.name.trim(),
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        external_id: values.external_id?.trim() || null,
        seller_id: values.seller_id || null,
        status: values.status,
        classificacao: values.classificacao || null,
      });

      if (error) throw error;

      toast({
        title: "Lead criado",
        description: `${values.name} foi cadastrado com sucesso.`,
      });
      setIsDialogOpen(false);
      form.reset({
        name: "",
        email: "",
        phone: "",
        external_id: "",
        status: "Novo",
        classificacao: null,
        seller_id: "",
      });
      loadLeads();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : (err && typeof err === "object" && "message" in err)
            ? String((err as { message: unknown }).message)
            : "Erro desconhecido";
      console.error("Erro ao criar lead:", err);
      toast({
        variant: "destructive",
        title: "Erro ao criar",
        description: msg,
      });
    } finally {
      setIsSaving(false);
    }
  }

  // Update
  function handleEditClick(lead: Lead) {
    setEditingLead(lead);
    const normalizedClassificacao = normalizeClassificacao(lead.classificacao);
    // Status "Cliente" é legado (pré-migration); tratar como Qualificado
    const normalizedStatus =
      lead.status === "Cliente" ? "Qualificado" : lead.status;
    editForm.reset({
      name: lead.name,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      external_id: lead.external_id ?? "",
      status: normalizedStatus,
      classificacao: normalizedClassificacao,
      is_cliente: lead.is_cliente ?? false,
      seller_id: lead.seller_id ?? "",
    });
    setIsEditDialogOpen(true);
  }

  async function onEditSubmit(values: LeadFormValues) {
    if (!editingLead || !effectiveCompanyId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          name: values.name.trim(),
          email: values.email?.trim() || null,
          phone: values.phone?.trim() || null,
          external_id: values.external_id?.trim() || null,
          seller_id: values.seller_id || null,
          status: values.status,
          classificacao: values.classificacao || null,
          is_cliente: values.is_cliente ?? false,
        })
        .eq("id", editingLead.id)
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;

      toast({
        title: "Lead atualizado",
        description: "As alterações foram salvas.",
      });
      setIsEditDialogOpen(false);
      setEditingLead(null);
      loadLeads();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsSaving(false);
    }
  }

  // Delete
  async function handleDelete(lead: Lead) {
    const confirmed = window.confirm(
      `Excluir o lead "${lead.name}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed || !effectiveCompanyId) return;

    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", lead.id)
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;

      toast({
        title: "Lead excluído",
        description: "O lead foi removido.",
      });
      loadLeads();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {activeTab === "leads" ? "Leads" : "Clientes"}
          </h2>
          <p className="text-muted-foreground">
            {activeTab === "leads"
              ? "Leads em tratamento. Atribua vendedores e acompanhe o pipeline."
              : "Clientes convertidos. Ações de pós-venda e comunicação."}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Lead</DialogTitle>
              <DialogDescription>
                Preencha as informações básicas para iniciar o rastreio do lead.
              </DialogDescription>
            </DialogHeader>

            <form
              className="grid gap-4 py-4"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    placeholder="Ex: João Silva"
                    {...form.register("name")}
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="external_id">External ID</Label>
                  <Input
                    id="external_id"
                    placeholder="ID do CRM"
                    {...form.register("external_id")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    {...form.register("email")}
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    {...form.register("phone")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Classificação</Label>
                  <Select
                    value={form.watch("classificacao") ?? "none"}
                    onValueChange={(v: string) =>
                      form.setValue("classificacao", v === "none" ? null : (v as "Frio" | "Morno" | "Quente"))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSIFICACAO_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status Inicial</Label>
                  <Select
                    value={form.watch("status")}
                    onValueChange={(v: string) =>
                      form.setValue("status", v as LeadFormValues["status"])
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
                      {vendedores.map((vendedor) => (
                        <SelectItem key={vendedor.id} value={vendedor.id}>
                          {vendedor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Lead"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "leads" | "clientes")} className="w-full">
        <div className="flex items-center justify-between gap-4">
          <TabsList className="grid w-full max-w-[300px] grid-cols-2">
            <TabsTrigger value="leads" className="gap-2">
              <Users className="h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-2">
              <UserCheck className="h-4 w-4" />
              Clientes
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2 shrink-0">
              <Filter className="h-4 w-4" /> Filtros
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-white mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {searchQuery
                    ? "Nenhum lead encontrado para a busca."
                    : "Nenhum lead encontrado. Use o botão acima para cadastrar."}
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium text-gray-900">
                    {lead.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.email ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.phone ?? "-"}
                  </TableCell>
                  <TableCell>
                    {lead.classificacao ? (
                      <Badge className={getClassificacaoColor(lead.classificacao)}>
                        {lead.classificacao}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-500">
                    {lead.external_id || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {getSellerName(lead.seller_id) ? (
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-4 w-4 text-gray-400" />
                        <span>{getSellerName(lead.seller_id)}</span>
                      </div>
                    ) : (
                      <span className="text-orange-500 font-medium text-xs">
                        Aguardando...
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(lead.status)}>
                        {lead.status === "Cliente" ? "Qualificado" : lead.status}
                      </Badge>
                      {(lead.is_cliente ?? false) && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Cliente
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => handleEditClick(lead)}
                        >
                          <Pencil className="h-4 w-4" /> Editar Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-red-600"
                          onClick={() => handleDelete(lead)}
                        >
                          <Trash2 className="h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </Tabs>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>
              Altere as informações do lead conforme necessário.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4 py-4"
            onSubmit={editForm.handleSubmit(onEditSubmit)}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input
                  id="edit-name"
                  placeholder="Ex: João Silva"
                  {...editForm.register("name")}
                />
                {editForm.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-external_id">External ID</Label>
                <Input
                  id="edit-external_id"
                  placeholder="ID do CRM"
                  {...editForm.register("external_id")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  {...editForm.register("email")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  placeholder="(00) 00000-0000"
                  {...editForm.register("phone")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Classificação</Label>
                <Select
                  value={editForm.watch("classificacao") ?? "none"}
                  onValueChange={(v: string) =>
                    editForm.setValue("classificacao", v === "none" ? null : (v as "Frio" | "Morno" | "Quente"))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICACAO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.watch("status")}
                  onValueChange={(v: string) =>
                    editForm.setValue(
                      "status",
                      v as LeadFormValues["status"]
                    )
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
                <Label>Vendedor</Label>
                <Select
                  value={editForm.watch("seller_id") || "none"}
                  onValueChange={(v: string) =>
                    editForm.setValue("seller_id", v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {vendedores.map((vendedor) => (
                      <SelectItem key={vendedor.id} value={vendedor.id}>
                        {vendedor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-is_cliente"
                  checked={editForm.watch("is_cliente") ?? false}
                  onCheckedChange={(checked) =>
                    editForm.setValue("is_cliente", checked)
                  }
                />
                <Label htmlFor="edit-is_cliente" className="cursor-pointer">
                  Marcar como cliente (convertido)
                </Label>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
