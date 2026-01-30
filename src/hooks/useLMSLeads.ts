import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LMSLead {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string | null;
  company_size: string | null;
  use_case: string | null;
  learning_objectives: string | null;
  marketing_consent: boolean;
  verified: boolean;
  lms_created_at: string | null;
  credits_used: number;
  credits_total: number;
  plan: string | null;
  lms_user_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export function useLMSLeads() {
  return useQuery({
    queryKey: ["lms-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LMSLead[];
    },
  });
}

export function useLMSLeadsByContact(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ["lms-leads", "contact", contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from("lms_leads")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LMSLead[];
    },
    enabled: !!contactId,
  });
}

export function useLMSLeadsByCompany(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["lms-leads", "company", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("lms_leads")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LMSLead[];
    },
    enabled: !!companyId,
  });
}

export function useLMSLeadByEmail(email: string | null | undefined) {
  return useQuery({
    queryKey: ["lms-leads", "email", email],
    queryFn: async () => {
      if (!email) return null;

      const { data, error } = await supabase
        .from("lms_leads")
        .select("*")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (error) throw error;
      return data as LMSLead | null;
    },
    enabled: !!email,
  });
}
