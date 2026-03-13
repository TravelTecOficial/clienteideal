import React, { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bot, Send, User, Loader2, Sparkles, MessageSquare } from 'lucide-react';
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
import { SUPABASE_URL } from "@/lib/supabase";

interface Qualificador {
  id: string;
  nome: string;
  prompt_atendimento_id?: string | null;
}

interface PromptAtendimento {
  id: string;
  name: string | null;
  nome_atendente: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const NONE_QUALIFICADOR = "__none__";
const NONE_PROMPT = "__none__";

/** Extrai o texto da resposta do assistente a partir dos formatos possíveis do n8n AI Agent / Webhook */
function extractAssistantReply(data: unknown): string {
  if (data == null) return fallbackMessage;
  if (typeof data === 'string') return data;

  const firstItem = Array.isArray(data) ? data[0] : data;
  const item: Record<string, unknown> = (firstItem as Record<string, unknown> | null) ?? (data as Record<string, unknown>) ?? {};

  // output pode ser: string, array de mensagens, ou objeto aninhado
  const dataObj = data as Record<string, unknown>;
  const output = item.output ?? (item.json as Record<string, unknown>)?.output ?? item.response ?? (item.json as Record<string, unknown>)?.response
    ?? dataObj?.output ?? (dataObj.json as Record<string, unknown>)?.output ?? dataObj?.response ?? dataObj?.result;

  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'content' in first) return String((first as { content?: unknown }).content ?? '');
    if (first && typeof first === 'object' && 'text' in first) return String((first as { text?: unknown }).text ?? '');
  }
  if (output && typeof output === 'object') {
    const nested = (output as Record<string, unknown>).output ?? (output as Record<string, unknown>).text ?? (output as Record<string, unknown>).content;
    if (typeof nested === 'string') return nested;
  }

  // Fallbacks diretos no item
  const text = item.text ?? item.content ?? dataObj?.text ?? dataObj?.message;
  if (typeof text === 'string') return text;

  return fallbackMessage;
}

const fallbackMessage = "Não consegui encontrar informações específicas sobre isso nos documentos.";

interface ChatConhecimentoProps {
  /** Quando definido (ex: admin simulando licença), usa em vez de useEffectiveCompanyId */
  companyIdOverride?: string | null;
  /** Ocultar título e descrição (útil quando embutido em outra página) */
  compact?: boolean;
  /** Quando definido (ex: dentro do módulo Cliente Ideal), infere prompt e qualificador automaticamente e oculta seletores. */
  clienteIdealIdOverride?: string | null;
}

