import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailAccount {
  id: string;
  user_id: string;
  provider: string;
  email_address: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmailAccounts() {
  return useQuery({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("id, user_id, provider, email_address, expires_at, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailAccount[];
    },
  });
}

export function useConnectGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, redirectUri }: { code: string; redirectUri: string }) => {
      const { data, error } = await supabase.functions.invoke("google-auth-callback", {
        body: { code, redirectUri },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
    },
  });
}

export function useDisconnectEmailAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from("email_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}
