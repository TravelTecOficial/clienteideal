import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";

import { Link } from "react-router-dom";
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
  Upload,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { LeadImportModal } from "./LeadImportModal";

// --- Interfaces ---
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
  data_nascimento?: string | null;
  idade?: number | null;
  cep?: string | null;
  item_id?: string | null;
  items?: { name: string } | null;
  conversao?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  utm_id?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
}

interface VendedorOption {
  id: string;
  nome: string;
}

export default function LeadsPage() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const effectiveCompanyId = useEffectiveCompanyId();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [vendedores, setVendedores] = useState<VendedorOption[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"leads" | "clientes">("leads");
  const [importModalOpen, setImportModalOpen] = useState(false);

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
        .select("id, name, email, phone, external_id, status, classificacao, is_cliente, seller_id, data_nascimento, idade, cep, item_id, conversao, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, fbclid, gclid, items(name)")
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
          (l.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
          (l.cep?.includes(searchQuery.replace(/\D/g, "")) ?? false) ||
          (l.conversao?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
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

        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportModalOpen(true)}>
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button className="gap-2" asChild>
            <Link to="/dashboard/leads/novo">
              <PlusCircle className="h-4 w-4" />
              Novo Lead
            </Link>
          </Button>
        </div>
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
              <TableHead>Idade</TableHead>
              <TableHead>CEP</TableHead>
              <TableHead>Ramo / Conversão</TableHead>
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
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
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
                  <TableCell className="text-sm">
                    {lead.idade != null ? lead.idade : "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {lead.cep ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.conversao ?? lead.items?.name ?? "-"}
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
                        <DropdownMenuItem asChild>
                          <Link
                            to={`/dashboard/leads/${lead.id}`}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" /> Editar Lead
                          </Link>
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

      <LeadImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        companyId={effectiveCompanyId}
        onSuccess={loadLeads}
      />
    </div>
  );
}
