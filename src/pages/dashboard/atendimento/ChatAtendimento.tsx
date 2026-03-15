import React, { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, User, Loader2, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@clerk/clerk-react";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ContactOption {
  id: string;
  celular: string;
  nome: string | null;
}

export default function ChatAtendimento() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [customPhone, setCustomPhone] = useState("");
  const [useCustomPhone, setUseCustomPhone] = useState(false);
  const [isWhatsappConnected, setIsWhatsappConnected] = useState(false);
  const [isLoadingConnection, setIsLoadingConnection] = useState(true);
  const { getToken } = useAuth();
  const supabase = useSupabaseClient();
  const companyId = useEffectiveCompanyId();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const targetPhone = useCustomPhone ? customPhone.replace(/\D/g, "") : selectedContact?.celular?.replace(/\D/g, "") ?? "";

  const loadWhatsappConnection = useCallback(async () => {
    if (!companyId) {
      setIsLoadingConnection(false);
      return;
    }
    try {
      const token = await getToken();
      if (!token) {
        setIsLoadingConnection(false);
        return;
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "getWhatsappConnection",
          company_id: companyId,
          token,
        }),
      });
      const data = (await res.json().catch(() => null)) as { connected?: boolean; error?: string } | null;
      setIsWhatsappConnected(res.ok && data?.connected === true);
    } catch {
      setIsWhatsappConnected(false);
    } finally {
      setIsLoadingConnection(false);
    }
  }, [companyId, getToken]);

  const loadContacts = useCallback(async () => {
    if (!companyId || !supabase) return;
    try {
      const { data, error } = await supabase
        .from("atendimentos_ia")
        .select("id, celular, nome")
        .eq("company_id", companyId)
        .not("celular", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const list = (data ?? []) as ContactOption[];
      setContacts(list);
      if (list.length > 0 && !selectedContactId) setSelectedContactId(list[0].id);
    } catch (err) {
      console.error("Erro ao carregar contatos:", err);
      setContacts([]);
    }
  }, [companyId, supabase]);

  useEffect(() => {
    loadWhatsappConnection();
  }, [loadWhatsappConnection]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !targetPhone || !companyId) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Token de autenticação indisponível. Faça login novamente.");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-integration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "sendMessage",
          company_id: companyId,
          to: targetPhone,
          text: userMessage,
          token,
        }),
      });

      const data = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? `Erro ${res.status}`);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao enviar mensagem",
        description: getErrorMessage(err),
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
  };

  if (isLoadingConnection) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] max-w-5xl mx-auto p-4 items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Verificando conexão WhatsApp...</p>
      </div>
    );
  }

  if (!isWhatsappConnected) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)] max-w-5xl mx-auto p-4 items-center justify-center gap-4">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">WhatsApp não conectado</h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Conecte o WhatsApp nas configurações para enviar e receber mensagens com seus clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-5xl mx-auto p-4">
      <div className="mb-4 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="text-green-600" /> Chat WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm">
            Envie mensagens para seus clientes via WhatsApp Cloud API.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="contact-select" className="text-sm font-medium shrink-0">
              Contato:
            </Label>
            <Select
              value={useCustomPhone ? "__custom__" : selectedContactId ?? ""}
              onValueChange={(v) => {
                if (v === "__custom__") {
                  setUseCustomPhone(true);
                  setSelectedContactId(null);
                } else {
                  setUseCustomPhone(false);
                  setSelectedContactId(v || null);
                }
              }}
              disabled={contacts.length === 0}
            >
              <SelectTrigger id="contact-select" className="w-[220px]">
                <SelectValue placeholder="Selecione um contato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">Digitar número manualmente</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome?.trim() || "Sem nome"} — {formatPhoneDisplay(c.celular)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {useCustomPhone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ex: 5511999999999"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="w-[180px]"
              />
            </div>
          )}
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-slate-50/40 border-slate-200 shadow-xl">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex justify-center items-center h-32 text-muted-foreground text-sm">
              {targetPhone
                ? "Digite uma mensagem abaixo para iniciar a conversa."
                : "Selecione um contato ou digite um número para enviar mensagens."}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    m.role === "user" ? "bg-green-600 text-white" : "bg-white border text-green-600"
                  }`}
                >
                  {m.role === "user" ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-green-600 text-white rounded-tr-none"
                      : "bg-white border border-slate-200 rounded-tl-none text-slate-800"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-end">
              <div className="flex gap-3 flex-row-reverse">
                <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center shadow-sm">
                  <User size={18} className="text-white" />
                </div>
                <div className="bg-green-600 p-4 rounded-2xl rounded-tr-none shadow-sm flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span className="text-sm text-white/90 italic">Enviando...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
            <Input
              placeholder={
                targetPhone ? "Digite sua mensagem..." : "Selecione um contato primeiro"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 py-6 shadow-sm border-slate-300 focus-visible:ring-green-600"
              disabled={isLoading || !targetPhone}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim() || !targetPhone}
              className="h-auto px-6 bg-green-600 hover:bg-green-700 transition-all shadow-md"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={20} />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
