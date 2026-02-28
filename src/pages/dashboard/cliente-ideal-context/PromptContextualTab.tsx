import { useOutletContext } from "react-router-dom";
import { PromptAtendimentoContextual } from "./PromptAtendimentoContextual";

interface OutletContext {
  clienteIdealId: string | undefined;
  profileName: string | null;
}

export function PromptContextualTab() {
  const { clienteIdealId } = useOutletContext<OutletContext>();
  return <PromptAtendimentoContextual clienteIdealId={clienteIdealId ?? undefined} />;
}
