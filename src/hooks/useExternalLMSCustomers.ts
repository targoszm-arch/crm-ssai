import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExternalLMSCustomer {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  company_size?: string;
  use_case?: string;
  learning_objectives?: string;
  marketing_consent?: boolean;
  verified?: boolean;
  created_at?: string;
  credits_used?: number;
  credits_total?: number;
  plan?: string;
  signup_type?: string;
  status?: string; // e.g. "active", "trial", "expired"
}

interface FetchParams {
  since?: string;
  signupType?: string;
  marketing?: boolean;
  verified?: boolean;
  limit?: number;
  offset?: number;
}

export function useExternalLMSCustomers(params: FetchParams = {}) {
  return useQuery({
    queryKey: ['external-lms-customers', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.since) queryParams.set('since', params.since);
      if (params.signupType) queryParams.set('signup_type', params.signupType);
      if (params.marketing !== undefined) queryParams.set('marketing', String(params.marketing));
      if (params.verified !== undefined) queryParams.set('verified', String(params.verified));
      if (params.limit) queryParams.set('limit', String(params.limit));
      if (params.offset) queryParams.set('offset', String(params.offset));

      // Get auth session for authorization header
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/fetch-lms-customers?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch LMS customers');
      }

      const result = await response.json();

      // The LMS crm-customers endpoint may return a bare array, { customers }, or { data }.
      const raw: any[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.customers)
        ? result.customers
        : Array.isArray(result?.data)
        ? result.data
        : [];

      // Normalize the LMS payload field names to this interface (the API uses
      // user_id / role_type / marketing_emails_consent / used_credits / etc.).
      return raw.map((c: any): ExternalLMSCustomer => ({
        id: c.user_id ?? c.id ?? c.email,
        email: c.email,
        full_name: c.full_name,
        role: c.role_type ?? c.role,
        company_size: c.company_size,
        use_case: c.use_case,
        learning_objectives: c.learning_objective ?? c.learning_objectives,
        marketing_consent: c.marketing_emails_consent ?? c.marketing_consent,
        verified: c.email_verified ?? c.verified,
        created_at: c.created_at,
        credits_used: c.used_credits ?? c.credits_used,
        credits_total: c.total_credits ?? c.credits_total,
        plan: c.billing_plan ?? c.plan,
        signup_type: c.signup_type,
        status: c.status,
      }));
    },
    staleTime: 30000, // 30 seconds
  });
}
