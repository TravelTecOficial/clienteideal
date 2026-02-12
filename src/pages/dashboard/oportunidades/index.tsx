import { useState, useEffect, useCallback } from "react";
import { useAuth, useOrganization } from "@clerk/clerk-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LayoutGrid,
  List,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  User,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
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

import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";

import {
  OpportunityForm,
  type OpportunityFormValues,
  type ProfileOption,
  type IdealCustomerOption,
  type ProductOption,
} from "./opportunity-form";

type OpportunityStage =
  | "novo"
  | "qualificacao"
  | "negociacao"
  | "proposta"
  | "ganho"
  | "perdido";

interface Opportunity {
  id: string;
  title: string;
  value: number;
  expected_closing_date: string | null;
  stage: OpportunityStage;
  seller_id: string | null;
  product_id: string | null;
  ideal_customer_id: string | null;
  ideal_customers?: { profile_name: string | null } | null;
}

interface ProfileRow {
  company_id: string | null;
}

const STAGES: { id: OpportunityStage; label: string }[] = [
  { id: "novo", label: "Novo" },
  { id: "qualificacao", label: "Em fase de qualificação" },
  { id: "negociacao", label: "Em negociação" },
  { id: "proposta", label: "Proposta" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
];

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function KanbanCardContent({
  opportunity,
  sellerName,
  onEdit,
  onDelete,
}: {
  opportunity: Opportunity;
  sellerName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <h3 className="font-bold text-slate-800 text-sm">{opportunity.title}</h3>
      <p className="text-blue-600 font-bold text-xs mt-1">
        {formatCurrency(opportunity.value)}
      </p>
      <div className="mt-4 space-y-2">
        {sellerName && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <User className="size-3" />
            <Badge variant="secondary" className="text-[9px] font-normal py-0">
              Vendedor: {sellerName}
            </Badge>
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <Calendar className="size-3" />
          <span>Prev: {formatDate(opportunity.expected_closing_date)}</span>
        </div>
      </div>
      <div
        className="mt-3 pt-3 border-t flex justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="link"
              className="text-[10px] h-auto p-0 text-blue-500"
              onClick={(e) => e.stopPropagation()}
            >
              Escolha uma ação
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit()}>
              <Pencil className="h-3 w-3 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => onDelete()}
            >
              <Trash2 className="h-3 w-3 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function DroppableColumn({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 bg-slate-50/50 rounded-xl p-2 space-y-3 border-t-2 min-h-[200px] transition-all ${
        isOver ? "border-blue-400 bg-blue-50/50" : "border-transparent hover:border-slate-200"
      }`}
    >
      {children}
    </div>
  );
}

function DraggableKanbanCard({
  opportunity,
  sellerName,
  onEdit,
  onDelete,
}: {
  opportunity: Opportunity;
  sellerName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: opportunity.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
      onClick={onEdit}
    >
      <KanbanCardContent
        opportunity={opportunity}
        sellerName={sellerName}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

export default function OportunidadesPage() {
  const { userId } = useAuth();
  const { organization } = useOrganization();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [idealCustomers, setIdealCustomers] = useState<IdealCustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const effectiveCompanyId = companyId ?? organization?.id ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    async function init() {
      if (!userId) return;
      const cid = await fetchCompanyId(supabase, userId);
      setCompanyId(cid);
    }
    init();
  }, [userId, supabase]);

  const loadProfiles = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;
      setProfiles((data as ProfileOption[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar perfis:", err);
    }
  }, [effectiveCompanyId, supabase]);

  const loadIdealCustomers = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("ideal_customers")
        .select("id, profile_name")
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;
      setIdealCustomers((data as IdealCustomerOption[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar clientes ideais:", err);
    }
  }, [effectiveCompanyId, supabase]);

  const loadProducts = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const { data, error } = await supabase
        .from("items")
        .select("id, name")
        .eq("company_id", effectiveCompanyId)
        .eq("type", "product");

      if (error) throw error;
      setProducts(
        (data ?? []).map((r: { id: string; name: string }) => ({
          id: r.id,
          name: r.name ?? "",
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    }
  }, [effectiveCompanyId, supabase]);

  const loadOpportunities = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setOpportunities([]);
      return;
    }
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, title, value, expected_closing_date, stage, seller_id, product_id, ideal_customer_id, ideal_customers(profile_name)")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOpportunities((data as Opportunity[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar oportunidades:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar oportunidades.",
      });
      setOpportunities([]);
    } finally {
      setIsFetching(false);
    }
  }, [effectiveCompanyId, supabase, toast]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);
  useEffect(() => {
    loadIdealCustomers();
  }, [loadIdealCustomers]);
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const profileMap = useCallback(
    () => new Map(profiles.map((p) => [p.id, p.full_name ?? ""])),
    [profiles]
  );
  const productMap = useCallback(
    () => new Map(products.map((p) => [p.id, p.name])),
    [products]
  );

  const getSellerName = (sellerId: string | null | undefined) =>
    sellerId ? profileMap().get(sellerId) ?? null : null;
  const getProductName = (productId: string | null | undefined) =>
    productId ? productMap().get(productId) ?? null : null;

  const filteredOpportunities = searchTerm.trim()
    ? opportunities.filter((o) =>
        o.title.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : opportunities;

  const opportunitiesByStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage.id] = filteredOpportunities.filter((o) => o.stage === stage.id);
      return acc;
    },
    {} as Record<OpportunityStage, Opportunity[]>
  );

  const stageSums = STAGES.reduce(
    (acc, stage) => {
      acc[stage.id] = opportunitiesByStage[stage.id].reduce(
        (sum, o) => sum + Number(o.value ?? 0),
        0
      );
      return acc;
    },
    {} as Record<OpportunityStage, number>
  );

  const openCount = opportunities.filter(
    (o) => !["ganho", "perdido"].includes(o.stage)
  ).length;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || !effectiveCompanyId) return;

    const oppId = String(active.id);
    let targetStage: OpportunityStage | null = null;

    if (STAGES.some((s) => s.id === over.id)) {
      targetStage = over.id as OpportunityStage;
    } else {
      const opp = opportunities.find((o) => o.id === over.id);
      if (opp) targetStage = opp.stage;
    }

    if (!targetStage) return;

    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp || opp.stage === targetStage) return;

    try {
      const { error } = await supabase
        .from("opportunities")
        .update({ stage: targetStage })
        .eq("id", oppId)
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;
      setOpportunities((prev) =>
        prev.map((o) => (o.id === oppId ? { ...o, stage: targetStage! } : o))
      );
      toast({ title: "Estágio atualizado", description: "A oportunidade foi movida." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao mover.",
      });
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function onSubmitCreate(values: OpportunityFormValues) {
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
      const { error } = await supabase.from("opportunities").insert({
        company_id: effectiveCompanyId,
        user_id: userId,
        title: values.title.trim(),
        value: Number(values.value) || 0,
        expected_closing_date: values.expected_closing_date || null,
        stage: values.stage,
        ideal_customer_id: values.ideal_customer_id || null,
        product_id: values.product_id || null,
        seller_id: values.seller_id || null,
      });

      if (error) throw error;
      toast({
        title: "Oportunidade criada",
        description: `${values.title} foi cadastrada com sucesso.`,
      });
      setIsCreateDialogOpen(false);
      loadOpportunities();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao criar",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditClick(opp: Opportunity) {
    setEditingOpportunity(opp);
    setIsEditDialogOpen(true);
  }

  async function onSubmitEdit(values: OpportunityFormValues) {
    if (!editingOpportunity || !effectiveCompanyId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("opportunities")
        .update({
          title: values.title.trim(),
          value: Number(values.value) || 0,
          expected_closing_date: values.expected_closing_date || null,
          stage: values.stage,
          ideal_customer_id: values.ideal_customer_id || null,
          product_id: values.product_id || null,
          seller_id: values.seller_id || null,
        })
        .eq("id", editingOpportunity.id)
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;
      toast({
        title: "Oportunidade atualizada",
        description: "As alterações foram salvas.",
      });
      setIsEditDialogOpen(false);
      setEditingOpportunity(null);
      loadOpportunities();
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

  async function handleDelete(opp: Opportunity) {
    const confirmed = window.confirm(
      `Excluir a oportunidade "${opp.title}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed || !effectiveCompanyId) return;
    try {
      const { error } = await supabase
        .from("opportunities")
        .delete()
        .eq("id", opp.id)
        .eq("company_id", effectiveCompanyId);

      if (error) throw error;
      toast({ title: "Oportunidade excluída", description: "A oportunidade foi removida." });
      loadOpportunities();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  const activeOpp = activeId ? opportunities.find((o) => o.id === activeId) : null;

  return (
    <div className="flex flex-col h-screen bg-[#f9fafb] p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline de oportunidades</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-2 w-48 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{
                  width: `${Math.min(100, (openCount / Math.max(opportunities.length, 1)) * 100)}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {openCount}/{opportunities.length} oportunidades em aberto
            </span>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg px-4">
              Criar uma oportunidade
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nova Oportunidade</DialogTitle>
              <DialogDescription>
                Preencha as informações básicas da oportunidade.
              </DialogDescription>
            </DialogHeader>
            <OpportunityForm
              onSubmit={onSubmitCreate}
              isSaving={isSaving}
              onCancel={() => setIsCreateDialogOpen(false)}
              profiles={profiles}
              idealCustomers={idealCustomers}
              products={products}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-between items-center bg-white p-2 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 border-r pr-4 mr-4">
          <Button
            variant={viewMode === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("kanban")}
            className="gap-2"
          >
            <LayoutGrid className="size-4" /> Cartões
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-2"
          >
            <List className="size-4" /> Lista
          </Button>
        </div>
        <div className="flex-1 flex items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome da oportunidade"
              className="pl-8 bg-slate-50 border-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="size-4" /> Filtrar
          </Button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
        >
          <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
            {STAGES.map((stage) => {
              const opps = opportunitiesByStage[stage.id];
              const sum = stageSums[stage.id];
              const stageLabelClass =
                stage.id === "ganho"
                  ? "font-bold text-sm text-success"
                  : stage.id === "perdido"
                    ? "font-bold text-sm text-destructive"
                    : "font-bold text-sm text-slate-700";
              return (
                <div
                  key={stage.id}
                  className="min-w-0 flex-1 flex flex-col gap-3"
                >
                  <div className="flex flex-col px-2">
                    <div className="flex justify-between items-center">
                      <span className={stageLabelClass}>
                        {stage.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {opps.length}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="text-[11px] text-muted-foreground uppercase">
                        Receita estimada
                      </span>
                      <p className="text-sm font-bold">{formatCurrency(sum)}</p>
                    </div>
                  </div>

                  <DroppableColumn id={stage.id}>
                    {opps.map((opp) => (
                      <DraggableKanbanCard
                        key={opp.id}
                        opportunity={opp}
                        sellerName={getSellerName(opp.seller_id)}
                        onEdit={() => handleEditClick(opp)}
                        onDelete={() => handleDelete(opp)}
                      />
                    ))}
                  </DroppableColumn>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeOpp ? (
              <div className="bg-white p-4 rounded-xl border shadow-lg w-[180px]">
                <h3 className="font-bold text-slate-800 text-sm">
                  {activeOpp.title}
                </h3>
                <p className="text-blue-600 font-bold text-xs mt-1">
                  {formatCurrency(activeOpp.value)}
                </p>
                <div className="mt-2 text-[10px] text-slate-500">
                  {getSellerName(activeOpp.seller_id) && (
                    <span>Vendedor: {getSellerName(activeOpp.seller_id)}</span>
                  )}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 min-h-0 overflow-auto">
          {isFetching ? (
            <div className="p-8 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Carregando...</span>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm
                ? "Nenhuma oportunidade encontrada para a busca."
                : "Nenhuma oportunidade. Use o botão acima para criar."}
            </div>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%] min-w-[120px]">Título</TableHead>
                  <TableHead className="w-[12%] min-w-[80px]">Valor</TableHead>
                  <TableHead className="w-[14%] min-w-[100px]">Estágio</TableHead>
                  <TableHead className="w-[14%] min-w-[80px]">Vendedor</TableHead>
                  <TableHead className="w-[14%] min-w-[80px]">Produto</TableHead>
                  <TableHead className="w-[14%] min-w-[80px]">Cliente Ideal</TableHead>
                  <TableHead className="w-[10%] min-w-[70px]">Data Prevista</TableHead>
                  <TableHead className="w-[7%] min-w-[60px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOpportunities.map((opp) => (
                  <TableRow key={opp.id}>
                    <TableCell className="font-medium">{opp.title}</TableCell>
                    <TableCell>{formatCurrency(opp.value)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          opp.stage === "ganho"
                            ? "text-success bg-success/10"
                            : opp.stage === "perdido"
                              ? "text-destructive bg-destructive/10"
                              : ""
                        }
                      >
                        {STAGES.find((s) => s.id === opp.stage)?.label ?? opp.stage}
                      </Badge>
                    </TableCell>
                    <TableCell>{getSellerName(opp.seller_id) ?? "-"}</TableCell>
                    <TableCell>{getProductName(opp.product_id) ?? "-"}</TableCell>
                    <TableCell>
                      {opp.ideal_customers?.profile_name ?? "-"}
                    </TableCell>
                    <TableCell>{formatDate(opp.expected_closing_date)}</TableCell>
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
                            onClick={() => handleEditClick(opp)}
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-red-600"
                            onClick={() => handleDelete(opp)}
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Oportunidade</DialogTitle>
            <DialogDescription>
              Altere as informações da oportunidade conforme necessário.
            </DialogDescription>
          </DialogHeader>
          {editingOpportunity && (
            <OpportunityForm
              key={editingOpportunity.id}
              onSubmit={onSubmitEdit}
              defaultValues={{
                title: editingOpportunity.title,
                value: editingOpportunity.value,
                expected_closing_date:
                  editingOpportunity.expected_closing_date ?? "",
                stage: editingOpportunity.stage,
                ideal_customer_id: editingOpportunity.ideal_customer_id ?? "",
                product_id: editingOpportunity.product_id ?? "",
                seller_id: editingOpportunity.seller_id ?? "",
              }}
              isEditing
              isSaving={isSaving}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setEditingOpportunity(null);
              }}
              profiles={profiles}
              idealCustomers={idealCustomers}
              products={products}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
