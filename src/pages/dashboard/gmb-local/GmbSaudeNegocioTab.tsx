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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MapPin, Phone, Loader2, ImagePlus, Pencil, ExternalLink, Briefcase, Clock, Trash2 } from "lucide-react";
import { getErrorMessage, cn } from "@/lib/utils";
import type { CompanyData } from "./types";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  MONDAY: "Segunda",
  TUESDAY: "Terça",
  WEDNESDAY: "Quarta",
  THURSDAY: "Quinta",
  FRIDAY: "Sexta",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

type OpenInfoStatus = "OPEN" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";

interface TimeOfDay {
  hours: number;
  minutes: number;
}

interface GmbProfile {
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  profile?: { description?: string };
  regularHours?: { periods?: { openDay: string; openTime?: TimeOfDay; closeDay: string; closeTime?: TimeOfDay }[] };
  openInfo?: { status?: OpenInfoStatus };
  serviceArea?: { businessType?: string; regionCode?: string };
  metadata?: { mapsUri?: string; placeId?: string };
}

interface GmbSaudeNegocioTabProps {
  companyData: CompanyData | null;
  effectiveCompanyId: string | null;
  getToken: () => Promise<string | null>;
  supabase: ReturnType<typeof import("@/lib/supabase-context").useSupabaseClient>;
  gmbProfile: GmbProfile | Record<string, unknown> | null;
  gmbProfileLoading: boolean;
  gmbProfileError?: string | null;
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

function timeToStr(t?: TimeOfDay): string {
  if (!t) return "";
  const h = String(t.hours).padStart(2, "0");
  const m = String(t.minutes).padStart(2, "0");
  return `${h}:${m}`;
}

function strToTime(s: string): TimeOfDay | undefined {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const h = Math.min(23, Math.max(0, parseInt(m[1]!, 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2]!, 10)));
  return { hours: h, minutes: min };
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
  gmbProfileError,
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
  const [editTitle, setEditTitle] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddressLine1, setEditAddressLine1] = useState("");
  const [editAddressLine2, setEditAddressLine2] = useState("");
  const [editLocality, setEditLocality] = useState("");
  const [editAdministrativeArea, setEditAdministrativeArea] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editRegionCode, setEditRegionCode] = useState("BR");
  const [editWebsite, setEditWebsite] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editOpenInfo, setEditOpenInfo] = useState<OpenInfoStatus>("OPEN");
  const [editHours, setEditHours] = useState<Record<string, { open: string; close: string }>>({});
  const [editServiceAreaType, setEditServiceAreaType] = useState<string>("");
  const [editServiceAreaRegion, setEditServiceAreaRegion] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [serviceDescriptions, setServiceDescriptions] = useState<Record<string, string>>({});
  const [servicePrices, setServicePrices] = useState<Record<string, { type: "none" | "fixed"; value?: string }>>({});
  const [serviceDescriptionModal, setServiceDescriptionModal] = useState<{ serviceTypeId: string; displayName: string } | null>(null);
  const [serviceDescriptionDraft, setServiceDescriptionDraft] = useState("");
  const [servicePriceTypeDraft, setServicePriceTypeDraft] = useState<"none" | "fixed">("none");
  const [servicePriceValueDraft, setServicePriceValueDraft] = useState("");
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

  /** Sincroniza formulário de perfil com dados do GMB ou companyData quando carregados. */
  useEffect(() => {
    const p = gmbProfile as GmbProfile | null;
    setEditTitle(p?.title ?? companyData?.nome_fantasia ?? "");
    setEditPhone(p?.phoneNumbers?.primaryPhone ?? companyData?.celular_atendimento ?? "");
    const addr = p?.storefrontAddress;
    setEditAddressLine1(addr?.addressLines?.[0] ?? "");
    setEditAddressLine2(addr?.addressLines?.[1] ?? "");
    setEditLocality(addr?.locality ?? companyData?.cidade ?? "");
    setEditAdministrativeArea(addr?.administrativeArea ?? companyData?.uf ?? "");
    setEditPostalCode(addr?.postalCode ?? companyData?.cep ?? "");
    setEditRegionCode(addr?.regionCode ?? "BR");
    setEditWebsite(p?.websiteUri ?? companyData?.site_oficial ?? "");
    setEditDescription(p?.profile?.description ?? "");
    setEditOpenInfo((p?.openInfo?.status as OpenInfoStatus) ?? "OPEN");
    const hours: Record<string, { open: string; close: string }> = {};
    for (const d of DAYS) hours[d] = { open: "", close: "" };
    for (const period of p?.regularHours?.periods ?? []) {
      const day = period.openDay ?? period.closeDay;
      if (day && DAYS.includes(day as (typeof DAYS)[number])) {
        hours[day] = {
          open: timeToStr(period.openTime),
          close: timeToStr(period.closeTime),
        };
      }
    }
    setEditHours(hours);
    const sa = p?.serviceArea;
    setEditServiceAreaType(sa?.businessType ?? "");
    setEditServiceAreaRegion(sa?.regionCode ?? "");
  }, [gmbProfile, companyData]);

  /** Sincroniza descrições e preços dos serviços vindas da API. */
  useEffect(() => {
    if (!gmbServices?.serviceItems?.length) return;
    const nextDesc: Record<string, string> = {};
    const nextPrice: Record<string, { type: "none" | "fixed"; value?: string }> = {};
    for (const item of gmbServices.serviceItems) {
      const s = item as {
        price?: { currencyCode?: string; units?: string; nanos?: number };
        structuredServiceItem?: { serviceTypeId?: string; description?: string };
      };
      const sid = s?.structuredServiceItem?.serviceTypeId;
      if (!sid) continue;
      const desc = s?.structuredServiceItem?.description?.trim();
      if (desc) nextDesc[sid] = desc;
      const price = s?.price;
      if (price?.units != null && (price.units !== "0" || (price.nanos ?? 0) > 0)) {
        const units = parseInt(price.units, 10) || 0;
        const nanos = price.nanos ?? 0;
        const val = nanos > 0 ? `${units}.${String(Math.round(nanos / 1e7)).padStart(2, "0")}` : String(units);
        nextPrice[sid] = { type: "fixed", value: val };
      } else {
        nextPrice[sid] = { type: "none" };
      }
    }
    setServiceDescriptions((prev) => ({ ...prev, ...nextDesc }));
    setServicePrices((prev) => ({ ...prev, ...nextPrice }));
  }, [gmbServices?.serviceItems]);

  useEffect(() => {
    const shouldCall = !!(gmbServices?.canModifyServiceList && companyData?.gmb_place_type?.trim());
    if (shouldCall) {
      onLoadAvailableServices(companyData!.gmb_place_type!.trim());
    }
  }, [gmbServices?.canModifyServiceList, companyData?.gmb_place_type, onLoadAvailableServices]);

  const handleSaveServices = async () => {
    try {
      const structuredItems = Array.from(selectedServiceIds).map((id) => {
        const desc = serviceDescriptions[id]?.trim();
        const priceState = servicePrices[id] ?? { type: "none" as const };
        const base = {
          structuredServiceItem: desc
            ? { serviceTypeId: id, description: desc }
            : { serviceTypeId: id },
        };
        if (priceState.type === "fixed" && priceState.value?.trim()) {
          const parsed = parseFloat(priceState.value.replace(",", "."));
          if (!Number.isNaN(parsed) && parsed >= 0) {
            const units = Math.floor(parsed);
            const nanos = Math.round((parsed - units) * 1e9);
            (base as Record<string, unknown>).price = {
              currencyCode: "BRL",
              units: String(units),
              nanos,
            };
          }
        }
        return base;
      });
      const payload = [...structuredItems, ...freeFormItems];
      await onServicesUpdate(payload);
      toast({ title: "Serviços atualizados com sucesso." });
      onLoadServices();
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao atualizar serviços", description: getErrorMessage(err) });
    }
  };

  const openServiceDescriptionModal = (svc: { serviceTypeId: string; displayName?: string }) => {
    const displayName = svc.displayName ?? formatServiceTypeDisplayName(svc.serviceTypeId);
    setServiceDescriptionModal({ serviceTypeId: svc.serviceTypeId, displayName });
    setServiceDescriptionDraft(serviceDescriptions[svc.serviceTypeId] ?? "");
    const priceState = servicePrices[svc.serviceTypeId] ?? { type: "none" as const };
    setServicePriceTypeDraft(priceState.type);
    setServicePriceValueDraft(priceState.value ?? "");
  };

  const handleSaveServiceDescription = () => {
    if (!serviceDescriptionModal) return;
    const trimmed = serviceDescriptionDraft.trim().slice(0, 300);
    setServiceDescriptions((prev) => ({ ...prev, [serviceDescriptionModal.serviceTypeId]: trimmed }));
    const priceType = servicePriceTypeDraft;
    const priceVal = servicePriceTypeDraft === "fixed" && servicePriceValueDraft.trim() ? servicePriceValueDraft.trim() : undefined;
    setServicePrices((prev) => ({
      ...prev,
      [serviceDescriptionModal.serviceTypeId]: { type: priceType, value: priceVal },
    }));
    setServiceDescriptionModal(null);
  };

  const handleDeleteService = () => {
    if (!serviceDescriptionModal) return;
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      next.delete(serviceDescriptionModal.serviceTypeId);
      return next;
    });
    setServiceDescriptions((prev) => {
      const { [serviceDescriptionModal.serviceTypeId]: _, ...rest } = prev;
      return rest;
    });
    setServicePrices((prev) => {
      const { [serviceDescriptionModal.serviceTypeId]: _, ...rest } = prev;
      return rest;
    });
    setServiceDescriptionModal(null);
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

  const handleSaveProfile = async () => {
    try {
      const updates: Record<string, unknown> = {};
      if (editTitle.trim()) updates.title = editTitle.trim();
      if (editPhone.trim()) updates.phoneNumbers = { primaryPhone: editPhone.trim() };
      if (editWebsite.trim()) updates.websiteUri = editWebsite.trim();
      if (editDescription.trim()) updates.profile = { description: editDescription.trim() };

      const addressLines: string[] = [];
      if (editAddressLine1.trim()) addressLines.push(editAddressLine1.trim());
      if (editAddressLine2.trim()) addressLines.push(editAddressLine2.trim());
      if (addressLines.length > 0 || editLocality.trim() || editAdministrativeArea.trim() || editPostalCode.trim()) {
        updates.storefrontAddress = {
          ...(addressLines.length > 0 && { addressLines }),
          ...(editLocality.trim() && { locality: editLocality.trim() }),
          ...(editAdministrativeArea.trim() && { administrativeArea: editAdministrativeArea.trim() }),
          ...(editPostalCode.trim() && { postalCode: editPostalCode.trim() }),
          regionCode: editRegionCode.trim() || "BR",
        };
      }

      updates.openInfo = { status: editOpenInfo };

      const periods: { openDay: string; openTime?: TimeOfDay; closeDay: string; closeTime?: TimeOfDay }[] = [];
      for (const day of DAYS) {
        const row = editHours[day];
        if (!row) continue;
        const openT = strToTime(row.open);
        const closeT = strToTime(row.close);
        if (openT && closeT) {
          periods.push({ openDay: day, openTime: openT, closeDay: day, closeTime: closeT });
        }
      }
      if (periods.length > 0) updates.regularHours = { periods };

      if (editServiceAreaType.trim()) {
        updates.serviceArea = {
          businessType: editServiceAreaType.trim(),
          ...(editServiceAreaRegion.trim() && { regionCode: editServiceAreaRegion.trim() }),
        };
      }

      if (Object.keys(updates).length === 0) return;
      await onProfileUpdate(updates);
      toast({ title: "Perfil atualizado com sucesso." });
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
        {gmbProfileError && (
          <Alert variant="destructive">
            <AlertTitle>Erro ao carregar perfil</AlertTitle>
            <AlertDescription>{gmbProfileError}</AlertDescription>
          </Alert>
        )}
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveProfile();
                  }}
                  className="space-y-6"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="edit-title">Nome do negócio</Label>
                      <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Ex: Loja Exemplo" />
                    </div>
                    <div>
                      <Label htmlFor="edit-phone">Telefone</Label>
                      <Input id="edit-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(11) 99999-9999" />
                    </div>
                    <div>
                      <Label htmlFor="edit-website">Site</Label>
                      <Input id="edit-website" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Endereço
                    </h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="edit-addr1">Logradouro</Label>
                        <Input id="edit-addr1" value={editAddressLine1} onChange={(e) => setEditAddressLine1(e.target.value)} placeholder="Rua, número" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="edit-addr2">Complemento (opcional)</Label>
                        <Input id="edit-addr2" value={editAddressLine2} onChange={(e) => setEditAddressLine2(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="edit-locality">Cidade</Label>
                        <Input id="edit-locality" value={editLocality} onChange={(e) => setEditLocality(e.target.value)} placeholder="São Paulo" />
                      </div>
                      <div>
                        <Label htmlFor="edit-admin">Estado (UF)</Label>
                        <Input id="edit-admin" value={editAdministrativeArea} onChange={(e) => setEditAdministrativeArea(e.target.value)} placeholder="SP" maxLength={2} />
                      </div>
                      <div>
                        <Label htmlFor="edit-postal">CEP</Label>
                        <Input id="edit-postal" value={editPostalCode} onChange={(e) => setEditPostalCode(e.target.value)} placeholder="01234-567" />
                      </div>
                      <div>
                        <Label htmlFor="edit-region">Código do país</Label>
                        <Input id="edit-region" value={editRegionCode} onChange={(e) => setEditRegionCode(e.target.value)} placeholder="BR" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Horário de funcionamento
                    </h4>
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-2 font-medium">Dia</th>
                            <th className="text-left p-2 font-medium">Abertura</th>
                            <th className="text-left p-2 font-medium">Fechamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS.map((day) => (
                            <tr key={day} className="border-t border-border">
                              <td className="p-2">{DAY_LABELS[day]}</td>
                              <td className="p-2">
                                <Input
                                  type="time"
                                  className="h-8 w-28"
                                  value={editHours[day]?.open ?? ""}
                                  onChange={(e) =>
                                    setEditHours((prev) => ({
                                      ...prev,
                                      [day]: { ...prev[day], open: e.target.value, close: prev[day]?.close ?? "" },
                                    }))
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="time"
                                  className="h-8 w-28"
                                  value={editHours[day]?.close ?? ""}
                                  onChange={(e) =>
                                    setEditHours((prev) => ({
                                      ...prev,
                                      [day]: { open: prev[day]?.open ?? "", ...prev[day], close: e.target.value },
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Status do negócio</Label>
                    <Select value={editOpenInfo} onValueChange={(v) => setEditOpenInfo(v as OpenInfoStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">Aberto</SelectItem>
                        <SelectItem value="CLOSED_TEMPORARILY">Fechado temporariamente</SelectItem>
                        <SelectItem value="CLOSED_PERMANENTLY">Fechado permanentemente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Área de atendimento</h4>
                    <p className="text-xs text-muted-foreground">
                      Para negócios que atendem no local do cliente (ex: encanador, eletricista).
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="edit-sa-type">Tipo</Label>
                        <Select value={editServiceAreaType || "none"} onValueChange={(v) => setEditServiceAreaType(v === "none" ? "" : v)}>
                          <SelectTrigger id="edit-sa-type">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            <SelectItem value="CUSTOMER_LOCATION_ONLY">Somente no local do cliente</SelectItem>
                            <SelectItem value="CUSTOMER_AND_BUSINESS_LOCATION">Cliente e endereço fixo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="edit-sa-region">Código da região</Label>
                        <Input id="edit-sa-region" value={editServiceAreaRegion} onChange={(e) => setEditServiceAreaRegion(e.target.value)} placeholder="BR" disabled={!editServiceAreaType} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit-desc">Descrição</Label>
                    <Textarea id="edit-desc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} placeholder="Descreva seu negócio..." className="mt-2" />
                  </div>

                  <Button type="submit" disabled={gmbProfileUpdating}>
                    {gmbProfileUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar perfil"}
                  </Button>
                </form>
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
                      ? "Marque os serviços oferecidos, clique no ícone de lápis para adicionar um texto em cada um e depois em Salvar."
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
                            const hasDesc = Boolean(serviceDescriptions[svc.serviceTypeId]?.trim());
                            return (
                              <div
                                key={svc.serviceTypeId}
                                className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
                              >
                                <div className="flex flex-1 min-w-0 items-center gap-2">
                                  <span className="text-sm font-medium">{label}</span>
                                  <button
                                    type="button"
                                    onClick={() => openServiceDescriptionModal(svc)}
                                    className={cn(
                                      "shrink-0 rounded p-1 transition-colors",
                                      hasDesc
                                        ? "text-primary hover:bg-primary/10"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                    title={hasDesc ? "Editar descrição" : "Adicionar descrição"}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  {hasDesc && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={serviceDescriptions[svc.serviceTypeId]}>
                                      {(() => {
                                        const d = serviceDescriptions[svc.serviceTypeId] ?? "";
                                        return d.length > 35 ? `${d.slice(0, 35)}…` : d;
                                      })()}
                                    </span>
                                  )}
                                </div>
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

      <Dialog
        open={!!serviceDescriptionModal}
        onOpenChange={(open) => !open && setServiceDescriptionModal(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar serviço</DialogTitle>
            {serviceDescriptionModal && (
              <div className="space-y-1 pt-1">
                <Label className="text-muted-foreground font-normal">Serviço</Label>
                <p className="text-base font-medium">{serviceDescriptionModal.displayName}</p>
              </div>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Preço</Label>
              <div className="flex gap-2">
                <Select value={servicePriceTypeDraft} onValueChange={(v) => setServicePriceTypeDraft(v as "none" | "fixed")}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem preço</SelectItem>
                    <SelectItem value="fixed">Preço fixo</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Preço do serviço (BRL)"
                  value={servicePriceValueDraft}
                  onChange={(e) => setServicePriceValueDraft(e.target.value.replace(/[^0-9,.]/g, ""))}
                  disabled={servicePriceTypeDraft === "none"}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-desc">Descrição do serviço</Label>
              <Textarea
                id="service-desc"
                value={serviceDescriptionDraft}
                onChange={(e) => setServiceDescriptionDraft(e.target.value.slice(0, 300))}
                placeholder="Ex: A melhor solução para e-mail marketing."
                rows={4}
                maxLength={300}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {serviceDescriptionDraft.length}/300 caracteres
              </p>
            </div>

            <button
              type="button"
              onClick={handleDeleteService}
              className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/90 hover:underline"
            >
              <Trash2 className="w-4 h-4" />
              Excluir serviço
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDescriptionModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveServiceDescription}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
