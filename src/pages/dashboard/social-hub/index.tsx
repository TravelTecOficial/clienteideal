/**
 * Social Hub - Módulo Social Media (Mockup)
 *
 * RLS/Backend - Regras para implementação futura:
 * - Multitenancy: Filtro obrigatório company_id em todas as queries.
 *   Conteúdo de uma empresa nunca visível para outra.
 * - Perfis: Admins da empresa = controle total; Vendedores = visualizar/criar
 *   conforme profiles.role e permissões.
 * - Autenticação: Rota protegida por ProtectedRoute (Clerk + plano ativo).
 * - Banco: ideal_customer_id FK para ideal_customers(id); created_at e user_id
 *   (auth.jwt() ->> 'sub') para auditoria.
 *
 * TODO: Integrar useEffectiveCompanyId() ao buscar dados do Supabase.
 */
import { useState } from "react";
import { Plus, Share2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Mock de dados para visualização inicial (futuro: filtrar por company_id)
const MOCK_CONTENT = [
  {
    id: 1,
    title: "5 Dicas de Produtividade",
    type: "Blog",
    ideal_customer_id: "1",
    icp_name: "Empresário Pro",
    content: "Conteúdo do post sobre produtividade...",
    status: "Rascunho",
    created_at: "2025-03-15",
  },
  {
    id: 2,
    title: "Novidades de Março",
    type: "Newsletter",
    ideal_customer_id: null,
    icp_name: null,
    content: "Resumo das novidades do mês...",
    status: "Agendado",
    created_at: "2025-03-20",
  },
  {
    id: 3,
    title: "Post LinkedIn",
    type: "Social",
    ideal_customer_id: "2",
    icp_name: "Gerente Comercial",
    content: "Dicas para gestão comercial...",
    status: "Publicado",
    created_at: "2025-03-18",
  },
];

const MOCK_ICPS = [
  { id: "1", name: "Empresário Pro" },
  { id: "2", name: "Gerente Comercial" },
];

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Rascunho":
      return "secondary";
    case "Agendado":
      return "outline";
    case "Publicado":
      return "default";
    default:
      return "secondary";
  }
}

export default function SocialHub() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="size-6" />
            Social Media
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas redes sociais, newsletters e blog posts.
          </p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={16} />
              Novo Conteúdo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Criar Novo Conteúdo</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título</Label>
                  <Input
                    id="titulo"
                    placeholder="Ex: Post do Instagram"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select>
                    <SelectTrigger id="tipo">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="blog">Blog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="icp">Vínculo com ICP (Cliente Ideal)</Label>
                <Select>
                  <SelectTrigger id="icp">
                    <SelectValue placeholder="Vincular a um perfil (Opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_ICPS.map((icp) => (
                      <SelectItem key={icp.id} value={icp.id}>
                        {icp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="conteudo">Conteúdo</Label>
                <Textarea
                  id="conteudo"
                  className="min-h-[100px]"
                  placeholder="Escreva o corpo do post ou e-mail..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="agendado">Agendado</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setIsModalOpen(false)}>
                Salvar Mockup
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente Ideal (ICP)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_CONTENT.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>
                  {item.icp_name ? (
                    <Badge variant="secondary">{item.icp_name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">N/A</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell>{item.created_at}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
