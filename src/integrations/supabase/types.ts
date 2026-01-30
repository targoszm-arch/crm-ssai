export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          description: string | null
          id: string
          metadata: Json | null
          occurred_at: string | null
          source: string | null
          source_id: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          source?: string | null
          source_id?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          source?: string | null
          source_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          account_id: string | null
          all_day: boolean | null
          attendees: string[] | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          end_time: string
          google_event_id: string
          id: string
          location: string | null
          meeting_link: string | null
          start_time: string
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          all_day?: boolean | null
          attendees?: string[] | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          google_event_id: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          start_time: string
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          all_day?: boolean | null
          attendees?: string[] | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          google_event_id?: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          start_time?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience: string | null
          conversion_rate: number | null
          created_at: string | null
          id: string
          last_synced_at: string | null
          meetalfred_id: number | null
          name: string
          open_rate: number | null
          sent_count: number | null
          sequence_type: string | null
          status: string | null
          total_leads: number | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          audience?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          meetalfred_id?: number | null
          name: string
          open_rate?: number | null
          sent_count?: number | null
          sequence_type?: string | null
          status?: string | null
          total_leads?: number | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          audience?: string | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          meetalfred_id?: number | null
          name?: string
          open_rate?: number | null
          sent_count?: number | null
          sequence_type?: string | null
          status?: string | null
          total_leads?: number | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          annual_turnover: number | null
          categories: string | null
          client_id: string | null
          company_name: string
          connection_strength: string | null
          country: string | null
          created_at: string
          description: string | null
          domains: string | null
          done_activities: number | null
          email_messages_count: number | null
          employee_count: number | null
          employee_range: string | null
          estimated_arr: number | null
          foundation_date: string | null
          funding_raised: number | null
          id: string
          industry: string | null
          labels: string | null
          last_interaction: string | null
          linkedin_url: string | null
          next_activity_date: string | null
          people_count: number | null
          size: string | null
          stage: string | null
          twitter_followers: number | null
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          annual_turnover?: number | null
          categories?: string | null
          client_id?: string | null
          company_name: string
          connection_strength?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          domains?: string | null
          done_activities?: number | null
          email_messages_count?: number | null
          employee_count?: number | null
          employee_range?: string | null
          estimated_arr?: number | null
          foundation_date?: string | null
          funding_raised?: number | null
          id?: string
          industry?: string | null
          labels?: string | null
          last_interaction?: string | null
          linkedin_url?: string | null
          next_activity_date?: string | null
          people_count?: number | null
          size?: string | null
          stage?: string | null
          twitter_followers?: number | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          annual_turnover?: number | null
          categories?: string | null
          client_id?: string | null
          company_name?: string
          connection_strength?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          domains?: string | null
          done_activities?: number | null
          email_messages_count?: number | null
          employee_count?: number | null
          employee_range?: string | null
          estimated_arr?: number | null
          foundation_date?: string | null
          funding_raised?: number | null
          id?: string
          industry?: string | null
          labels?: string | null
          last_interaction?: string | null
          linkedin_url?: string | null
          next_activity_date?: string | null
          people_count?: number | null
          size?: string | null
          stage?: string | null
          twitter_followers?: number | null
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          avatar: string | null
          buying_signals: string | null
          company_id: string | null
          connection_strength: string | null
          created_at: string
          done_activities: number | null
          email: string | null
          email_messages_count: number | null
          facebook_url: string | null
          first_name: string
          function: string | null
          id: string
          instagram_url: string | null
          interest_level: string | null
          labels: string | null
          last_contacted: string | null
          last_email_received: string | null
          last_name: string | null
          linkedin_url: string | null
          lqs: number | null
          marketing_status: string | null
          name: string | null
          next_recommended_action: string | null
          next_to_contact: string | null
          notes: string | null
          pain_point: string | null
          phone: string | null
          seniority_level: string | null
          talent_partner_name: string | null
          title: string | null
          total_clicks: number | null
          total_emails_sent: number | null
          total_opens: number | null
          updated_at: string
          user_id: string | null
          video_link: string | null
          work_location: string | null
        }
        Insert: {
          avatar?: string | null
          buying_signals?: string | null
          company_id?: string | null
          connection_strength?: string | null
          created_at?: string
          done_activities?: number | null
          email?: string | null
          email_messages_count?: number | null
          facebook_url?: string | null
          first_name: string
          function?: string | null
          id?: string
          instagram_url?: string | null
          interest_level?: string | null
          labels?: string | null
          last_contacted?: string | null
          last_email_received?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          lqs?: number | null
          marketing_status?: string | null
          name?: string | null
          next_recommended_action?: string | null
          next_to_contact?: string | null
          notes?: string | null
          pain_point?: string | null
          phone?: string | null
          seniority_level?: string | null
          talent_partner_name?: string | null
          title?: string | null
          total_clicks?: number | null
          total_emails_sent?: number | null
          total_opens?: number | null
          updated_at?: string
          user_id?: string | null
          video_link?: string | null
          work_location?: string | null
        }
        Update: {
          avatar?: string | null
          buying_signals?: string | null
          company_id?: string | null
          connection_strength?: string | null
          created_at?: string
          done_activities?: number | null
          email?: string | null
          email_messages_count?: number | null
          facebook_url?: string | null
          first_name?: string
          function?: string | null
          id?: string
          instagram_url?: string | null
          interest_level?: string | null
          labels?: string | null
          last_contacted?: string | null
          last_email_received?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          lqs?: number | null
          marketing_status?: string | null
          name?: string | null
          next_recommended_action?: string | null
          next_to_contact?: string | null
          notes?: string | null
          pain_point?: string | null
          phone?: string | null
          seniority_level?: string | null
          talent_partner_name?: string | null
          title?: string | null
          total_clicks?: number | null
          total_emails_sent?: number | null
          total_opens?: number | null
          updated_at?: string
          user_id?: string | null
          video_link?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contacts_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          export_file_url: string | null
          id: string
          notes: string | null
          request_type: string
          requested_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          export_file_url?: string | null
          id?: string
          notes?: string | null
          request_type: string
          requested_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          export_file_url?: string | null
          id?: string
          notes?: string | null
          request_type?: string
          requested_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_name: string
          deal_value: number | null
          expected_close_date: string | null
          id: string
          industry: string | null
          labels: string | null
          lead_source: string | null
          notes: string | null
          owner_id: string | null
          pipeline_id: string | null
          position: number | null
          probability: number | null
          source_channel: string | null
          source_channel_id: string | null
          stage: string | null
          type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_name: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          industry?: string | null
          labels?: string | null
          lead_source?: string | null
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          position?: number | null
          probability?: number | null
          source_channel?: string | null
          source_channel_id?: string | null
          stage?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_name?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          industry?: string | null
          labels?: string | null
          lead_source?: string | null
          notes?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          position?: number | null
          probability?: number | null
          source_channel?: string | null
          source_channel_id?: string | null
          stage?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_responses: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          qualification_status: string | null
          question: string | null
          response: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          qualification_status?: string | null
          question?: string | null
          response?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          qualification_status?: string | null
          question?: string | null
          response?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          access_token: string
          created_at: string
          email_address: string
          expires_at: string | null
          id: string
          provider: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          email_address: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          email_address?: string
          expires_at?: string | null
          id?: string
          provider?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_signatures: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          signature_html: string
          signature_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          signature_html?: string
          signature_text?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          signature_html?: string
          signature_text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          category: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          subject: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          subject?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          subject?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_tracking_events: {
        Row: {
          contact_id: string | null
          created_at: string | null
          email_id: string | null
          event_type: string
          id: string
          ip_address: string | null
          link_url: string | null
          occurred_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          email_id?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          occurred_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          email_id?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          occurred_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_events_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          account_id: string | null
          body_html: string | null
          click_count: number | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          direction: string | null
          email_labels: string | null
          first_opened_at: string | null
          folder: string | null
          from_email: string
          from_name: string | null
          gmail_id: string
          has_attachments: boolean | null
          id: string
          is_read: boolean | null
          is_tracked: boolean | null
          labels: string[] | null
          last_opened_at: string | null
          open_count: number | null
          received_at: string
          snippet: string | null
          subject: string | null
          thread_id: string | null
          to_emails: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          body_html?: string | null
          click_count?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string | null
          email_labels?: string | null
          first_opened_at?: string | null
          folder?: string | null
          from_email: string
          from_name?: string | null
          gmail_id: string
          has_attachments?: boolean | null
          id?: string
          is_read?: boolean | null
          is_tracked?: boolean | null
          labels?: string[] | null
          last_opened_at?: string | null
          open_count?: number | null
          received_at: string
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          to_emails?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          body_html?: string | null
          click_count?: number | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string | null
          email_labels?: string | null
          first_opened_at?: string | null
          folder?: string | null
          from_email?: string
          from_name?: string | null
          gmail_id?: string
          has_attachments?: boolean | null
          id?: string
          is_read?: boolean | null
          is_tracked?: boolean | null
          labels?: string[] | null
          last_opened_at?: string | null
          open_count?: number | null
          received_at?: string
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          to_emails?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid_date: string | null
          payment_status: string | null
          project_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          paid_date?: string | null
          payment_status?: string | null
          project_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid_date?: string | null
          payment_status?: string | null
          project_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kv_store_65817682: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      kv_store_958f7923: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      leads: {
        Row: {
          company_id: string | null
          company_name: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          qualification_score: number | null
          source: string | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          qualification_score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          qualification_score?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_accounts: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          linkedin_id: string
          profile_data: Json | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          linkedin_id: string
          profile_data?: Json | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          linkedin_id?: string
          profile_data?: Json | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_connections: {
        Row: {
          company: string | null
          company_id: string | null
          connection_status: string | null
          contact_id: string | null
          created_at: string
          headline: string | null
          id: string
          linkedin_id: string
          name: string
          profile_url: string | null
          synced_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company?: string | null
          company_id?: string | null
          connection_status?: string | null
          contact_id?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          linkedin_id: string
          name: string
          profile_url?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company?: string | null
          company_id?: string | null
          connection_status?: string | null
          contact_id?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          linkedin_id?: string
          name?: string
          profile_url?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_connections_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_messages: {
        Row: {
          campaign_name: string | null
          company_name: string | null
          connection_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          linkedin_conversation_url: string | null
          message_text: string
          message_timestamp: string
          profile_url: string | null
          raw_payload: Json | null
          recipient_linkedin_id: string
          sender_linkedin_id: string
          sender_name: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          campaign_name?: string | null
          company_name?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          linkedin_conversation_url?: string | null
          message_text: string
          message_timestamp?: string
          profile_url?: string | null
          raw_payload?: Json | null
          recipient_linkedin_id: string
          sender_linkedin_id: string
          sender_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          campaign_name?: string | null
          company_name?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          linkedin_conversation_url?: string | null
          message_text?: string
          message_timestamp?: string
          profile_url?: string | null
          raw_payload?: Json | null
          recipient_linkedin_id?: string
          sender_linkedin_id?: string
          sender_name?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "linkedin_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          filter_json: Json | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          filter_json?: Json | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          filter_json?: Json | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lms_leads: {
        Row: {
          company_id: string | null
          company_size: string | null
          contact_id: string | null
          created_at: string | null
          credits_total: number | null
          credits_used: number | null
          email: string
          full_name: string
          id: string
          learning_objectives: string | null
          lms_created_at: string | null
          lms_user_id: string | null
          marketing_consent: boolean | null
          plan: string | null
          raw_payload: Json | null
          role: string | null
          source: string | null
          updated_at: string | null
          use_case: string | null
          user_id: string
          verified: boolean | null
        }
        Insert: {
          company_id?: string | null
          company_size?: string | null
          contact_id?: string | null
          created_at?: string | null
          credits_total?: number | null
          credits_used?: number | null
          email: string
          full_name: string
          id?: string
          learning_objectives?: string | null
          lms_created_at?: string | null
          lms_user_id?: string | null
          marketing_consent?: boolean | null
          plan?: string | null
          raw_payload?: Json | null
          role?: string | null
          source?: string | null
          updated_at?: string | null
          use_case?: string | null
          user_id: string
          verified?: boolean | null
        }
        Update: {
          company_id?: string | null
          company_size?: string | null
          contact_id?: string | null
          created_at?: string | null
          credits_total?: number | null
          credits_used?: number | null
          email?: string
          full_name?: string
          id?: string
          learning_objectives?: string | null
          lms_created_at?: string | null
          lms_user_id?: string | null
          marketing_consent?: boolean | null
          plan?: string | null
          raw_payload?: Json | null
          role?: string | null
          source?: string | null
          updated_at?: string | null
          use_case?: string | null
          user_id?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "lms_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          action_items: Json | null
          audio_url: string | null
          bullet_gist: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          duration_minutes: number | null
          fireflies_meeting_id: string | null
          id: string
          meeting_date: string
          meeting_type: string | null
          overview: string | null
          participants: string[] | null
          raw_data: Json | null
          summary: string | null
          title: string
          transcript_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_items?: Json | null
          audio_url?: string | null
          bullet_gist?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          fireflies_meeting_id?: string | null
          id?: string
          meeting_date: string
          meeting_type?: string | null
          overview?: string | null
          participants?: string[] | null
          raw_data?: Json | null
          summary?: string | null
          title: string
          transcript_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_items?: Json | null
          audio_url?: string | null
          bullet_gist?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          fireflies_meeting_id?: string | null
          id?: string
          meeting_date?: string
          meeting_type?: string | null
          overview?: string | null
          participants?: string[] | null
          raw_data?: Json | null
          summary?: string | null
          title?: string
          transcript_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_lost: boolean | null
          is_won: boolean | null
          name: string
          pipeline_id: string | null
          position: number
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name: string
          pipeline_id?: string | null
          position: number
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_lost?: boolean | null
          is_won?: boolean | null
          name?: string
          pipeline_id?: string | null
          position?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string | null
          document_url: string | null
          file_size: number | null
          id: string
          project_id: string | null
          updated_at: string
          uploaded_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type?: string | null
          document_url?: string | null
          file_size?: number | null
          id?: string
          project_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string | null
          document_url?: string | null
          file_size?: number | null
          id?: string
          project_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          client_id: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          manager: string | null
          priority: string | null
          progress: number | null
          project_id: string | null
          project_name: string
          start_date: string | null
          status: string | null
          team_members: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          budget?: number | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          manager?: string | null
          priority?: string | null
          progress?: number | null
          project_id?: string | null
          project_name: string
          start_date?: string | null
          status?: string | null
          team_members?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          budget?: number | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          manager?: string | null
          priority?: string | null
          progress?: number | null
          project_id?: string | null
          project_name?: string
          start_date?: string | null
          status?: string | null
          team_members?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          item_name: string
          price: number | null
          proposal_id: string | null
          quantity: number | null
          total: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          item_name: string
          price?: number | null
          proposal_id?: string | null
          quantity?: number | null
          total?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          item_name?: string
          price?: number | null
          proposal_id?: string | null
          quantity?: number | null
          total?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          additional_services: string | null
          amount: number | null
          client_id: string | null
          created_at: string
          expiration_date: string | null
          goals: string | null
          id: string
          project_name: string | null
          proposal_number: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string | null
          why_us: string | null
        }
        Insert: {
          additional_services?: string | null
          amount?: number | null
          client_id?: string | null
          created_at?: string
          expiration_date?: string | null
          goals?: string | null
          id?: string
          project_name?: string | null
          proposal_number?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
          why_us?: string | null
        }
        Update: {
          additional_services?: string | null
          amount?: number | null
          client_id?: string | null
          created_at?: string
          expiration_date?: string | null
          goals?: string | null
          id?: string
          project_name?: string | null
          proposal_number?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
          why_us?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_opportunities: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_value: number | null
          expected_close_date: string | null
          id: string
          notes: string | null
          opportunity_name: string
          probability: number | null
          stage: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          opportunity_name: string
          probability?: number | null
          stage?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_value?: number | null
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          opportunity_name?: string
          probability?: number | null
          stage?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_emails: {
        Row: {
          body_html: string | null
          bounce_type: string | null
          bounced_at: string | null
          clicked_at: string | null
          created_at: string | null
          delivery_status: string | null
          enrollment_id: string | null
          id: string
          link_url: string | null
          opened_at: string | null
          resend_message_id: string | null
          sent_at: string | null
          spam_reported_at: string | null
          status: string | null
          step_number: number | null
          subject: string | null
          total_clicks: number | null
          total_opens: number | null
          unique_clicks: number | null
          unique_opens: number | null
          unsubscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          body_html?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivery_status?: string | null
          enrollment_id?: string | null
          id?: string
          link_url?: string | null
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          spam_reported_at?: string | null
          status?: string | null
          step_number?: number | null
          subject?: string | null
          total_clicks?: number | null
          total_opens?: number | null
          unique_clicks?: number | null
          unique_opens?: number | null
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          body_html?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivery_status?: string | null
          enrollment_id?: string | null
          id?: string
          link_url?: string | null
          opened_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          spam_reported_at?: string | null
          status?: string | null
          step_number?: number | null
          subject?: string | null
          total_clicks?: number | null
          total_opens?: number | null
          unique_clicks?: number | null
          unique_opens?: number | null
          unsubscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_emails_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          current_step: number | null
          enrolled_at: string | null
          id: string
          metadata: Json | null
          next_email_at: string | null
          sequence_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          current_step?: number | null
          enrolled_at?: string | null
          id?: string
          metadata?: Json | null
          next_email_at?: string | null
          sequence_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          current_step?: number | null
          enrolled_at?: string | null
          id?: string
          metadata?: Json | null
          next_email_at?: string | null
          sequence_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string | null
          description: string | null
          from_email: string | null
          from_name: string | null
          id: string
          name: string
          status: string | null
          steps: Json
          trigger_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          name: string
          status?: string | null
          steps?: Json
          trigger_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          name?: string
          status?: string | null
          steps?: Json
          trigger_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          archive: boolean | null
          assigned_to: string | null
          client_id: string | null
          company_id: string | null
          connection: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_deal_id: string | null
          priority: string | null
          project_id: string | null
          status: string | null
          tags: string[] | null
          task_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archive?: boolean | null
          assigned_to?: string | null
          client_id?: string | null
          company_id?: string | null
          connection?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_deal_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string | null
          tags?: string[] | null
          task_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archive?: boolean | null
          assigned_to?: string | null
          client_id?: string | null
          company_id?: string | null
          connection?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_deal_id?: string | null
          priority?: string | null
          project_id?: string | null
          status?: string | null
          tags?: string[] | null
          task_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_linked_deal_id_fkey"
            columns: ["linked_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_tracking: {
        Row: {
          billable: boolean | null
          created_at: string
          date: string
          description: string | null
          hourly_rate: number | null
          hours: number
          id: string
          owner_user_id: string | null
          project_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billable?: boolean | null
          created_at?: string
          date?: string
          description?: string | null
          hourly_rate?: number | null
          hours?: number
          id?: string
          owner_user_id?: string | null
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billable?: boolean | null
          created_at?: string
          date?: string
          description?: string | null
          hourly_rate?: number | null
          hours?: number
          id?: string
          owner_user_id?: string | null
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_tracking_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consent: {
        Row: {
          consent_type: string
          consented: boolean
          consented_at: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          consented?: boolean
          consented_at?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          consented?: boolean
          consented_at?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_user_consent: {
        Args: {
          consent_type_param: string
          consented_param: boolean
          ip_address_param?: string
          user_agent_param?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
