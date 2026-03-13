/**
 * Social Hub - Módulo Social Media
 *
 * Hub central para gerenciamento de canais sociais.
 * O Google Meu Negócio é o primeiro canal integrado,
 * usando a API oficial do Google (localPosts) via Supabase Edge Functions.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Send, Share2 } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSupabaseClient } from "@/lib/supabase-context";
import { SUPABASE_URL } from "@/lib/supabase";
import { useEffectiveCompanyId } from "@/hooks/use-effective-company-id";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";

interface GmbPost {
  id: string;
  content: string;
  status: string;
  createdAt: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  platform: string | null;
  mediaUrl: string | null;
}

export default function SocialHub() {
  const supabase = useSupabaseClient();
  const effectiveCompanyId = useEffectiveCompanyId();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [isGmbConnected, setIsGmbConnected] = useState(false);
  const [gmbConnectionLoading, setGmbConnectionLoading] = useState(false);

  const [posts, setPosts] = useState<GmbPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [postContent, setPostContent] = useState("");
  const [postMediaUrl, setPostMediaUrl] = useState("");
  const [postPublishing, setPostPublishing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadGmbConnection = useCallback(async () => {
    if (!effectiveCompanyId) {
      setIsGmbConnected(false);
      return;
    }
    setGmbConnectionLoading(true);
    try {
      const { data } = await supabase
        .from("google_connections")
        .select("selected_property_name")
        .eq("company_id", effectiveCompanyId)
        .eq("service", "mybusiness")
        .maybeSingle();
      setIsGmbConnected(
        !!(data as { selected_property_name?: string | null } | null)?.selected_property_name?.trim()
      );
    } catch {
      setIsGmbConnected(false);
    } finally {
      setGmbConnectionLoading(false);
    }
  }, [effectiveCompanyId, supabase]);

  const loadPosts = useCallback(async () => {
    if (!isGmbConnected || !effectiveCompanyId) {
      setPosts([]);
      setPostsError(null);
      return;
    }

    setPostsLoading(true);
    setPostsError(null);
    try {
      const token = (await getToken()) ?? (await getToken({ template: "supabase" }));
      if (!token) {
        toast({
          variant: "destructive",
          title: "Sessão inválida",
          description: "Faça login novamente para carregar as postagens.",
        });
        return;
      }

      const params = new URLSearchParams();
      if (effectiveCompanyId) params.set("company_id", effectiveCompanyId);
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/gmb-post-list?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = (await res.json().catch(() => ({}))) as {
        posts?: GmbPost[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data?.error ?? `Erro ${res.status}`);
      }

      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (err) {
      const msg = getErrorMessage(err);
      setPostsError(msg);
      toast({
        variant: "destructive",
        title: "Erro ao carregar postagens do Google Meu Negócio",
        description: msg,
      });
    } finally {
      setPostsLoading(false);
    }
  }, [isGmbConnected, effectiveCompanyId, getToken, toast]);

  const handlePublish = useCallback(async () => {
    const content = postContent.trim();

    if (!isGmbConnected) {
      toast({
        variant: "destructive",
        title: "Conecte o Google Meu Negócio",
        description:
          "Conecte e selecione o perfil em Configurações → Integrações → Google Meu Negócio antes de publicar.",
      });
      return;
    }
    if (!content) {
      toast({
        variant: "destructive",
        title: "Texto obrigatório",
        description: "Digite o texto do post antes de publicar.",
      });
      return;
    }

    const mediaUrl = postMediaUrl.trim() || undefined;

    setPostPublishing(true);
    try {
      const token = (await getToken()) ?? (await getToken({ template: "supabase" }));
      if (!token) {
        toast({
          variant: "destructive",
          title: "Sessão inválida",
          description: "Faça login novamente para publicar.",
        });
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/gmb-post-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          mediaUrl,
          ...(effectiveCompanyId ? { company_id: effectiveCompanyId } : {}),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data?.error ?? `Erro ${res.status}`);
      }

      toast({
        title: "Post publicado com sucesso!",
      });
      setPostContent("");
      setPostMediaUrl("");
      setShowCreateForm(false);
      void loadPosts();
    } catch (err) {
      const msg = getErrorMessage(err);
      toast({
        variant: "destructive",
        title: "Erro ao publicar no Google Meu Negócio",
        description: msg,
      });
    } finally {
      setPostPublishing(false);
    }
  }, [isGmbConnected, effectiveCompanyId, postContent, postMediaUrl, getToken, toast, loadPosts]);

  useEffect(() => {
    void loadGmbConnection();
  }, [loadGmbConnection]);

  useEffect(() => {
    if (isGmbConnected) {
      void loadPosts();
    }
  }, [isGmbConnected, loadPosts]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="size-6" />
            Social Media
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas redes sociais, newsletters e blog posts.
          </p>
        </div>
      </div>

      <Tabs defaultValue="gmb" className="space-y-4">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
          <TabsTrigger value="facebook">Facebook</TabsTrigger>
          <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
          <TabsTrigger value="website">Website</TabsTrigger>
          <TabsTrigger value="gmb">Google Meu Negócio</TabsTrigger>
        </TabsList>

        <TabsContent value="instagram">
          <Card>
            <CardHeader>
              <CardTitle>Instagram</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Este canal está em construção. Em breve você poderá ver o
                calendário de posts e publicar direto pelo Cliente Ideal.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facebook">
          <Card>
            <CardHeader>
              <CardTitle>Facebook</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Este canal está em construção. Em breve você poderá gerenciar
                publicações e agendamentos do Facebook.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="linkedin">
          <Card>
            <CardHeader>
              <CardTitle>LinkedIn</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Este canal está em construção. Em breve você poderá publicar e
                acompanhar posts no LinkedIn.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="website">
          <Card>
            <CardHeader>
              <CardTitle>Website / Blog</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Este canal está em construção. Em breve você poderá organizar
                blog posts e páginas do seu site.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gmb">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Google Meu Negócio — Publicações</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadPosts()}
                  disabled={postsLoading || !isGmbConnected}
                  className="gap-1"
                >
                  {postsLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  <span>Atualizar</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowCreateForm((v) => !v)}
                  disabled={!isGmbConnected}
                  className="gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nova publicação</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!gmbConnectionLoading && !isGmbConnected && (
                <p className="text-sm text-muted-foreground">
                  Conecte o Google Meu Negócio em{" "}
                  <span className="font-medium">Configurações → Integrações</span>{" "}
                  e selecione o perfil para ver e publicar posts aqui.
                </p>
              )}

              {isGmbConnected && (
                <>
                  {postsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Carregando postagens...</span>
                    </div>
                  ) : postsError ? (
                    <p className="text-sm text-destructive">{postsError}</p>
                  ) : posts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma postagem ainda. Use &quot;Nova publicação&quot; para criar a primeira.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {posts.map((post) => {
                        const created =
                          post.createdAt &&
                          new Date(post.createdAt).toLocaleString("pt-BR");
                        const published =
                          post.publishedAt &&
                          new Date(post.publishedAt).toLocaleString("pt-BR");
                        return (
                          <div
                            key={post.id}
                            className="rounded-md border bg-card/60 p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline" className="text-xs">
                                {post.status || "—"}
                              </Badge>
                              {created && (
                                <span className="text-[11px] text-muted-foreground">
                                  Criado em {created}
                                </span>
                              )}
                            </div>
                            {post.mediaUrl && (
                              <div className="rounded overflow-hidden bg-muted max-w-sm">
                                <img
                                  src={post.mediaUrl}
                                  alt=""
                                  className="w-full h-auto max-h-48 object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                            <p className="text-sm">
                              {post.content && post.content.length > 160
                                ? `${post.content.slice(0, 160)}…`
                                : post.content || "Sem conteúdo."}
                            </p>
                            {published && (
                              <p className="text-[11px] text-muted-foreground">
                                Publicado em {published}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showCreateForm && (
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <h3 className="font-medium text-sm">Nova publicação</h3>
                      <div className="space-y-1">
                        <Label htmlFor="gmb-post-content">Texto do post</Label>
                        <Textarea
                          id="gmb-post-content"
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          placeholder="Digite o texto do post..."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="gmb-post-media">
                          URL da imagem (opcional, HTTPS)
                        </Label>
                        <Input
                          id="gmb-post-media"
                          type="url"
                          value={postMediaUrl}
                          onChange={(e) => setPostMediaUrl(e.target.value)}
                          placeholder="https://exemplo.com/imagem.jpg"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => void handlePublish()}
                          disabled={postPublishing || !postContent.trim()}
                          className="gap-2"
                        >
                          {postPublishing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          <span>Publicar</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowCreateForm(false)}
                          disabled={postPublishing}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
