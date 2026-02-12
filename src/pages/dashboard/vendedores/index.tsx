import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import { Plus, Edit2, Loader2, Mail } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { useSupabaseClient } from "@/lib/supabase-context";
import { SUPABASE_URL } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Dia da semana: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb (Date.getDay()) */
const DIAS_SEMANA = [
  { id: 0, label: "Domingo" },
  { id: 1, label: "Segunda" },
  { id: 2, label: "Terça" },
  { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" },
  { id: 5, label: "Sexta" },
  { id: 6, label: "Sábado" },
] as const;

interface VendedorRow {
  id: string;
  email: string;
  company_id: string;
  nome: string;
  celular: string | null;
  status: boolean | null;
  clerk_id: string | null;
}

interface HorarioRow {
  vendedor_email: string;
  dia_semana: number;
  entrada: string | null;
  saida: string | null;
  almoco_inicio: string | null;
  almoco_fim: string | null;
}

interface ProfileRow {
  company_id: string | null;
}

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

function timeToInput(value: string | null): string {
  if (!value) return "";
  const [h, m] = value.split(":");
  return `${h ?? "00"}:${m ?? "00"}`;
}

export default function VendedoresPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const supabase = useSupabaseClient();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [horarios, setHorarios] = useState<Record<string, HorarioRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    celular: "",
    status: true,
    sendInvite: false,
  });
  const [formDiasAtivos, setFormDiasAtivos] = useState<Record<number, boolean>>(
    Object.fromEntries(DIAS_SEMANA.map((d) => [d.id, d.id >= 1 && d.id <= 5]))
  );
  const [formHorarios, setFormHorarios] = useState<
    Record<number, { entrada: string; saida: string }>
  >(
    Object.fromEntries(
      DIAS_SEMANA.map((d) => [d.id, { entrada: "08:00", saida: "18:00" }])
    )
  );

  const loadCompanyAndData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const cid = await fetchCompanyId(supabase, user.id);
      setCompanyId(cid);
      if (!cid) {
        setVendedores([]);
        setHorarios({});
        return;
      }

      const { data: vendData, error: vendErr } = await supabase
        .from("vendedores")
        .select("id, email, company_id, nome, celular, status, clerk_id")
        .eq("company_id", cid)
        .order("nome");

      if (vendErr) {
        console.error("Erro ao carregar vendedores:", vendErr);
        setVendedores([]);
        return;
      }
      setVendedores((vendData as VendedorRow[]) ?? []);

      const emails = (vendData as VendedorRow[]).map((v) => v.email);
      if (emails.length === 0) {
        setHorarios({});
        return;
      }

      const { data: horData, error: horErr } = await supabase
        .from("horarios_vendedor")
        .select("vendedor_email, dia_semana, entrada, saida")
        .eq("company_id", cid)
        .in("vendedor_email", emails);

      if (horErr) {
        console.error("Erro ao carregar horários:", horErr);
        setHorarios({});
        return;
      }

      const byEmail: Record<string, HorarioRow[]> = {};
      for (const h of horData as HorarioRow[]) {
        const key = h.vendedor_email;
        if (!byEmail[key]) byEmail[key] = [];
        byEmail[key].push({
          vendedor_email: h.vendedor_email,
          dia_semana: h.dia_semana,
          entrada: h.entrada,
          saida: h.saida,
          almoco_inicio: null,
          almoco_fim: null,
        });
      }
      setHorarios(byEmail);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => {
    loadCompanyAndData();
  }, [loadCompanyAndData]);

  const openNew = () => {
    setEditingEmail(null);
    setInviteError(null);
    setSaveError(null);
    setForm({ nome: "", email: "", celular: "", status: true, sendInvite: false });
    setFormDiasAtivos(
      Object.fromEntries(DIAS_SEMANA.map((d) => [d.id, d.id >= 1 && d.id <= 5]))
    );
    setFormHorarios(
      Object.fromEntries(
        DIAS_SEMANA.map((d) => [d.id, { entrada: "08:00", saida: "18:00" }])
      )
    );
    setIsModalOpen(true);
  };

  const openEdit = (v: VendedorRow) => {
    setEditingEmail(v.email);
    setInviteError(null);
    setSaveError(null);
    setForm({
      nome: v.nome ?? "",
      email: v.email,
      celular: v.celular ?? "",
      status: v.status ?? true,
      sendInvite: false,
    });
    const hrs = horarios[v.email] ?? [];
    const nextAtivos: Record<number, boolean> = {};
    const nextHorarios: Record<number, { entrada: string; saida: string }> = {};
    for (const d of DIAS_SEMANA) {
      const h = hrs.find((x) => x.dia_semana === d.id);
      nextAtivos[d.id] = !!h;
      nextHorarios[d.id] = {
        entrada: timeToInput(h?.entrada ?? null) || "08:00",
        saida: timeToInput(h?.saida ?? null) || "18:00",
      };
    }
    setFormDiasAtivos(nextAtivos);
    setFormHorarios(nextHorarios);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) return;
    const email = form.email.trim().toLowerCase();
    if (!email) return;

    setSaveError(null);
    setSaving(true);
    try {
      const { error: vendErr } = await supabase.from("vendedores").upsert(
        {
          email,
          company_id: companyId,
          nome: form.nome.trim() || null,
          celular: form.celular.trim() || null,
          status: form.status,
        },
        { onConflict: "email" }
      );

      if (vendErr) {
        setSaveError(vendErr.message ?? "Erro ao salvar vendedor.");
        return;
      }

      for (const d of DIAS_SEMANA) {
        const ativo = formDiasAtivos[d.id];
        const h = formHorarios[d.id];
        if (ativo && h) {
          const { error: horErr } = await supabase.from("horarios_vendedor").upsert(
            {
              vendedor_email: email,
              company_id: companyId,
              dia_semana: d.id,
              entrada: h.entrada || null,
              saida: h.saida || null,
            },
            { onConflict: "vendedor_email,dia_semana" }
          );
          if (horErr) {
            setSaveError(horErr.message ?? "Erro ao salvar horário.");
            return;
          }
        } else {
          const { error: delErr } = await supabase
            .from("horarios_vendedor")
            .delete()
            .eq("vendedor_email", email)
            .eq("company_id", companyId)
            .eq("dia_semana", d.id);
          if (delErr) {
            setSaveError(delErr.message ?? "Erro ao remover horário.");
            return;
          }
        }
      }

      await loadCompanyAndData();

      if (!editingEmail && form.sendInvite && email) {
        setInviteError(null);
        setInviteSuccess(null);
        try {
          const token = await getToken();
          if (!token) {
            setInviteError("Sessão expirada. Faça login novamente.");
            return;
          }
          const url = `${SUPABASE_URL}/functions/v1/clerk-invite-vendedor`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ email }),
          });
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            setInviteError(data?.error ?? "Erro ao enviar convite. Tente novamente.");
            setIsModalOpen(false);
            return;
          }
          if (data?.error) {
            setInviteError(data.error);
            setIsModalOpen(false);
            return;
          }
          setInviteSuccess(`Vendedor cadastrado. Convite enviado para ${email}.`);
          setTimeout(() => setInviteSuccess(null), 5000);
          await loadCompanyAndData();
        } catch {
          setInviteError("Erro ao enviar convite. Tente novamente.");
          setIsModalOpen(false);
          return;
        }
      } else {
        setInviteSuccess(editingEmail ? "Vendedor atualizado com sucesso." : "Vendedor cadastrado com sucesso.");
        setTimeout(() => setInviteSuccess(null), 5000);
      }

      setInviteError(null);
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (v: VendedorRow) => {
    setInviteError(null);
    setInviteSuccess(null);
    setInvitingEmail(v.email);
    try {
      const token = await getToken();
      if (!token) {
        setInviteError("Sessão expirada. Faça login novamente.");
        return;
      }
      const url = `${SUPABASE_URL}/functions/v1/clerk-invite-vendedor`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: v.email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setInviteError(data?.error ?? "Erro ao enviar convite. Tente novamente.");
        return;
      }
      if (data?.error) {
        setInviteError(data.error);
        return;
      }
      setInviteSuccess(`Convite enviado com sucesso para ${v.email}. O vendedor receberá um e-mail.`);
      await loadCompanyAndData();
      setTimeout(() => setInviteSuccess(null), 5000);
    } catch {
      setInviteError("Erro ao enviar convite. Tente novamente.");
    } finally {
      setInvitingEmail(null);
    }
  };

  if (loading && !companyId) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Vendedores</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">Carregando vendedores…</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Vendedores</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
    <div className="space-y-6">
          {inviteError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {inviteError}
            </div>
          )}
          {inviteSuccess && (
            <div className="rounded-md border border-primary/50 bg-primary/10 px-4 py-3 text-sm text-foreground">
              {inviteSuccess}
            </div>
          )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Equipe de Vendedores
          </h1>
          <p className="text-muted-foreground">
            Cadastre e gerencie os horários da sua equipe.
          </p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Novo Vendedor
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum vendedor cadastrado. Clique em &quot;Novo Vendedor&quot; para começar.
                </TableCell>
              </TableRow>
            ) : (
              vendedores.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium text-foreground">{v.nome || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.email}</TableCell>
                  <TableCell className="text-muted-foreground">{v.celular || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={v.status ? "default" : "secondary"}
                      className={
                        v.status
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {v.status ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {!v.clerk_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleInvite(v)}
                          disabled={!!invitingEmail}
                          aria-label={`Convidar ${v.nome ?? v.email}`}
                          title="Enviar convite por e-mail"
                        >
                          {invitingEmail === v.email ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(v)}
                        aria-label={`Editar ${v.nome ?? v.email}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) setSaveError(null);
          setIsModalOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEmail ? "Editar Vendedor" : "Novo Vendedor"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados e configure os dias e horários de trabalho.
            </DialogDescription>
          </DialogHeader>

          {saveError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="vendedor@empresa.com"
                disabled={!!editingEmail}
              />
              {editingEmail && (
                <p className="text-xs text-muted-foreground">
                  E-mail não pode ser alterado (âncora do registro).
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="celular">Celular</Label>
              <Input
                id="celular"
                value={form.celular}
                onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="status"
                checked={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="status">Ativo</Label>
            </div>
            {!editingEmail && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendInvite"
                  checked={form.sendInvite}
                  onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="sendInvite">Enviar convite por e-mail ao salvar</Label>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-sm font-medium text-foreground">
                Dias e horários de trabalho
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                Ative o slide para os dias em que o vendedor trabalha.
              </p>
              <div className="space-y-3">
                {DIAS_SEMANA.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center gap-2 sm:gap-4"
                  >
                    <div className="flex w-24 items-center justify-between gap-2 sm:w-28">
                      <span className="text-sm text-foreground">{d.label}</span>
                      <Switch
                        checked={formDiasAtivos[d.id] ?? false}
                        onCheckedChange={(checked) =>
                          setFormDiasAtivos((prev) => ({ ...prev, [d.id]: checked }))
                        }
                        aria-label={`Trabalha ${d.label}`}
                      />
                    </div>
                    {formDiasAtivos[d.id] && (
                      <>
                        <Input
                          type="time"
                          value={formHorarios[d.id]?.entrada ?? ""}
                          onChange={(e) =>
                            setFormHorarios((prev) => ({
                              ...prev,
                              [d.id]: {
                                ...prev[d.id],
                                entrada: e.target.value,
                              },
                            }))
                          }
                          className="w-28"
                        />
                        <span className="text-muted-foreground"> até </span>
                        <Input
                          type="time"
                          value={formHorarios[d.id]?.saida ?? ""}
                          onChange={(e) =>
                            setFormHorarios((prev) => ({
                              ...prev,
                              [d.id]: {
                                ...prev[d.id],
                                saida: e.target.value,
                              },
                            }))
                          }
                          className="w-28"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando…
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
