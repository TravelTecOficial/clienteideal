import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Filter, Search, LayoutGrid, FileBarChart, Download, MoreVertical, ChevronDown, Folder } from "lucide-react";

/** Simulado de campanhas Google Ads para o Cliente Ideal */
export function GoogleAdsCampaignsSimulator() {
  const [selectedMetric, setSelectedMetric] = useState<"impr" | "custo" | "conversoes" | "cliques">("impr");

  const metricCards = [
    { id: "impr" as const, label: "Impr.", value: "—" },
    { id: "custo" as const, label: "Custo", value: "—" },
    { id: "conversoes" as const, label: "Conversões", value: "—" },
    { id: "cliques" as const, label: "Cliques", value: "—" },
  ];

  const mockCampaigns = [
    { id: "1", name: "Campanha Search - Cliente Ideal", budget: "R$ 50,00/dia", status: "Pausada", type: "Pesquisa", impr: 0, interacoes: "—", taxa: "—", custoMedio: "—", custo: "R$ 0,00", estrategia: "Maximizar cliques" },
    { id: "2", name: "Display - Persona João", budget: "R$ 30,00/dia", status: "Pausada", type: "Display", impr: 0, interacoes: "—", taxa: "—", custoMedio: "—", custo: "R$ 0,00", estrategia: "Maximizar conversões" },
    { id: "3", name: "Remarketing - Carro", budget: "R$ 20,00/dia", status: "Pausada", type: "Display", impr: 0, interacoes: "—", taxa: "—", custoMedio: "—", custo: "R$ 0,00", estrategia: "Alvo de CPA" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-[#4285F4] text-white text-sm font-bold">
            G
          </span>
          Campanhas Google Ads (Simulado)
        </CardTitle>
        <CardDescription>
          Visualização simulada das campanhas vinculadas a este cliente ideal. Conecte o Google Ads em Configurações para dados reais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {metricCards.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMetric(m.id)}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                selectedMetric === m.id
                  ? "border-[#4285F4] bg-[#4285F4]/10 text-[#4285F4]"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <span className="text-muted-foreground">{m.label}:</span>{" "}
              <span className="font-semibold">{m.value}</span>
            </button>
          ))}
        </div>

        <div className="h-32 rounded-lg border border-border bg-muted/20 flex items-end justify-center p-4">
          <div className="flex items-end gap-1 h-full">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="w-6 rounded-t bg-[#4285F4]/30"
                style={{ height: `${Math.max(8, (i * 12) % 40)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline">
            <Filter className="h-4 w-4 mr-1" /> Adicionar filtro
          </Button>
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar" className="pl-8 h-8" />
          </div>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
            <FileBarChart className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10"></TableHead>
                <TableHead className="font-medium">Campanha</TableHead>
                <TableHead>Orçamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="border-b border-dashed border-muted-foreground cursor-help">
                    Pontuação de otimização
                  </span>
                </TableHead>
                <TableHead>Tipo de campanha</TableHead>
                <TableHead>Impr.</TableHead>
                <TableHead>Interações</TableHead>
                <TableHead>Taxa de interação</TableHead>
                <TableHead>Custo médio</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>
                  <span className="border-b border-dashed border-muted-foreground cursor-help">
                    Tipo de estratégia de lances
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-primary/5">
                <TableCell className="py-2">
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell className="py-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell colSpan={10} className="py-2 font-medium">
                  Rascunhos em andamento: 5
                </TableCell>
              </TableRow>
              {mockCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                    Você não tem campanhas ativas
                  </TableCell>
                </TableRow>
              ) : (
                mockCampaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.budget}</TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell>{c.impr}</TableCell>
                    <TableCell>{c.interacoes}</TableCell>
                    <TableCell>{c.taxa}</TableCell>
                    <TableCell>{c.custoMedio}</TableCell>
                    <TableCell>{c.custo}</TableCell>
                    <TableCell>{c.estrategia}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell className="font-medium">
                  Total: conta <span className="text-muted-foreground">?</span>
                </TableCell>
                <TableCell>R$ 0,00/dia</TableCell>
                <TableCell colSpan={3}></TableCell>
                <TableCell>0</TableCell>
                <TableCell>—</TableCell>
                <TableCell>—</TableCell>
                <TableCell>—</TableCell>
                <TableCell>R$ 0,00</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
