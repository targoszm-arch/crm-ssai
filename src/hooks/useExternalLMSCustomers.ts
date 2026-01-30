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
}

interface FetchParams {
  since?: string;
  signupType?: string;
  marketing?: boolean;
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
      if (params.limit) queryParams.set('limit', String(params.limit));
      if (params.offset) queryParams.set('offset', String(params.offset));

      const { data, error } = await supabase.functions.invoke('fetch-lms-customers', {
        body: null,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // The function accepts query params via the URL, but we need to pass them differently
      // Using invoke with query string in the function name path
      const response = await fetch(
        `https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/fetch-lms-customers?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
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
