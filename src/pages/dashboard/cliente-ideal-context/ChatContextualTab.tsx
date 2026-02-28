import { useOutletContext } from "react-router-dom";
import ChatConhecimentoContent from "@/pages/dashboard/chat-conhecimento";

interface OutletContext {
  clienteIdealId: string | undefined;
  profileName: string | null;
}

export function ChatContextualTab() {
  const { clienteIdealId } = useOutletContext<OutletContext>();
  return (
    <ChatConhecimentoContent
      companyIdOverride={undefined}
      compact={false}
      clienteIdealIdOverride={clienteIdealId ?? undefined}
    />
  );
}
