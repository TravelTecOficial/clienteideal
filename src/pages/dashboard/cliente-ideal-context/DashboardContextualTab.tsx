import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";

interface OutletContext {
  clienteIdealId: string | undefined;
  profileName: string | null;
}

/** Visão-resumo contextual do Cliente Ideal. Ainda será definido. */
export function DashboardContextualTab() {
  const { profileName, clienteIdealId } = useOutletContext<OutletContext>();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          Dashboard — {profileName ?? "Cliente Ideal"}
        </CardTitle>
        <CardDescription>
          Visão geral e indicadores deste Cliente Ideal. Em breve.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Métricas e resumo do perfil serão exibidos aqui.
        </p>
      </CardContent>
    </Card>
  );
}
