import QualificacaoPage from "@/pages/dashboard/qualificacao";

interface QualificadorContextualProps {
  clienteIdealId: string | undefined;
}

export function QualificadorContextual({ clienteIdealId }: QualificadorContextualProps) {
  return <QualificacaoPage clienteIdealId={clienteIdealId ?? undefined} />;
}
