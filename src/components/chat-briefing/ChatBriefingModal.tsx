import React, { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractBriefingReply, isBriefingCompleted } from "./extractBriefingReply";

const BRIEFING_WEBHOOK_URL = "https://jobs.traveltec.com.br/webhook/briefing";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatBriefingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  onCompleted: () => void;
}

async function fetchBriefingWebhook(
  payload: { action: string; company_id: string; answer?: string }
): Promise<unknown> {
  const res = await fetch(BRIEFING_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export function ChatBriefingModal({
  open,
  onOpenChange,
  companyId,
  onCompleted,
}: ChatBriefingModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback((role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!open || !companyId) return;
    setMessages([]);
    setInput("");
    setIsLoading(true);
    fetchBriefingWebhook({ action: "start", company_id: companyId })
      .then((data) => {
        if (isBriefingCompleted(data)) {
          setMessages([
            { role: "assistant", content: "Briefing concluído com sucesso!" },
          ]);
          onCompleted();
          setTimeout(() => onOpenChange(false), 3000);
        } else {
          setMessages([
            { role: "assistant", content: extractBriefingReply(data) },
          ]);
        }
      })
      .catch((err) => {
        setMessages([
          {
            role: "assistant",
            content: `Erro ao iniciar o briefing: ${err instanceof Error ? err.message : "erro desconhecido"}`,
          },
        ]);
      })
      .finally(() => setIsLoading(false));
  }, [open, companyId, onCompleted, onOpenChange]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !companyId) return;

    const userMessage = input.trim();
    setInput("");
    addMessage("user", userMessage);
    setIsLoading(true);

    try {
      const data = await fetchBriefingWebhook({
        action: "message",
        company_id: companyId,
        answer: userMessage,
      });

      if (isBriefingCompleted(data)) {
        addMessage("assistant", "Briefing concluído com sucesso!");
        onCompleted();
        setTimeout(() => onOpenChange(false), 3000);
      } else {
        const text = extractBriefingReply(data);
        addMessage("assistant", text);
      }
    } catch (err) {
      addMessage(
        "assistant",
        `Erro ao enviar: ${err instanceof Error ? err.message : "erro desconhecido"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMessages([]);
      setInput("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Chat de Briefing</DialogTitle>
        </DialogHeader>

        <Card className="flex-1 overflow-hidden flex flex-col mx-6 mb-6 border bg-slate-50/40 border-slate-200 shadow-sm">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[280px] max-h-[400px]"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border text-primary"
                    }`}
                  >
                    {m.role === "user" ? (
                      <User size={18} />
                    ) : (
                      <Bot size={18} />
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-2xl shadow-sm leading-relaxed prose prose-sm max-w-none ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-card border border-slate-200 rounded-tl-none text-foreground"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-card border flex items-center justify-center shadow-sm">
                    <Bot size={18} className="text-primary" />
                  </div>
                  <div className="bg-card border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground italic">
                      Carregando...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-card border-t border-slate-200">
            <form
              onSubmit={handleSendMessage}
              className="flex gap-2"
            >
              <Input
                placeholder={
                  companyId
                    ? "Digite sua resposta..."
                    : "Aguardando empresa..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 py-5"
                disabled={isLoading || !companyId}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim() || !companyId}
                className="h-auto px-5"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </Button>
            </form>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
