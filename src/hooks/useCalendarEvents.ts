import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CalendarEvent = Tables<"calendar_events">;

export function useCalendarEvents(accountId?: string, startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ["calendar-events", accountId, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("calendar_events")
        .select("*, contacts(first_name, last_name, email), companies(company_name)")
        .order("start_time", { ascending: true });

      if (accountId) {
        query = query.eq("account_id", accountId);
      }

      if (startDate) {
        query = query.gte("start_time", startDate.toISOString());
      }

      if (endDate) {
        query = query.lte("start_time", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
}

export function useSyncCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-calendar", {
        body: { accountId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventData: {
      accountId: string;
      title: string;
      description?: string;
      location?: string;
      startTime: string;
      endTime: string;
      allDay?: boolean;
      attendees?: string[];
      contactId?: string;
      companyId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("create-calendar-event", {
        body: eventData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      eventId: string;
      accountId: string;
      updates: {
        title?: string;
        description?: string;
        location?: string;
        startTime?: string;
        endTime?: string;
        allDay?: boolean;
        attendees?: string[];
      };
    }) => {
      const { data, error } = await supabase.functions.invoke("update-calendar-event", {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { eventId: string; accountId: string; googleEventId: string }) => {
      const { data, error } = await supabase.functions.invoke("update-calendar-event", {
        body: { ...params, delete: true },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
