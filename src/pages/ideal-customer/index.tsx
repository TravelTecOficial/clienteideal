import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Package, Wrench } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ItemsPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-muted-foreground">Gerencie seus produtos e serviços ofertados.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Novo Item
          </Button>
        </div>
      </div>

      <Tabs defaultValue="product" className="w-full">
        <TabsList>
          <TabsTrigger value="product" className="gap-2">
            <Package className="h-4 w-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="service" className="gap-2">
            <Wrench className="h-4 w-4" /> Serviços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="product" className="pt-4">
          <ItemsTable type="product" />
        </TabsContent>
        <TabsContent value="service" className="pt-4">
          <ItemsTable type="service" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ItemsTable({ type }: { type: 'product' | 'service' }) {
  return (
    <div className="border rounded-lg bg-card text-card-foreground">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
              Carregando {type === 'product' ? 'produtos' : 'serviços'}...
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}