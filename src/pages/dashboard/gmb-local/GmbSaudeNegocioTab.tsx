/**
 * Aba Saúde do Negócio - Gestão de perfil GMB, imagens e serviços.
 * Substitui o conteúdo anterior (Health Score, audit checklist).
 */
import { useState, useRef, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MapPin, Phone, Loader2, ImagePlus, Pencil, ExternalLink, Briefcase } from "lucide-react";
import { getErrorMessage, cn } from "@/lib/utils";
import type { CompanyData } from "./types";

interface GmbProfile {
  title?: string;
  storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string };
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  profile?: { description?: string };
  metadata?: { mapsUri?: string; placeId?: string };
}

interface GmbSaudeNegocioTabProps {
  companyData: CompanyData | null;
  effectiveCompanyId: string | null;
  getToken: () => Promise<string | null>;
  supabase: ReturnType<typeof import("@/lib/supabase-context").useSupabaseClient>;
  gmbProfile: GmbProfile | Record<string, unknown> | null;
  gmbProfileLoading: boolean;
  gmbMediaItems: unknown[];
  gmbMediaLoading: boolean;
  gmbServices: { serviceItems: unknown[]; canModifyServiceList: boolean } | null;
  gmbServicesLoading: boolean;
  gmbProfileUpdating: boolean;
  gmbMediaUploading: boolean;
  gmbServicesUpdating: boolean;
  gmbAvailableServiceTypes: { serviceTypeId: string; displayName?: string }[];
  gmbAvailableServicesLoading: boolean;
  onLoadProfile: () => void;
  onLoadMedia: () => void;
  onLoadServices: () => void;
  onLoadAvailableServices: (categoryId: string) => void;
  onProfileUpdate: (updates: Record<string, unknown>) => Promise<void>;
  onMediaUpload: (file: File, category: "COVER" | "ADDITIONAL") => Promise<void>;
  onServicesUpdate: (serviceItems: unknown[]) => Promise<void>;
  reviewsAverageRating: number | null;
  reviewsTotalCount: number;
  toast: (p: { variant?: "destructive" | "default"; title: string; description?: string }) => void;
}

function formatAddress(addr: GmbProfile["storefrontAddress"]): string {
  if (!addr) return "";
  const parts: string[] = [];
  if (addr.addressLines?.[0]) parts.push(addr.addressLines[0]);
  if (addr.locality) parts.push(addr.locality);
  if (addr.administrativeArea) parts.push(addr.administrativeArea);
  return parts.join(" - ");
}

function formatAddressFromCompany(c: CompanyData | null): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.logradouro && c.numero) parts.push(`${c.logradouro}, ${c.numero}`);
  else if (c.logradouro) parts.push(c.logradouro);
  if (c.cidade) parts.push(c.cidade);
  if (c.uf) parts.push(c.uf);
  return parts.join(" - ");
}

