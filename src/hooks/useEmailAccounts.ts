import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailAccount {
  id: string;
  user_id: string;
  provider: string;
  email_address: string;
  expires_at: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmailAccounts() {
  return useQuery({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("id, user_id, provider, email_address, expires_at, last_sync_at, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailAccount[];
    },
  });
}

/**
 * Kicks off the Google OAuth consent screen. `google-auth-callback` upserts by
 * `email_address`, so this is also the reconnect path for an account whose refresh
 * token Google has rejected (invalid_grant) — it updates that same row's tokens in
 * place. `prompt=consent` forces Google to reissue a refresh_token even for an
 * account that already granted access once, which a plain re-auth would otherwise
 * skip, leaving the old (rejected) refresh_token in place.
 *
 * Deliberately NOT "disconnect then reconnect": `email_accounts` cascade-deletes
 * `emails` and `calendar_events` on delete, so disconnecting a broken account to
 * get the Connect button back would destroy every synced email and event for it.
 */
export async function startGoogleOAuth(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("get-google-config");
  if (error) throw new Error(error.message);
  if (!data.clientId || !data.redirectUri) {
    throw new Error("Invalid configuration received from server");
  }

  // gmail.modify (not gmail.readonly) -- marking a message read/unread is a
  // label change (removing/adding UNREAD), which readonly explicitly
  // forbids. Every mark-as-read call was failing with a 403 from Gmail
  // because the connected account only ever had readonly + send. modify is
  // a superset of readonly, so this isn't losing anything.
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/gmail.modify " +
    "https://www.googleapis.com/auth/gmail.send " +
    "https://www.googleapis.com/auth/userinfo.email " +
    "https://www.googleapis.com/auth/calendar " +
    "https://www.googleapis.com/auth/calendar.events"
  );
  const state = "inbox";
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${data.clientId}&redirect_uri=${encodeURIComponent(data.redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

  window.location.href = authUrl;
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
