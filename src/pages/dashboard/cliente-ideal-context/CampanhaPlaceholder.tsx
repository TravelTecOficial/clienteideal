import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface CampanhaPlaceholderProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  iconBgClass?: string;
}

/** Placeholder para plataformas de campanha ainda não implementadas */
export function CampanhaPlaceholder({
  title,
  description = "Integração em breve. Conecte esta plataforma em Configurações quando disponível.",
  icon: Icon,
  iconBgClass = "bg-muted",
}: CampanhaPlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded text-foreground ${iconBgClass}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground font-medium">Em breve</p>
          <p className="text-sm text-muted-foreground mt-1">
            Esta integração estará disponível em uma próxima atualização.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
