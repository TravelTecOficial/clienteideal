import { useOutletContext } from "react-router-dom";
import { QualificadorContextual } from "./QualificadorContextual";

interface OutletContext {
  clienteIdealId: string | undefined;
  profileName: string | null;
}

export function QualificadorContextualTab() {
  const { clienteIdealId } = useOutletContext<OutletContext>();
  return <QualificadorContextual clienteIdealId={clienteIdealId ?? undefined} />;
}