/** Formata serviceTypeId para exibição (ex: job_type_id:web_design → Web Design). */
function formatServiceTypeDisplayName(serviceTypeId: string): string {
  const part = serviceTypeId.includes(":") ? serviceTypeId.split(":")[1] ?? serviceTypeId : serviceTypeId;
  return part
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function GmbSaudeNegocioTab({
  companyData,
  effectiveCompanyId,
  gmbProfile,
  gmbProfileLoading,
  gmbMediaItems,
  gmbMediaLoading,
  gmbServices,
  gmbServicesLoading,
  gmbProfileUpdating,
  gmbMediaUploading,
  gmbServicesUpdating,
  gmbAvailableServiceTypes,
  gmbAvailableServicesLoading,
  onLoadProfile,
  onLoadMedia,
  onLoadServices,
  onLoadAvailableServices,
  onProfileUpdate,
  onMediaUpload,
  onServicesUpdate,
  reviewsAverageRating,
  reviewsTotalCount,
  toast,
}: GmbSaudeNegocioTabProps) {
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const freeFormItems = useMemo(() => {
    if (!gmbServices?.serviceItems) return [];
    return gmbServices.serviceItems.filter(
      (item: unknown) => (item as { freeFormServiceItem?: unknown }).freeFormServiceItem != null
    );
  }, [gmbServices?.serviceItems]);

  const currentStructuredIds = useMemo(() => {
    if (!gmbServices?.serviceItems) return new Set<string>();
    const ids = new Set<string>();
    for (const item of gmbServices.serviceItems) {
      const sid = (item as { structuredServiceItem?: { serviceTypeId?: string } })?.structuredServiceItem?.serviceTypeId;
      if (sid) ids.add(sid);
    }
    return ids;
  }, [gmbServices?.serviceItems]);

  /** Fallback: quando listByCategory retorna serviceTypes vazios, usa os serviceItems atuais. */
  const effectiveServiceTypes = useMemo(() => {
    if (gmbAvailableServiceTypes.length > 0) return gmbAvailableServiceTypes;
    if (!gmbServices?.serviceItems?.length) return [];
    const seen = new Set<string>();
    const types: { serviceTypeId: string; displayName?: string }[] = [];
    for (const item of gmbServices.serviceItems) {
      const sid = (item as { structuredServiceItem?: { serviceTypeId?: string } })?.structuredServiceItem?.serviceTypeId;
      if (sid && !seen.has(sid)) {
        seen.add(sid);
        types.push({ serviceTypeId: sid, displayName: formatServiceTypeDisplayName(sid) });
      }
    }
    return types;
  }, [gmbAvailableServiceTypes, gmbServices?.serviceItems]);

  useEffect(() => {
    setSelectedServiceIds(currentStructuredIds);
  }, [currentStructuredIds]);

  useEffect(() => {
    const shouldCall = !!(gmbServices?.canModifyServiceList && companyData?.gmb_place_type?.trim());
    if (shouldCall) {
      onLoadAvailableServices(companyData!.gmb_place_type!.trim());
    }
  }, [gmbServices?.canModifyServiceList, companyData?.gmb_place_type, onLoadAvailableServices]);

  const handleSaveServices = async () => {
    try {
      const structuredItems = Array.from(selectedServiceIds).map((id) => ({
        structuredServiceItem: { serviceTypeId: id },
      }));
      const payload = [...structuredItems, ...freeFormItems];
      await onServicesUpdate(payload);
      toast({ title: "Serviços atualizados com sucesso." });
      onLoadServices();
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao atualizar serviços", description: getErrorMessage(err) });
    }
  };

  const profile = gmbProfile as GmbProfile | null;
  const title = profile?.title ?? companyData?.nome_fantasia ?? "Sua Empresa";
  const phone = profile?.phoneNumbers?.primaryPhone ?? companyData?.celular_atendimento ?? "";
  const address = formatAddress(profile?.storefrontAddress) || formatAddressFromCompany(companyData) || "—";
  const website = profile?.websiteUri ?? companyData?.site_oficial ?? "";
  const description = profile?.profile?.description ?? "";
  const mapsUri = profile?.metadata?.mapsUri ?? "";

  const mediaItems = Array.isArray(gmbMediaItems) ? gmbMediaItems : [];
  const coverImage = mediaItems.find(
    (m: { locationAssociation?: { category?: string } }) => m?.locationAssociation?.category === "COVER"
  ) as { thumbnailUrl?: string; sourceUrl?: string } | undefined;
  const coverSrc = coverImage?.thumbnailUrl ?? coverImage?.sourceUrl ?? "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400";

  const openEdit = () => {
    setEditTitle(title);
    setEditPhone(phone);
    setEditAddress(address);
    setEditWebsite(website);
    setEditDescription(description);
    setProfileEditOpen(true);
  };

  const handleSaveProfile = async () => {
    try {
      const updates: Record<string, unknown> = {};
      if (editTitle.trim()) updates.title = editTitle.trim();
      if (editPhone.trim()) updates.phoneNumbers = { primaryPhone: editPhone.trim() };
      if (editWebsite.trim()) updates.websiteUri = editWebsite.trim();
      if (editDescription.trim()) updates.profile = { description: editDescription.trim() };
      if (Object.keys(updates).length === 0) return;
      await onProfileUpdate(updates);
      toast({ title: "Perfil atualizado com sucesso." });
      setProfileEditOpen(false);
      onLoadProfile();
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: getErrorMessage(err) });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveCompanyId) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Selecione uma imagem (JPG ou PNG)." });
      return;
    }
    await onMediaUpload(file, "ADDITIONAL");
    e.target.value = "";
  };

  if (!effectiveCompanyId) {
    return (
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <p className="text-sm text-muted-foreground">
          Selecione uma empresa para gerenciar o perfil do Google Meu Negócio.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      <div className="lg:col-span-2 space-y-6">
        <Accordion type="single" collapsible defaultValue="perfil" className="w-full">
          <AccordionItem value="perfil">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Perfil no Google
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {gmbProfileLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Edite nome, telefone, site e descrição do perfil no Google Business.
                  </p>
                  <Button onClick={openEdit} variant="outline" size="sm">
                    Editar perfil
                  </Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="imagens">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <ImagePlus className="w-4 h-4" />
                Imagens do perfil
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {gmbMediaLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Adicione fotos de capa ou galeria. A imagem precisa estar em uma URL pública.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={gmbMediaUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {gmbMediaUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Enviar imagem"
                    )}
                  </Button>
                  {mediaItems.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {mediaItems.slice(0, 8).map((m: { thumbnailUrl?: string; sourceUrl?: string; name?: string }, i: number) => (
                        <div key={m?.name ?? i} className="aspect-square rounded-lg overflow-hidden bg-muted">
                          <img
                            src={m?.thumbnailUrl ?? m?.sourceUrl ?? ""}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="servicos">
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Serviços
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {gmbServicesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {gmbServices?.canModifyServiceList
                      ? "Marque os serviços oferecidos no seu perfil e clique em Salvar."
                      : "A gestão de serviços não está disponível para sua categoria de negócio."}
                  </p>
                  {gmbServices?.canModifyServiceList ? (
                    <>
                      {gmbAvailableServicesLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : effectiveServiceTypes.length > 0 ? (
                        <div className="space-y-3">
                          {effectiveServiceTypes.map((svc) => {
                            const label = svc.displayName ?? formatServiceTypeDisplayName(svc.serviceTypeId);
                            const isChecked = selectedServiceIds.has(svc.serviceTypeId);
                            return (
                              <div key={svc.serviceTypeId} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                                <span className="text-sm font-medium">{label}</span>
                                <Switch
                                  checked={isChecked}
                                  onCheckedChange={(checked) =>
                                    setSelectedServiceIds((prev) => {
                                      const next = new Set(prev);
                                      if (checked) next.add(svc.serviceTypeId);
                                      else next.delete(svc.serviceTypeId);
                                      return next;
                                    })
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhum serviço disponível para esta categoria. Cadastre a categoria GMB em Configurações &gt; Integrações &gt; Google Meu Negócio.
                        </p>
                      )}
                      {effectiveServiceTypes.length > 0 && (
                        <Button
                          size="sm"
                          disabled={gmbServicesUpdating || !onServicesUpdate}
                          onClick={handleSaveServices}
                        >
                          {gmbServicesUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar serviços"}
                        </Button>
                      )}
                    </>
                  ) : (
                    gmbServices &&
                    gmbServices.serviceItems.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                        {gmbServices.serviceItems.map((item: unknown, i: number) => {
                          const s = item as {
                            structuredServiceItem?: { serviceTypeId?: string };
                            freeFormServiceItem?: { label?: { displayName?: string } };
                          };
                          const raw =
                            s?.structuredServiceItem?.serviceTypeId ??
                            s?.freeFormServiceItem?.label?.displayName ??
                            `Serviço ${i + 1}`;
                          const name = s?.structuredServiceItem?.serviceTypeId
                            ? formatServiceTypeDisplayName(raw)
                            : raw;
                          return <li key={i}>{name}</li>;
                        })}
                      </ul>
                    )
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <Card className="h-fit overflow-hidden border-border">
        <div className={cn("h-32 bg-cover bg-center", !coverSrc && "bg-muted")} style={{ backgroundImage: coverSrc ? `url(${coverSrc})` : undefined }} />
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="font-black text-foreground">{title}</h3>
            <p className="text-xs text-accent font-bold">
              {reviewsAverageRating != null ? `${reviewsAverageRating.toFixed(1)} ★` : ""} {reviewsTotalCount != null ? `(${reviewsTotalCount} reviews)` : ""}
            </p>
          </div>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{address}</span>
            </div>
            {phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0" />
                <span>{phone}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-4">
            {mapsUri && (
              <a
                href={mapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-[10px] font-bold p-2 bg-muted hover:bg-muted/80 rounded uppercase border border-border transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-3 h-3" />
                Ver no Maps
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={profileEditOpen} onOpenChange={setProfileEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar perfil no Google</DialogTitle>
            <DialogDescription>
              As alterações serão enviadas ao Google Business Profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-title">Nome</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input id="edit-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-website">Site</Label>
              <Input id="edit-website" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://" />
            </div>
            <div>
              <Label htmlFor="edit-desc">Descrição</Label>
              <Textarea id="edit-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveProfile()} disabled={gmbProfileUpdating}>
              {gmbProfileUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