export default function ChatConhecimento({ companyIdOverride, compact = false, clienteIdealIdOverride }: ChatConhecimentoProps = {}) {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getToken } = useAuth();
  const supabase = useSupabaseClient();
  const profileCompanyId = useEffectiveCompanyId();
  const companyId = companyIdOverride ?? profileCompanyId;
  const [qualificadores, setQualificadores] = useState<Qualificador[]>([]);
  const [selectedQualificadorId, setSelectedQualificadorId] = useState<string>(NONE_QUALIFICADOR);
  const [prompts, setPrompts] = useState<PromptAtendimento[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>(NONE_PROMPT);
  const [webhookMode, setWebhookMode] = useState<"produção" | "teste">("produção");
  const [inferredPromptId, setInferredPromptId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isContextual = !!clienteIdealIdOverride;

  // Quando contextual: buscar prompt do Cliente Ideal e qualificadores vinculados
  useEffect(() => {
    if (!isContextual || !clienteIdealIdOverride || !companyId || !supabase) return;
    let cancelled = false;
    (async () => {
      const { data: personaData, error: personaError } = await supabase
        .from("ideal_customers")
        .select("prompt_atendimento_id")
        .eq("id", clienteIdealIdOverride)
        .eq("company_id", companyId)
        .maybeSingle();
      if (cancelled) return;
      if (personaError || !personaData) {
        setInferredPromptId(null);
        setQualificadores([]);
        return;
      }
      const promptId = (personaData as { prompt_atendimento_id: string | null }).prompt_atendimento_id;
      setInferredPromptId(promptId);

      if (!promptId) {
        setQualificadores([]);
        return;
      }
      const { data: qualData, error: qualError } = await supabase
        .from("qualificadores")
        .select("id, nome, prompt_atendimento_id")
        .eq("company_id", companyId)
        .eq("prompt_atendimento_id", promptId)
        .order("nome");
      if (cancelled) return;
      if (qualError) {
        setQualificadores([]);
        return;
      }
      const qualList = (qualData ?? []) as Qualificador[];
      setQualificadores(qualList);
      setSelectedQualificadorId(qualList.length >= 1 ? qualList[0].id : NONE_QUALIFICADOR);
    })();
    return () => { cancelled = true; };
  }, [isContextual, clienteIdealIdOverride, companyId, supabase]);

  // Buscar qualificadores e prompts da empresa (modo não contextual)
  useEffect(() => {
    if (isContextual || !companyId || !supabase) return;
    supabase
      .from("qualificadores")
      .select("id, nome")
      .eq("company_id", companyId)
      .order("nome")
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao buscar qualificadores:", error);
          setQualificadores([]);
          return;
        }
        setQualificadores((data ?? []) as Qualificador[]);
      });
    supabase
      .from("prompt_atendimento")
      .select("id, name, nome_atendente")
      .eq("company_id", companyId)
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao buscar prompts:", error);
          setPrompts([]);
          return;
        }
        setPrompts((data ?? []) as PromptAtendimento[]);
      });
  }, [companyId, supabase, isContextual]);

  // Mensagem de boas-vindas inicial
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        { 
          role: 'assistant', 
          content: 'Olá! Sou seu assistente de conhecimento. Posso consultar todos os documentos que você subiu na base e tirar suas dúvidas agora mesmo. O que você gostaria de saber?' 
        }
      ]);
    }
  }, []);

  // Auto-scroll suave para a última mensagem (messages + isLoading suficientes)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!companyId) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Aguarde o carregamento da empresa ou verifique se seu perfil está vinculado a uma empresa.',
      }]);
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Usa o token padrão do Clerk (mesmo padrão já usado no Evolution proxy).
      const token = await getToken();
      if (!token) throw new Error("Token indisponível.");

      const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const proxyUrl = isLocalhost ? "/api/chat-conhecimento" : `${SUPABASE_URL}/functions/v1/chat-conhecimento-proxy`;

      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          company_id: companyId,
          qualificador_id: selectedQualificadorId !== NONE_QUALIFICADOR ? selectedQualificadorId : undefined,
          qualificador_nome: selectedQualificadorId !== NONE_QUALIFICADOR ? qualificadores.find((q) => q.id === selectedQualificadorId)?.nome ?? undefined : undefined,
          prompt_atendimento_id: isContextual ? (inferredPromptId ?? undefined) : (selectedPromptId !== NONE_PROMPT ? selectedPromptId : undefined),
          webhook_mode: webhookMode,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const parsedError = (() => {
          try {
            return JSON.parse(errorText) as { error?: string; message?: string };
          } catch {
            return null;
          }
        })();
        throw new Error(
          parsedError?.error ||
            parsedError?.message ||
            errorText ||
            `Falha na comunicação com o servidor (HTTP ${response.status})`
        );
      }

      const data = await response.json();
      
      // Se n8n retornou "Workflow got started" = webhook em modo "Immediately" (configurar "When Last Node Finishes")
      const msg = data?.message ?? data?.msg ?? data?.status;
      if (msg && String(msg).toLowerCase().includes('workflow got started')) {
        throw new Error('WEBHOOK_IMMEDIATE');
      }
      
      // Extrai a resposta do assistente considerando todos os formatos possíveis do n8n AI Agent
      const assistantReply = extractAssistantReply(data);

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: assistantReply 
      }]);
    } catch (error) {
      console.error("Erro ao consultar n8n:", error);
      const isWebhookImmediate = error instanceof Error && error.message === 'WEBHOOK_IMMEDIATE';
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: isWebhookImmediate
          ? "O webhook n8n está configurado para responder imediatamente. Configure o nó Webhook para 'Respond: When Last Node Finishes' para receber a resposta do assistente."
          : `Desculpe, tive um problema ao conectar com minha base de conhecimento: ${
              error instanceof Error ? error.message : "erro desconhecido"
            }` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col ${compact ? "h-[500px]" : "h-[calc(100vh-140px)]"} max-w-5xl mx-auto p-4`}>
      <div className="mb-4 flex flex-col gap-4">
        {!compact && (
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="text-blue-600" /> Chat de Conhecimento
            </h1>
            <p className="text-muted-foreground text-sm">
              Consultando documentos vetorizados via PGVector e n8n[cite: 157, 160].
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {!isContextual && (
            <>
              <div className="flex items-center gap-2">
                <Label htmlFor="qualificador-select" className="text-sm font-medium shrink-0">
                  Qualificador:
                </Label>
                <Select
                  value={selectedQualificadorId}
                  onValueChange={setSelectedQualificadorId}
                  disabled={!companyId || qualificadores.length === 0}
                >
                  <SelectTrigger id="qualificador-select" className="w-[200px]">
                    <SelectValue placeholder="Selecione um qualificador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_QUALIFICADOR}>Selecione um qualificador</SelectItem>
                    {qualificadores.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="prompt-select" className="text-sm font-medium shrink-0">
                  Prompt:
                </Label>
                <Select
                  value={selectedPromptId}
                  onValueChange={setSelectedPromptId}
                  disabled={!companyId || prompts.length === 0}
                >
                  <SelectTrigger id="prompt-select" className="w-[200px]">
                    <SelectValue placeholder="Selecione um prompt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_PROMPT}>Selecione um prompt</SelectItem>
                    {prompts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name?.trim() || p.nome_atendente?.trim() || "Prompt"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {isContextual && !inferredPromptId && (
            <span className="text-sm text-amber-600 dark:text-amber-500">
              <Link to={id ? `/dashboard/cliente-ideal/${id}/perfil` : "/dashboard/cliente-ideal"} className="underline hover:no-underline font-medium">
                Vincule um prompt na aba Perfil
              </Link>
              {" "}para usar o chat.
            </span>
          )}
          <div className="flex items-center gap-2">
            <Label htmlFor="webhook-mode-select" className="text-sm font-medium shrink-0">
              Modo:
            </Label>
            <Select
              value={webhookMode}
              onValueChange={(v) => setWebhookMode(v as "produção" | "teste")}
              disabled={!companyId}
            >
              <SelectTrigger id="webhook-mode-select" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="produção">Produção</SelectItem>
                <SelectItem value="teste">Teste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!companyId && (
            <span className="text-xs text-muted-foreground">Carregando empresa...</span>
          )}
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-slate-50/40 border-slate-200 shadow-xl">
        {/* Área de Mensagens */}
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border text-blue-600'
                }`}>
                  {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className={`p-4 rounded-2xl shadow-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 rounded-tl-none text-slate-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-white border flex items-center justify-center shadow-sm">
                  <Bot size={18} className="text-blue-600" />
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-slate-500 italic font-medium">Analisando base de documentos...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input de Texto */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto">
            <Input 
              placeholder={
                isContextual && !inferredPromptId
                  ? "Vincule um prompt na aba Perfil para usar o chat."
                  : companyId
                    ? "Digite sua dúvida aqui..."
                    : "Carregando empresa..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 py-6 shadow-sm border-slate-300 focus-visible:ring-blue-600"
              disabled={isLoading || !companyId || (isContextual && !inferredPromptId)}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim() || !companyId || (isContextual && !inferredPromptId)}
              className="h-auto px-6 bg-blue-600 hover:bg-blue-700 transition-all shadow-md"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={20} />}
            </Button>
          </form>
          <div className="mt-2 text-[10px] text-center text-slate-400 uppercase tracking-tighter flex items-center justify-center gap-1">
            <MessageSquare size={10} /> Proteção Multitenant Ativa via RLS [cite: 29, 206]
          </div>
        </div>
      </Card>
    </div>
  );
}