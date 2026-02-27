import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useSupabaseClient } from "@/lib/supabase-context";
import { useCompanyPreview } from "@/lib/company-preview-context";
import { getAdminPreviewCompanyId } from "@/lib/admin-preview-storage";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ProfileRow {
  company_id: string | null;
}

interface CompanySegmentRow {
  segment_type: string | null;
}

async function fetchSegmentType(
  supabase: SupabaseClient,
  userId: string,
  overrideCompanyId: string | null
): Promise<string> {
  let companyId: string | null = overrideCompanyId;

  if (!companyId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return "produtos";
    }

    companyId = (profile as ProfileRow).company_id;
  }

  if (!companyId) {
    return "produtos";
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("segment_type")
    .eq("id", companyId)
    .maybeSingle();

  if (companyError || !company) {
    return "produtos";
  }

  const segmentType = (company as CompanySegmentRow).segment_type;
  return segmentType === "consorcio" ? "consorcio" : "produtos";
}

export function useSegmentType(): { segmentType: string; isLoading: boolean } {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();
  const { companyId: previewCompanyId } = useCompanyPreview();
  const storagePreviewId = getAdminPreviewCompanyId();
  const effectivePreviewId = previewCompanyId ?? storagePreviewId;
  const [segmentType, setSegmentType] = useState<string>("produtos");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId && !effectivePreviewId) {
      setIsLoading(false);
      setSegmentType("produtos");
      return;
    }
    setIsLoading(true);
    try {
      const value = await fetchSegmentType(supabase, userId ?? "", effectivePreviewId);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/bc96f30d-a63c-4828-beaf-5cec801979c8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ad401'},body:JSON.stringify({sessionId:'8ad401',runId:'cliente-ideal-pre-fix',hypothesisId:'H5',location:'use-segment-type.ts:load',message:'Resolved segment type',data:{userId,effectivePreviewId,value,path:typeof window!=='undefined'?window.location.pathname:null,search:typeof window!=='undefined'?window.location.search:null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setSegmentType(value);
    } catch {
      setSegmentType("produtos");
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase, effectivePreviewId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("segment-type-changed", handler);
    return () => window.removeEventListener("segment-type-changed", handler);
  }, [load]);

  return { segmentType, isLoading };
}
