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
      
      // Handle both array response and object with customers array
      if (Array.isArray(result)) {
        return result as ExternalLMSCustomer[];
      }
      if (result.customers && Array.isArray(result.customers)) {
        return result.customers as ExternalLMSCustomer[];
      }
      if (result.data && Array.isArray(result.data)) {
        return result.data as ExternalLMSCustomer[];
      }
      
      return [] as ExternalLMSCustomer[];
    },
    staleTime: 30000, // 30 seconds
  });
}
