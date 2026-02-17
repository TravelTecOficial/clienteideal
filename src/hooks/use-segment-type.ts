import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useSupabaseClient } from "@/lib/supabase-context";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ProfileRow {
  company_id: string | null;
}

interface CompanySegmentRow {
  segment_type: string | null;
}

async function fetchSegmentType(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return "produtos";
  }

  const companyId = (profile as ProfileRow).company_id;
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
  const [segmentType, setSegmentType] = useState<string>("produtos");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      setSegmentType("produtos");
      return;
    }
    setIsLoading(true);
    try {
      const value = await fetchSegmentType(supabase, userId);
      setSegmentType(value);
    } catch {
      setSegmentType("produtos");
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

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
