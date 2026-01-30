import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Email {
  id: string;
  account_id: string;
  gmail_id: string;
  thread_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  deal_id?: string | null;
  subject: string | null;
  snippet: string | null;
  body_html: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: string[] | null;
  received_at: string;
  is_read: boolean;
  direction: string;
  labels: string[] | null;
  folder: string | null;
  email_labels: string | null;
  is_tracked: boolean | null;
  open_count: number | null;
  click_count: number | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  has_attachments: boolean | null;
  created_at: string;
  updated_at: string;
  contacts?: {
    first_name: string;
    last_name: string | null;
  } | null;
}

export interface EmailFilters {
  accountId?: string;
  contactId?: string;
  companyId?: string;
  linkedOnly?: boolean;
  search?: string;
  folder?: string;
}

export function useEmails(filters: EmailFilters = {}) {
  const queryClient = useQueryClient();

  // Set up realtime subscription for emails table
  useEffect(() => {
    const channel = supabase
      .channel('emails-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emails',
        },
        (payload) => {
          console.log('Realtime email update:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["emails"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["emails", filters],
    queryFn: async () => {
      let query = supabase
        .from("emails")
        .select(`
          *,
          contacts (
            first_name,
            last_name
          )
        `)
        .order("received_at", { ascending: false })
        .limit(100);

      if (filters.accountId) {
        query = query.eq("account_id", filters.accountId);
      }

      if (filters.contactId) {
        query = query.eq("contact_id", filters.contactId);
      }

      if (filters.companyId) {
        query = query.eq("company_id", filters.companyId);
      }

      if (filters.linkedOnly) {
        query = query.not("contact_id", "is", null);
      }

      if (filters.search) {
        query = query.or(`subject.ilike.%${filters.search}%,snippet.ilike.%${filters.search}%,from_email.ilike.%${filters.search}%`);
      }

      if (filters.folder) {
        query = query.eq("folder", filters.folder);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Email[];
    },
  });
}

export function useEmailsByContact(contactId: string | null) {
  return useQuery({
    queryKey: ["contact-emails", contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("contact_id", contactId!)
        .order("received_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Email[];
    },
  });
}

export function useSyncEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      accountId, 
      maxResults = 2000,
      daysBack = 100 
    }: { 
      accountId: string; 
      maxResults?: number;
      daysBack?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("sync-emails", {
        body: { accountId, maxResults, daysBack },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      to,
      subject,
      body,
      contactId,
      isTracked = false,
    }: {
      accountId: string;
      to: string[];
      subject: string;
      body: string;
      contactId?: string;
      isTracked?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { accountId, to, subject, body, contactId, isTracked },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}

export function useLinkEmailToContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ emailId, contactId }: { emailId: string; contactId: string | null }) => {
      const { error } = await supabase
        .from("emails")
        .update({ contact_id: contactId })
        .eq("id", emailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["contact-emails"] });
    },
  });
}

export function useMarkEmailRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ emailId, isRead }: { emailId: string; isRead: boolean }) => {
      const { data, error } = await supabase.functions.invoke("mark-email-read", {
        body: { emailId, isRead },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["contact-emails"] });
    },
  });
}

export function useBulkMarkEmailsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ emailIds, isRead }: { emailIds: string[]; isRead: boolean }) => {
      const { error } = await supabase
        .from("emails")
        .update({ is_read: isRead })
        .in("id", emailIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["contact-emails"] });
    },
  });
}

export function useUpdateEmailLabels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ emailId, labels }: { emailId: string; labels: string }) => {
      const { error } = await supabase
        .from("emails")
        .update({ email_labels: labels })
        .eq("id", emailId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}

export function useArchiveEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ emailIds }: { emailIds: string[] }) => {
      const { error } = await supabase
        .from("emails")
        .update({ folder: "archive" })
        .in("id", emailIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}
