import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PlusCircle,
  FileText,
  Trash2,
  UploadCloud,
  MoreHorizontal,
  ExternalLink,
  Loader2,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useToast } from "@/hooks/use-toast";

// --- Interfaces ---
interface KbFile {
  id: string;
  file_name: string;
  training_type: string;
  created_at: string;
  drive_file_id: string | null;
  description: string | null;
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

const TRAINING_TYPE_OPTIONS = [
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
  { value: "institucional", label: "Institucional" },
  { value: "outro", label: "Outro (Descritivo)" },
] as const;

function getTrainingTypeLabel(value: string): string {
  const opt = TRAINING_TYPE_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}

export default function BaseConhecimento() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { toast } = useToast();

  const [files, setFiles] = useState<KbFile[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [trainingType, setTrainingType] = useState<string>("");
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveCompanyId = companyId;

  const loadFiles = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsFetching(false);
      setFiles([]);
      return;
    }
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("kb_files_control")
        .select("id, file_name, training_type, created_at, drive_file_id, description")
        .eq("company_id", effectiveCompanyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles((data as KbFile[]) ?? []);
    } catch (err) {
      console.error("Erro ao carregar ficheiros:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar a base de conhecimento.",
      });
      setFiles([]);
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
    loadFiles();
  }, [loadFiles]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveCompanyId || !userId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Usuário ou empresa não identificados.",
      });
      return;
    }

    if (!trainingType.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione o tipo de treino.",
      });
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um ficheiro para carregar.",
      });
      return;
    }

    const file_name = file.name;
    const drive_file_id = `drive_${crypto.randomUUID()}`;

    setLoading(true);
    try {
      const { error } = await supabase.from("kb_files_control").insert({
        company_id: effectiveCompanyId,
        user_id: userId,
        file_name,
        training_type: trainingType,
        description: description.trim() || null,
        drive_file_id,
      });

      if (error) throw error;

      toast({
        title: "Documento carregado",
        description: `${file_name} foi adicionado com sucesso.`,
      });
      setIsDialogOpen(false);
      setTrainingType("");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadFiles();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar",
        description: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (file: KbFile) => {
    const confirmed = window.confirm(
      `Excluir "${file.file_name}"? Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("kb_files_control")
        .delete()
        .eq("id", file.id);

      if (error) throw error;

      toast({
        title: "Documento excluído",
        description: `${file.file_name} foi removido.`,
      });
      loadFiles();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setTrainingType("");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Base de Conhecimento</h2>
          <p className="text-muted-foreground">
            Faça a gestão dos ficheiros utilizados para o treino da IA (RAG).
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:opacity-90">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Documento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleUpload}>
              <DialogHeader>
                <DialogTitle>Carregar Documento</DialogTitle>
                <DialogDescription>
                  O ficheiro será enviado para o Google Drive e processado pela IA.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo de Treino</Label>
                  <Select
                    required
                    value={trainingType}
                    onValueChange={setTrainingType}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Selecione o tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAINING_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    placeholder="Ex: Manual Técnico 2024"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Ficheiro</Label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300 transition">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 mb-3 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Clique para upload</span> ou arraste
                        </p>
                        <p className="text-xs text-gray-400">
                          PDF, DOCX ou TXT (Máx 10MB)
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.txt"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Iniciar Upload
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabela de Listagem */}
      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold text-black">Nome do Arquivo</TableHead>
              <TableHead className="font-bold text-black">Tipo de Treino</TableHead>
              <TableHead className="font-bold text-black">Data de Envio</TableHead>
              <TableHead className="text-right font-bold text-black">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isFetching ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>A carregar...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : files.length > 0 ? (
              files.map((file) => (
                <TableRow key={file.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      {file.file_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {getTrainingTypeLabel(file.training_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(file.created_at).toLocaleDateString("pt-PT")}
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
                          className="cursor-pointer"
                          disabled
                          title="Integração com Google Drive em breve"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" /> Ver no Drive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 cursor-pointer focus:bg-red-50 focus:text-red-600"
                          onClick={() => handleDelete(file)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Nenhum ficheiro encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
